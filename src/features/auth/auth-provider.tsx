import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
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
import { loadAccountFlags } from '@/services/cloud/account-flags';
import { getSupabaseClient } from '@/services/cloud/supabase';
import {
    cancelAccountSync,
    getPendingDataChoiceVariant,
    hasMeaningfulLocalData,
    prepareAccountSync,
    resolveAccountSync,
} from '@/services/cloud/sync';
import { useAuthAccess } from '@/store/auth-access';
import { useFriends } from '@/store/friends';
import { setAgentUiLoginHandler } from '@/utils/agent-ui/agent-login';

import { signInAgentTestAccount } from './agent-account-login';
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
import { subscribeGuestDirtyStores } from './auth-guest-dirty';
import {
    authCancelPhase,
    guestEntryNeedsSignOut,
    guestShellConflictsWithDiskSession,
} from './auth-guest-session';
import { armSessionLock, markSessionUnlocked, requiresSessionUnlock } from './session-lock';

import type { AuthPhase } from './auth-phase';

export type { DeleteAccountResult, SignOutResult } from './auth-account-exit';
export { useAuthSession } from './auth-context';
export type { AuthContextValue, DataChoiceVariant, DataResolution } from './auth-context';
export type { AuthPhase } from './auth-phase';

interface LockedAccount {
  userId: string;
  email?: string;
}

type StickyAuthPhase = Extract<AuthPhase, 'guest' | 'authenticated' | 'resolving-data'>;

type AuthSessionSnapshot = {
  phase: StickyAuthPhase;
  session: Session | null;
  initializedUserId?: string;
};

/**
 * Survives Fast Refresh remounts so RootNavigator does not flash `loading`
 * and tear down the Stack (which resets the selected tab to Today).
 */
let sessionAuthSnapshot: AuthSessionSnapshot | null = null;

function isStickyAuthPhase(phase: AuthPhase): phase is StickyAuthPhase {
  return phase === 'guest' || phase === 'authenticated' || phase === 'resolving-data';
}

export function AuthSessionProvider({
  hydrated,
  children,
}: PropsWithChildren<{ hydrated: boolean }>) {
  const [phase, setPhase] = useState<AuthPhase>(
    () => sessionAuthSnapshot?.phase ?? 'loading',
  );
  const [session, setSession] = useState<Session | null>(
    () => sessionAuthSnapshot?.session ?? null,
  );
  const [workingProvider, setWorkingProvider] = useState<AuthProvider | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const initializationRef = useRef<Promise<void> | undefined>(undefined);
  const initializedUserRef = useRef<string | undefined>(
    sessionAuthSnapshot?.initializedUserId,
  );
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

  useEffect(() => {
    if (isStickyAuthPhase(phase)) {
      // Reaching a settled shell is what satisfies the cold-start gate.
      markSessionUnlocked();
      sessionAuthSnapshot = {
        phase,
        session,
        initializedUserId: initializedUserRef.current,
      };
      return;
    }
    if (phase === 'welcome' || phase === 'error' || phase === 'locked') {
      sessionAuthSnapshot = null;
    }
  }, [phase, session]);

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

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    const client = getSupabaseClient();
    if (!client) {
      const timer = setTimeout(() => {
        if (active) setPhase(fallbackPhase());
      }, 0);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }

    const SESSION_TIMEOUT_MS = 5_000;
    let sessionResolved = false;
    const timeout = setTimeout(() => {
      if (!active || sessionResolved) return;
      // Prefer a recoverable welcome/guest shell over an infinite blank load.
      // Never demote a sticky authenticated/guest snapshot restored on remount.
      setPhase((current) => {
        if (
          current === 'authenticated' ||
          current === 'guest' ||
          current === 'resolving-data'
        ) {
          return current;
        }
        if (current !== 'loading') return current;
        return fallbackPhase();
      });
    }, SESSION_TIMEOUT_MS);

    void client.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        sessionResolved = true;
        clearTimeout(timeout);
        if (sessionError) {
          setError(accessibleAuthError(sessionError));
          setPhase('error');
        } else if (data.session) {
          if (requiresSessionUnlock()) {
            // Killed-app relaunch: hold the shell behind a fresh sign-in. The
            // Supabase session stays on disk and local data is untouched — the
            // usual boot sync just waits for the user to confirm who they are.
            applyLock({
              userId: data.session.user.id,
              email: data.session.user.email ?? undefined,
            });
            setSession(null);
            setPhase('locked');
            return;
          }
          const bootGeneration = initGenerationRef.current + 1;
          const accountTimeout = setTimeout(() => {
            if (!active || initGenerationRef.current !== bootGeneration) return;
            // Invalidate the in-flight init so a late success cannot flip phase
            // after we have already surfaced the timeout error.
            initGenerationRef.current += 1;
            initializedUserRef.current = undefined;
            cancelAccountSync();
            setError('Opening your account is taking too long. Please try again.');
            setPhase('error');
          }, 12_000);
          void initializeAccount(data.session)
            .catch((accountError: unknown) => {
              if (!active || initGenerationRef.current !== bootGeneration) return;
              setError(accessibleAuthError(accountError));
              setPhase('error');
            })
            .finally(() => clearTimeout(accountTimeout));
        } else {
          const access = useAuthAccess.getState();
          // Explicit null session — clear any sticky React session. Non-guest
          // devices must also drop account-owned local data (same as SIGNED_OUT)
          // so a later empty-cloud sign-in cannot upload a prior account graph.
          initGenerationRef.current += 1;
          initializedUserRef.current = undefined;
          setSession(null);
          if (access.guestEnabled) {
            cancelAccountSync();
            // Guests re-enter through Welcome after a kill; their local data stays.
            setPhase(fallbackPhase());
            return;
          }
          setPhase('loading');
          scheduleDropLocalAccountState({
            isCurrent: () => active,
            onError: (cleanupError) => {
              if (active) setError(accessibleAuthError(cleanupError));
            },
            onDone: () => setPhase('welcome'),
          });
        }
      })
      .catch((sessionError: unknown) => {
        if (!active) return;
        sessionResolved = true;
        clearTimeout(timeout);
        setError(accessibleAuthError(sessionError));
        setPhase('error');
      });

    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      setTimeout(() => {
        if (!active) return;
        // Behind the gate the restored session must not open the app on its own.
        if (lockedRef.current && event !== 'SIGNED_OUT') return;
        if (nextSession && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          void initializeAccount(nextSession).catch((accountError: unknown) => {
            if (!active) return;
            setError(accessibleAuthError(accountError));
            setPhase('error');
          });
        } else if (event === 'SIGNED_OUT' && !explicitSignOutRef.current) {
          // Invalidate in-flight prepare/resolve so a late finishAuthentication
          // cannot resurrect an authenticated shell after the session died.
          applyLock(null);
          initGenerationRef.current += 1;
          initializedUserRef.current = undefined;
          const access = useAuthAccess.getState();
          // Mid data-choice: keep the guest device dataset the user was deciding
          // on. Wiping here would destroy the only copy of those plans.
          const preserveGuestConflict =
            access.guestEnabled && (access.guestDataDirty || access.authUpgradePending);
          setPhase('loading');
          if (preserveGuestConflict) {
            cancelAccountSync();
            useFriends.getState().clear();
            useAuthAccess.getState().cancelAuthUpgrade();
            setSession(null);
            setError(undefined);
            setPhase('guest');
            return;
          }
          // Account-owned stores must not survive an expired session: otherwise
          // a subsequent account could upload retained domains from this user.
          scheduleDropLocalAccountState({
            isCurrent: () => active,
            onError: (cleanupError) => {
              if (active) setError(accessibleAuthError(cleanupError));
            },
            onDone: () => {
              setSession(null);
              setPhase('welcome');
            },
          });
        }
      }, 0);
    });
    return () => {
      active = false;
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, [applyLock, fallbackPhase, hydrated, initializeAccount]);

  useEffect(() => {
    if (!hydrated) return;
    // Keep dirty tracking through authenticating / conflict phases so guest
    // edits during upgrade still promote to cloud instead of a silent wipe.
    if (!guestEnabled || phase === 'authenticated' || phase === 'welcome') return;
    return subscribeGuestDirtyStores();
  }, [guestEnabled, hydrated, phase]);

  // Recover a stuck "guest" shell that still has an account token on disk
  // (failed unlock cleared lockedRef, then Continue as Guest skipped sign-out).
  useEffect(() => {
    if (!hydrated || phase !== 'guest') return;
    let active = true;
    void getSupabaseClient()
      ?.auth.getSession()
      .then(({ data }) => {
        if (!active || !guestShellConflictsWithDiskSession(phase, Boolean(data.session))) {
          return;
        }
        const disk = data.session!;
        useAuthAccess.getState().resetAccess();
        applyLock({
          userId: disk.user.id,
          email: disk.user.email ?? undefined,
        });
        setSession(null);
        setError(undefined);
        setPhase('locked');
      });
    return () => {
      active = false;
    };
  }, [applyLock, hydrated, phase]);

  // Privilege flags are in-memory only; reload whenever the signed-in user is active
  // (covers Fast Refresh, sticky auth restore, and recovering from a prior failed fetch).
  useEffect(() => {
    if (phase !== 'authenticated' || !session?.user?.id) return;
    void loadAccountFlags(session.user.id);
  }, [phase, session?.user?.id]);

  // Dev-only: let the agent-ui `login` op sign the leased device into its own
  // agent_N account. Registered here because switching accounts must go through
  // the same local-data hygiene as a normal provider sign-in.
  useEffect(() => {
    if (!__DEV__) return;
    return setAgentUiLoginHandler(async ({ email, password }) => {
      applyLock(null);
      markSessionUnlocked();
      const result = await signInAgentTestAccount({
        email,
        password,
        onAccountSwitch: async () => {
          await dropLocalAccountState();
        },
      });
      if (!result.ok) return result;
      const live = await getSupabaseClient()?.auth.getSession();
      if (live?.data.session) await initializeAccount(live.data.session);
      return result;
    });
  }, [applyLock, initializeAccount]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const restoreAfterBrowserCancel = () => {
      if (
        !useAuthAccess.getState().authUpgradePending ||
        window.location.pathname.endsWith('/auth/callback')
      ) {
        return;
      }
      providerLockRef.current = false;
      setWorkingProvider(undefined);
      useAuthAccess.getState().cancelAuthUpgrade();
      setPhase(authCancelPhase(Boolean(lockedRef.current)));
    };
    window.addEventListener('pageshow', restoreAfterBrowserCancel);
    return () => window.removeEventListener('pageshow', restoreAfterBrowserCancel);
  }, []);

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
