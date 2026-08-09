import * as Device from 'expo-device';

import { useDevMode } from '@/store/dev-mode';

/**
 * Cleared on every relaunch (fresh JS runtime) but kept across Fast Refresh
 * remounts and background/foreground resumes — the same trick `useHydrated`
 * uses for `sessionHydrated`. Killing the app is what re-arms the gate.
 */
let sessionUnlocked = false;

export interface SessionLockInput {
  unlocked: boolean;
  /** `false` on simulators and emulators. */
  isDevice: boolean;
  staySignedIn: boolean;
}

export function resolveSessionLock({
  unlocked,
  isDevice,
  staySignedIn,
}: SessionLockInput): boolean {
  if (unlocked) return false;
  // Simulators and emulators must never ask agents/testers to sign in again.
  if (!isDevice) return false;
  return !staySignedIn;
}

export function isSessionUnlocked(): boolean {
  return sessionUnlocked;
}

export function markSessionUnlocked(): void {
  sessionUnlocked = true;
}

export function armSessionLock(): void {
  sessionUnlocked = false;
}

/** True while this launch still needs the user to sign in (or re-enter guest). */
export function requiresSessionUnlock(): boolean {
  return resolveSessionLock({
    unlocked: sessionUnlocked,
    isDevice: Device.isDevice !== false,
    staySignedIn: useDevMode.getState().staySignedIn,
  });
}
