import type { Session } from '@supabase/supabase-js';

import {
    accessibleAuthError,
    deleteOwnCloudAccount,
    resetOwnCloudData,
    signOutLocalSession,
} from '@/services/cloud/account';
import { getSupabaseClient } from '@/services/cloud/supabase';
import {
    clearLocalAccountData,
    flushCloudSync,
    resumeCloudSyncAfterReset,
} from '@/services/cloud/sync';
import { useAuthAccess } from '@/store/auth-access';
import { useFriends } from '@/store/friends';

import type { AuthPhase } from './auth-phase';

export interface SignOutResult {
  status: 'signed-out' | 'sync-failed' | 'cleanup-failed';
  message?: string;
}

export interface DeleteAccountResult {
  status: 'deleted' | 'failed';
  message?: string;
}

export interface ResetAccountDataResult {
  status: 'reset' | 'failed';
  message?: string;
}

/** Provider plumbing the exit flows drive: React state plus init bookkeeping. */
export interface AuthExitControls {
  setPhase: (phase: AuthPhase) => void;
  setSession: (session: Session | null) => void;
  setError: (message?: string) => void;
  /** Invalidate any in-flight account open so a late success cannot resurrect it. */
  invalidateInit: () => void;
  setExplicitSignOut: (explicit: boolean) => void;
  clearLock: () => void;
}

/** Account-owned local stores must never outlive the account on this device. */
export async function dropLocalAccountState(options?: {
  markSignedOut?: boolean;
  preserveAccountAccess?: boolean;
  preserveAccountFlags?: boolean;
}): Promise<void> {
  await clearLocalAccountData(options);
  useFriends.getState().clear();
  if (!options?.preserveAccountAccess) useAuthAccess.getState().resetAccess();
}

export async function resetAccountDataFlow(
  session: Session | null,
  controls: AuthExitControls,
): Promise<ResetAccountDataResult> {
  controls.clearLock();
  controls.setPhase('loading');
  try {
    if (session) await resetOwnCloudData();
    await dropLocalAccountState({
      markSignedOut: false,
      preserveAccountAccess: Boolean(session),
      preserveAccountFlags: Boolean(session),
    });
    if (session) {
      resumeCloudSyncAfterReset(session.user.id, session.user.email ?? undefined);
    }
    controls.setError(undefined);
    controls.setPhase(session ? 'authenticated' : 'welcome');
    return { status: 'reset' };
  } catch (resetError) {
    const message = accessibleAuthError(resetError);
    controls.setError(message);
    controls.setPhase(session ? 'authenticated' : 'welcome');
    return { status: 'failed', message };
  }
}

/**
 * Fire-and-forget wipe that only applies friends/access + `onDone` when
 * `isCurrent()` is still true (protects against a newer boot generation).
 */
export function scheduleDropLocalAccountState(options: {
  isCurrent: () => boolean;
  onDone: () => void;
  onError?: (error: unknown) => void;
}): void {
  void clearLocalAccountData()
    .catch((error: unknown) => {
      options.onError?.(error);
    })
    .finally(() => {
      if (!options.isCurrent()) return;
      useFriends.getState().clear();
      useAuthAccess.getState().resetAccess();
      options.onDone();
    });
}

export async function signOutCurrentDeviceFlow(
  force: boolean,
  controls: AuthExitControls,
): Promise<SignOutResult> {
  controls.clearLock();
  if (!force) {
    try {
      await flushCloudSync();
    } catch (syncError) {
      return {
        status: 'sync-failed',
        message: `Some changes have not reached the cloud. ${accessibleAuthError(syncError)}`,
      };
    }
  }
  controls.setExplicitSignOut(true);
  controls.invalidateInit();
  controls.setPhase('loading');
  try {
    await signOutLocalSession();
    await dropLocalAccountState();
    controls.setSession(null);
    controls.setError(undefined);
    controls.setPhase('welcome');
    return { status: 'signed-out' };
  } catch (signOutError) {
    // Local tokens may already be gone — never leave the UI "authenticated"
    // without a live Supabase session.
    controls.invalidateInit();
    controls.setSession(null);
    try {
      await dropLocalAccountState();
    } catch {
      // Best-effort; surface the original failure below.
    }
    controls.setError(accessibleAuthError(signOutError));
    controls.setPhase('welcome');
    return {
      status: 'cleanup-failed',
      message: accessibleAuthError(signOutError),
    };
  } finally {
    controls.setExplicitSignOut(false);
  }
}

export async function deleteAccountFlow(
  controls: AuthExitControls,
): Promise<DeleteAccountResult> {
  controls.clearLock();
  controls.setExplicitSignOut(true);
  controls.invalidateInit();
  controls.setPhase('loading');
  try {
    await deleteOwnCloudAccount();
    await dropLocalAccountState();
    controls.setSession(null);
    controls.setError(undefined);
    controls.setPhase('welcome');
    return { status: 'deleted' };
  } catch (deleteError) {
    const stillSignedIn = !!(await getSupabaseClient()?.auth.getSession())?.data.session;
    controls.setError(accessibleAuthError(deleteError));
    if (stillSignedIn) {
      controls.setPhase('authenticated');
    } else {
      controls.setSession(null);
      try {
        await dropLocalAccountState();
      } catch {
        // Best-effort wipe once the auth user is already gone.
      }
      controls.setPhase('welcome');
    }
    return {
      status: 'failed',
      message: accessibleAuthError(deleteError),
    };
  } finally {
    controls.setExplicitSignOut(false);
  }
}
