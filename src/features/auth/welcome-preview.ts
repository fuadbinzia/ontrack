import { useSyncExternalStore } from 'react';

/**
 * Dev-only: set EXPO_PUBLIC_FORCE_SHOW_WELCOME=true in .env.local (+ restart Metro)
 * to re-open `/welcome` without wiping onboarded prefs.
 */
export function isForceShowWelcomeEnabled(
  envValue: string | undefined = process.env.EXPO_PUBLIC_FORCE_SHOW_WELCOME,
  isDev: boolean = __DEV__,
): boolean {
  return isDev && envValue?.trim().toLowerCase() === 'true';
}

export const FORCE_SHOW_WELCOME = isForceShowWelcomeEnabled();

/** Session dismiss so Skip / Get Started can leave a force-previewed welcome. */
let forceWelcomeDismissed = false;
const forceWelcomeListeners = new Set<() => void>();

function getForceWelcomeDismissed(): boolean {
  return forceWelcomeDismissed;
}

function subscribeForceWelcomeDismissed(onStoreChange: () => void): () => void {
  forceWelcomeListeners.add(onStoreChange);
  return () => {
    forceWelcomeListeners.delete(onStoreChange);
  };
}

/** Clear the force-welcome overlay for this JS session (does not change the env). */
export function dismissForceWelcomePreview(): void {
  if (forceWelcomeDismissed) return;
  forceWelcomeDismissed = true;
  for (const listener of forceWelcomeListeners) listener();
}

/** Test helper — reset session dismiss between cases. */
export function resetForceWelcomePreviewForTests(): void {
  forceWelcomeDismissed = false;
  for (const listener of forceWelcomeListeners) listener();
}

export function shouldShowWelcome(
  hasOnboarded: boolean,
  forceShow: boolean = FORCE_SHOW_WELCOME,
  forceDismissed: boolean = forceWelcomeDismissed,
): boolean {
  if (!hasOnboarded) return true;
  return forceShow && !forceDismissed;
}

/** Reactive gate for layouts — updates when force preview is dismissed. */
export function useShouldShowWelcome(hasOnboarded: boolean): boolean {
  const forceDismissed = useSyncExternalStore(
    subscribeForceWelcomeDismissed,
    getForceWelcomeDismissed,
    getForceWelcomeDismissed,
  );
  return shouldShowWelcome(hasOnboarded, FORCE_SHOW_WELCOME, forceDismissed);
}
