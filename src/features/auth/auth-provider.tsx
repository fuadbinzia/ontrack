import type { Session } from '@supabase/supabase-js';
import { useCallback, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

import {
    accessibleAuthError,
    beginBrowserSignIn,
    beginNativeAppleSignIn,
    CloudAccountError,
    exchangeOAuthCallback,
    isProviderCancellation,
    shouldUseNativeApple,
    signOutLocalSession,
    type AuthProvider,
} from '@/services/cloud/account';
import {
    cancelAccountSync,
    getPendingDataChoiceVariant,
    hasMeaningfulLocalData,
    prepareAccountSync,
    resolveAccountSync,
} from '@/services/cloud/sync';
import { getSupabaseClient } from '@/services/cloud/supabase';
import { useAuthAccess } from '@/store/auth-access';
import { useFriends } from '@/store/friends';

import {
    deleteAccountFlow,
    dropLocalAccountState,
    scheduleDropLocalAccountState,
    signOutCurrentDeviceFlow,
    type AuthExitControls,
    type DeleteAccountResult,
    type SignOutResult,
} from './auth-account-exit';
import { AuthContext, type DataResolution } from './auth-context';
import {
    authCancelPhase,
    guestEntryNeedsSignOut,
} from './auth-guest-session';
import { readInitialAuthState, useAuthProviderEffects } from './auth-provider-effects';
import { type LockedAccount } from './auth-session-snapshot';
import { armSessionLock, requiresSessionUnlock } from './session-lock';

import type { AuthPhase } from './auth-phase';

export type { DeleteAccountResult, SignOutResult } from './auth-account-exit';
export { useAuthSession } from './auth-context';
export type { AuthContextValue, DataChoiceVariant, DataResolution } from './auth-context';
export type { AuthPhase } from './auth-phase';

export function AuthSessionProvider({
  hydrated,
  children,
}: PropsWithChildren<{ hydrated: boolean }>) {
  const initial = readInitialAuthState();
  const [phase, setPhase] = useState<AuthPhase>(() => initial.phase);
  const [session, setSession] = useState<Session | null>(() => initial.session);
  const [workingProvider, setWorkingProvider] = useState<AuthProvider | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const initializationRef = useRef<Promise<void> | undefined>(undefined);
  const initializedUserRef = useRef<string | undefined>(initial.initializedUserId);
  const initGenerationRef = useRef(0);
  const explicitSignOutRef = useRef(false);
  const providerLockRef = useRef(false);
  const [lockedAccount, setLockedAccount] = useState<LockedAccount | null>(null);
  const lockedRef = useRef<LockedAccount | null>(null);
  const guestEnabled = useAuthAccess((state) => state.guestEnabled);

  const applyLock = useCallback((account: LockedAccount | null) => {
    lockedRef.current = account;
    setLockedAccount(account);
  }, []);

  /** Where an idle/cancelled flow lands: behind the gate, or on the settled shell. */
  const fallbackPhase = useCallback((): AuthPhase => {
    if (lockedRef.current) return 'locked';
    const access = useAuthAccess.getState();
    return access.guestEnabled && !requiresSessionUnlock() ? 'guest' : 'welcome';
  }, []);

  const initializeAccount = useCallback(async (nextSession: Session) => {
    if (initializedUserRef.current === nextSession.user.id) {
      if (initializationRef.current) await initializationRef.current;
      return;
    }
    const generation = ++initGenerationRef.current;
    const task = (async () => {
      setPhase('loading');
      setSession(nextSession);
      const access = useAuthAccess.getState();
      const canConflict =
        access.authUpgradePending && access.guestEnabled && access.guestDataDirty;
      const result = await prepareAccountSync(
        nextSession.user.id,
        nextSession.user.email,
        canConflict,
        () => initGenerationRef.current === generation,
      );
      if (initGenerationRef.current !== generation) return;
      if (result === 'conflict') {
        setPhase('resolving-data');
        return;
      }
      const live = await getSupabaseClient()?.auth.getSession();
      if (initGenerationRef.current !== generation || !live?.data.session) {
        cancelAccountSync();
        if (initGenerationRef.current !== generation) return;
        initializedUserRef.current = undefined;
        setSession(null);
        const access = useAuthAccess.getState();
        if (access.guestEnabled) {
          setPhase('guest');
          return;
        }
        // Mirror SIGNED_OUT / null-boot: drop account-owned local data so the
        // next empty-cloud sign-in cannot upload a prior account graph.
        setPhase('loading');
        scheduleDropLocalAccountState({
          isCurrent: () => initGenerationRef.current === generation,
          onDone: () => setPhase('welcome'),
        });
        return;
      }
      useAuthAccess.getState().finishAuthentication();
      setError(undefined);
      setPhase('authenticated');
      void useFriends.getState().hydrate({
        email: nextSession.user.email ?? undefined,
      });
    })();
    initializedUserRef.current = nextSession.user.id;
    initializationRef.current = task;
    try {
      await task;
    } catch (accountError) {
      // A newer boot/retry invalidated this generation — swallow the stale failure.
      if (initGenerationRef.current !== generation) return;
      if (initializedUserRef.current === nextSession.user.id) {
        initializedUserRef.current = undefined;
      }
      throw accountError;
    } finally {
      if (initializationRef.current === task) {
        initializationRef.current = undefined;
      }
    }
  }, []);

  useAuthProviderEffects({
    hydrated,
    phase,
    session,
    guestEnabled,
    applyLock,
    fallbackPhase,
    initializeAccount,
    setPhase,
    setSession,
    setError,
    setWorkingProvider,
    lockedRef,
    initGenerationRef,
    initializedUserRef,
    explicitSignOutRef,
    providerLockRef,
  });

  const continueWithProvider = useCallback(
    async (provider: AuthProvider, returnTo?: string) => {
      if (providerLockRef.current || workingProvider) return;
      providerLockRef.current = true;
      const locked = lockedRef.current;
      applyLock(null);
      // Always write the return path (including clearing a stale invite route
      // when this sign-in did not pass returnTo).
      useAuthAccess.getState().setAuthReturnTo(returnTo);
      useAuthAccess.getState().startAuthUpgrade();
      setWorkingProvider(provider);
      setError(undefined);
      setPhase('authenticating');
      try {
        const nextSession =
          shouldUseNativeApple(provider, Platform.OS)
            ? await beginNativeAppleSignIn()
            : await beginBrowserSignIn(provider);
        if (nextSession) {
          if (locked && locked.userId !== nextSession.user.id) {
            // Unlocked into a different account — the previous account's local
            // graph must not be merged into (or uploaded from) this one.
            await dropLocalAccountState();
            useAuthAccess.getState().startAuthUpgrade();
          }
          // Profile shows the button used for this session — not the first signup
          // provider still stuck on app_metadata.provider after identity linking.
          useAuthAccess.getState().setActiveSignInProvider(provider);
          await initializeAccount(nextSession);
        } else {
          // Provider returned no session without throwing — stay on the gate.
          // Do not fall through to guest via fallbackPhase (guest upgrades would
          // look like "cancel = Continue as Guest").
          if (locked) applyLock(locked);
          useAuthAccess.getState().cancelAuthUpgrade();
          setPhase(authCancelPhase(Boolean(locked)));
        }
      } catch (providerError) {
        if (isProviderCancellation(providerError)) {
          if (locked) applyLock(locked);
          useAuthAccess.getState().cancelAuthUpgrade();
          setError(undefined);
          setPhase(authCancelPhase(Boolean(locked)));
        } else {
          const currentSession = await getSupabaseClient()?.auth.getSession();
          const diskSession = currentSession?.data.session ?? null;
          if (!diskSession) useAuthAccess.getState().cancelAuthUpgrade();
          setError(accessibleAuthError(providerError));
          if (locked && diskSession) {
            // Failed unlock: stay on the locked gate (no Welcome+Guest escape).
            applyLock(locked);
            setPhase('locked');
          } else {
            setPhase('error');
          }
        }
      } finally {
        providerLockRef.current = false;
        setWorkingProvider(undefined);
      }
    },
    [applyLock, initializeAccount, workingProvider],
  );

  const continueAsGuest = useCallback(async () => {
    // Abandon any in-flight account open before (or instead of) local sign-out.
    initGenerationRef.current += 1;
    const locked = lockedRef.current;
    applyLock(null);
    setPhase('loading');
    try {
      // After a failed unlock, lockedRef is cleared but SecureStore may still
      // hold the account token — always check disk before entering guest.
      const live = await getSupabaseClient()?.auth.getSession();
      const needsSignOut = guestEntryNeedsSignOut({
        reactSession: Boolean(session),
        locked: Boolean(locked),
        diskSession: Boolean(live?.data.session),
      });
      if (needsSignOut) {
        explicitSignOutRef.current = true;
        cancelAccountSync();
        await signOutLocalSession();
        // Friends are account-scoped; local plans stay and are marked dirty so
        // the next sign-in silently promotes them to the cloud account.
        useFriends.getState().clear();
        initializedUserRef.current = undefined;
        setSession(null);
      } else {
        cancelAccountSync();
        initializedUserRef.current = undefined;
      }
      useAuthAccess.getState().enterGuest(hasMeaningfulLocalData());
      setError(undefined);
      setPhase('guest');
    } catch (signOutError) {
      setError(accessibleAuthError(signOutError));
      setPhase('error');
    } finally {
      explicitSignOutRef.current = false;
    }
  }, [applyLock, session]);

  const completeOAuthCallback = useCallback(
    async (url: string) => {
      setPhase('authenticating');
      setError(undefined);
      try {
        if (!useAuthAccess.getState().authUpgradePending) {
          throw new CloudAccountError(
            'This sign-in response was not started from this device. Start again from onTrack.',
          );
        }
        const nextSession = await exchangeOAuthCallback(url);
        await initializeAccount(nextSession);
      } catch (callbackError) {
        const currentSession = await getSupabaseClient()?.auth.getSession();
        if (!currentSession?.data.session) useAuthAccess.getState().cancelAuthUpgrade();
        setError(accessibleAuthError(callbackError));
        setPhase('error');
        throw callbackError;
      }
    },
    [initializeAccount],
  );

  const resolveDataConflict = useCallback(async (choice: DataResolution) => {
    setError(undefined);
    if (choice === 'cancel') {
      explicitSignOutRef.current = true;
      initGenerationRef.current += 1;
      try {
        await signOutLocalSession();
        cancelAccountSync();
        initializedUserRef.current = undefined;
        setSession(null);
        useAuthAccess.getState().cancelAuthUpgrade();
        setPhase('guest');
      } catch (cancelError) {
        setError(accessibleAuthError(cancelError));
        setPhase('resolving-data');
        throw cancelError;
      } finally {
        explicitSignOutRef.current = false;
      }
      return;
    }
    const generation = ++initGenerationRef.current;
    try {
      await resolveAccountSync(choice, () => initGenerationRef.current === generation);
      if (initGenerationRef.current !== generation) return;
      const live = await getSupabaseClient()?.auth.getSession();
      if (initGenerationRef.current !== generation) return;
      if (!live?.data.session) {
        cancelAccountSync();
        initializedUserRef.current = undefined;
        setSession(null);
        useAuthAccess.getState().cancelAuthUpgrade();
        setPhase('guest');
        return;
      }
      useAuthAccess.getState().finishAuthentication();
      setPhase('authenticated');
      void useFriends.getState().hydrate({
        email: session?.user.email ?? undefined,
      });
    } catch (resolutionError) {
      if (initGenerationRef.current !== generation) return;
      setError(accessibleAuthError(resolutionError));
      setPhase('resolving-data');
      throw resolutionError;
    }
  }, [session]);

  const exitControls = useMemo<AuthExitControls>(
    () => ({
      setPhase,
      setSession,
      setError,
      invalidateInit: () => {
        initGenerationRef.current += 1;
        initializedUserRef.current = undefined;
      },
      setExplicitSignOut: (explicit) => {
        explicitSignOutRef.current = explicit;
      },
      clearLock: () => applyLock(null),
    }),
    [applyLock],
  );

  const signOutCurrentDevice = useCallback(
    (force = false): Promise<SignOutResult> => signOutCurrentDeviceFlow(force, exitControls),
    [exitControls],
  );

  const deleteAccount = useCallback(
    (): Promise<DeleteAccountResult> => deleteAccountFlow(exitControls),
    [exitControls],
  );

  /**
   * Developer Tools: re-arm the cold-start gate without signing out, so the
   * locked screen can be exercised on any device.
   */
  const lockSession = useCallback(() => {
    initGenerationRef.current += 1;
    initializedUserRef.current = undefined;
    cancelAccountSync();
    armSessionLock();
    setError(undefined);
    if (!session) {
      // Guest device: the gate simply means tapping Continue as Guest again.
      applyLock(null);
      setPhase('welcome');
      return;
    }
    applyLock({ userId: session.user.id, email: session.user.email ?? undefined });
    setSession(null);
    setPhase('locked');
  }, [applyLock, session]);

  const clearError = useCallback(() => {
    setError(undefined);
    if (session) {
      // Invalidate any timed-out / stuck init before retrying.
      initGenerationRef.current += 1;
      initializedUserRef.current = undefined;
      cancelAccountSync();
      setPhase('loading');
      void initializeAccount(session).catch((accountError: unknown) => {
        setError(accessibleAuthError(accountError));
        setPhase('error');
      });
    } else {
      // Dismissing a sign-in error must not silently enter guest.
      setPhase(authCancelPhase(Boolean(lockedRef.current)));
    }
  }, [initializeAccount, session]);

  const dataChoiceVariant =
    phase === 'resolving-data' ? getPendingDataChoiceVariant() ?? undefined : undefined;

  return (
    <AuthContext.Provider
      value={{
        phase,
        session,
        user: session?.user ?? null,
        isGuest: guestEnabled && !session,
        lockedEmail: lockedAccount?.email,
        dataChoiceVariant,
        workingProvider,
        error,
        continueWithProvider,
        continueAsGuest,
        completeOAuthCallback,
        resolveDataConflict,
        signOutCurrentDevice,
        deleteAccount,
        lockSession,
        clearError,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
