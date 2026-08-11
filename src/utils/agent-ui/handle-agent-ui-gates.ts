/** First-run / welcome gates before seed and flow ops. */

import { usePreferences } from '@/store/preferences';

import { AgentUiIds } from './ids';
import { getAgentUiTarget, tapAgentUiTarget } from './registry';
import { getAgentUiRoute } from './route';
import { sleep } from './handle-agent-ui-helpers';

function isWelcomeRoute(route: string): boolean {
  return route === '/welcome' || route.startsWith('/welcome?');
}

function isOnboardingRoute(route: string): boolean {
  return route === '/onboarding' || route.startsWith('/onboarding?');
}

/**
 * Fresh pool clones land on /welcome (single first-run). Skip enters guest and
 * completes onboarding in one tap. Legacy `/onboarding` redirects here.
 */
async function ensurePastWelcomeGate(): Promise<boolean> {
  const route = getAgentUiRoute() || '';
  if (!isWelcomeRoute(route) && !isOnboardingRoute(route)) {
    return true;
  }
  const skipId = AgentUiIds.onboarding.skip;
  const guestId = AgentUiIds.auth.guest;
  // Cold guest entry may need to inspect and clear a stale Supabase session.
  // Keep the warm path instant while giving disposable test devices enough
  // time to settle after a reset or native reinstall.
  const deadline = Date.now() + 20000;
  let tapped = false;
  let resetStaleOnboarding = false;
  while (Date.now() < deadline) {
    const current = getAgentUiRoute() || '';
    if (current && !isWelcomeRoute(current) && !isOnboardingRoute(current)) {
      return true;
    }
    if (!tapped) {
      const id = getAgentUiTarget(skipId)
        ? skipId
        : getAgentUiTarget(guestId)
          ? guestId
          : undefined;
      if (id) {
        if (!tapAgentUiTarget(id)) return false;
        tapped = true;
      } else if (!resetStaleOnboarding) {
        // A disposable agent device can retain the post-onboarding signed-out
        // welcome while having no configured test-account credentials. Restore
        // first-run locally so the documented guest skip can render and flows
        // remain deterministic; this bridge is unavailable outside agent UI.
        usePreferences.getState().resetAll();
        resetStaleOnboarding = true;
      }
    }
    await sleep(50);
  }
  const finalRoute = getAgentUiRoute() || '';
  return Boolean(
    finalRoute && !isWelcomeRoute(finalRoute) && !isOnboardingRoute(finalRoute),
  );
}

/** Single first-run gate — required before seed/flow on cold devices. */
export async function ensurePastLaunchGates(): Promise<boolean> {
  return ensurePastWelcomeGate();
}
