import type { Href, ImperativeRouter } from 'expo-router';

/**
 * Close / back with a safe fallback.
 *
 * Dismiss one route when the active stack has a parent so stacked sheets reveal
 * the sheet beneath them. Empty-stack pops hit Expo Router's dev-only LogBox,
 * so direct links and replaced routes use `dismissTo(fallback)` instead. That
 * pops to the fallback when it is in history or swaps the current route for it.
 */
export function goBackOrReplace(router: ImperativeRouter, fallback: Href = '/') {
  if (router.canDismiss()) {
    router.dismiss();
    return;
  }
  router.dismissTo(fallback);
}
