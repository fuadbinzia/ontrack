import type { Session } from '@supabase/supabase-js';

import type { AuthPhase } from './auth-phase';

export interface LockedAccount {
  userId: string;
  email?: string;
}

export type StickyAuthPhase = Extract<AuthPhase, 'guest' | 'authenticated' | 'resolving-data'>;

export type AuthSessionSnapshot = {
  phase: StickyAuthPhase;
  session: Session | null;
  initializedUserId?: string;
};

let snapshot: AuthSessionSnapshot | null = null;

export function getSessionAuthSnapshot(): AuthSessionSnapshot | null {
  return snapshot;
}

export function setSessionAuthSnapshot(next: AuthSessionSnapshot | null): void {
  snapshot = next;
}

export function isStickyAuthPhase(phase: AuthPhase): phase is StickyAuthPhase {
  return phase === 'guest' || phase === 'authenticated' || phase === 'resolving-data';
}
