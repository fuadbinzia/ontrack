import type { Session } from '@supabase/supabase-js';
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { Platform } from 'react-native';

import { legalConsentMatchesCurrent } from '@/features/account/legal-consent';
import {
    accessibleAuthError,
    type AuthProvider,
} from '@/services/cloud/account';
import { loadAccountFlags } from '@/services/cloud/account-flags';
import { getSupabaseClient } from '@/services/cloud/supabase';
import { cancelAccountSync } from '@/services/cloud/sync';
import { useAuthAccess } from '@/store/auth-access';
import { useFriends } from '@/store/friends';
import { usePreferences } from '@/store/preferences';
import { setAgentUiLoginHandler } from '@/utils/agent-ui/agent-login';

import { signInAgentTestAccount } from './agent-account-login';
import { dropLocalAccountState, scheduleDropLocalAccountState } from './auth-account-exit';
import { subscribeGuestDirtyStores } from './auth-guest-dirty';
import { authCancelPhase, guestShellConflictsWithDiskSession } from './auth-guest-session';
import type { AuthPhase } from './auth-phase';
import {
    getSessionAuthSnapshot,
    isStickyAuthPhase,
    setSessionAuthSnapshot,
    type LockedAccount,
} from './auth-session-snapshot';
import { markSessionUnlocked, requiresSessionUnlock } from './session-lock';

type AuthProviderEffectsArgs = {
  hydrated: boolean;
  phase: AuthPhase;
  session: Session | null;
  guestEnabled: boolean;
  applyLock: (account: LockedAccount | null) => void;
  fallbackPhase: () => AuthPhase;
  initializeAccount: (nextSession: Session) => Promise<void>;
  setPhase: Dispatch<SetStateAction<AuthPhase>>;
  setSession: Dispatch<SetStateAction<Session | null>>;
  setError: Dispatch<SetStateAction<string | undefined>>;
  setWorkingProvider: Dispatch<SetStateAction<AuthProvider | undefined>>;
  lockedRef: MutableRefObject<LockedAccount | null>;
  initGenerationRef: MutableRefObject<number>;
  initializedUserRef: MutableRefObject<string | undefined>;
  explicitSignOutRef: MutableRefObject<boolean>;
  providerLockRef: MutableRefObject<boolean>;
};

/**
 * Boot, auth-state listener, guest dirty tracking, privilege reload, and
 * ancillary session side-effects for AuthSessionProvider.
 */
export function useAuthProviderEffects({
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
}: AuthProviderEffectsArgs): void {
  useEffect(() => {
    if (isStickyAuthPhase(phase)) {
      // Reaching a settled shell is what satisfies the cold-start gate.
      markSessionUnlocked();
      setSessionAuthSnapshot({
        phase,
        session,
        initializedUserId: initializedUserRef.current,
      });
      return;
    }
    if (phase === 'welcome' || phase === 'error' || phase === 'locked') {
      setSessionAuthSnapshot(null);
    }
  }, [initializedUserRef, phase, session]);

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
  }, [
    applyLock,
    explicitSignOutRef,
    fallbackPhase,
    hydrated,
    initGenerationRef,
    initializeAccount,
    initializedUserRef,
    lockedRef,
    setError,
    setPhase,
    setSession,
  ]);

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
  }, [applyLock, hydrated, phase, setError, setPhase, setSession]);

  // Privilege flags are in-memory only; reload whenever the signed-in user is active
  // (covers Fast Refresh, sticky auth restore, and recovering from a prior failed fetch).
  useEffect(() => {
    if (phase !== 'authenticated' || !session?.user?.id) return;
    void loadAccountFlags(session.user.id);
    if (!legalConsentMatchesCurrent(usePreferences.getState().legalConsent)) {
      usePreferences.getState().recordLegalConsent();
    }
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
  }, [lockedRef, providerLockRef, setPhase, setWorkingProvider]);
}

/** Initial phase/session from a sticky remount snapshot (cold-start gate). */
export function readInitialAuthState(): {
  phase: AuthPhase;
  session: Session | null;
  initializedUserId: string | undefined;
} {
  const snap = getSessionAuthSnapshot();
  return {
    phase: snap?.phase ?? 'loading',
    session: snap?.session ?? null,
    initializedUserId: snap?.initializedUserId,
  };
}
