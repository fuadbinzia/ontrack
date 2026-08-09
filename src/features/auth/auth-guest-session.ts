/**
 * Decisions for guest entry vs a persisted Supabase session.
 * Kept pure so cold-start / failed-unlock races stay unit-tested.
 */

import type { AuthPhase } from './auth-phase';

/** Entering guest must clear SecureStore when any account token is still around. */
export function guestEntryNeedsSignOut(input: {
  reactSession: boolean;
  locked: boolean;
  diskSession: boolean;
}): boolean {
  return input.reactSession || input.locked || input.diskSession;
}

/** Guest shell with a live account token means the unlock path lost the gate. */
export function guestShellConflictsWithDiskSession(
  phase: string,
  diskHasSession: boolean,
): boolean {
  return phase === 'guest' && diskHasSession;
}

/**
 * Abandoned provider sign-in (cancel / dismiss / no session) stays on the
 * login gate. Never auto-enter guest — that requires Continue as Guest.
 */
export function authCancelPhase(locked: boolean): Extract<AuthPhase, 'locked' | 'welcome'> {
  return locked ? 'locked' : 'welcome';
}
