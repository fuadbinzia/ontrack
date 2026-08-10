import type { TravelPlan } from '@/features/travel/types';

import {
  AGENT_UI_DEMO_FLIGHT_ID,
  AGENT_UI_PUNTA_CANA_STAY_ID,
  AGENT_UI_RESERVED_TRIP_IDS,
  isReservedAgentUiTripId,
  type AgentUiFixtureName,
} from './fixtures-constants';
import type { AgentUiSeedResult } from './fixtures-seed-types';
import {
  buildAgentUiDemoTrip,
  buildAgentUiPuntaCanaTrip,
  buildTravelHomeVisualTrips,
  TRAVEL_RESTORE_DOCUMENTS_FILENAME,
} from './fixtures-travel';

export async function restoreTravelPlansFromDocuments(): Promise<AgentUiSeedResult | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { File, Paths } = require('expo-file-system') as typeof import('expo-file-system');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useTravel } = require('@/store/travel') as typeof import('@/store/travel');
  const file = new File(Paths.document, TRAVEL_RESTORE_DOCUMENTS_FILENAME);
  if (!file.exists) return null;
  let parsed: unknown;
  try {
    parsed = await file.json();
  } catch {
    return null;
  }
  const plans = Array.isArray(parsed) ? parsed : [];
  let primaryId: string | undefined;
  for (const plan of plans) {
    if (!plan || typeof plan !== 'object') continue;
    const id = (plan as { id?: unknown }).id;
    if (typeof id !== 'string' || isReservedAgentUiTripId(id)) continue;
    if (!useTravel.getState().savePlan(plan as TravelPlan)) continue;
    primaryId ??= id;
    useTravel.getState().recordPlanInteraction(id);
  }
  if (!primaryId) return null;
  // Strip reserved sandbox fixtures that may already be on the live account.
  for (const tripId of AGENT_UI_RESERVED_TRIP_IDS) {
    if (useTravel.getState().plans.some((plan) => plan.id === tripId)) {
      useTravel.getState().removePlan(tripId);
    }
  }
  try {
    file.delete();
  } catch {
    // Best-effort cleanup of the one-shot restore payload.
  }
  return {
    fixture: 'travel-restore-documents',
    primaryId,
    planId: primaryId,
  };
}

/** Sync travel seed branches for `seedAgentUiFixture`. */
export function seedTravelAgentUiFixture(
  fixture: Extract<
    AgentUiFixtureName,
    'travel-demo' | 'travel-punta-cana' | 'travel-home' | 'travel-home-empty'
  >,
): AgentUiSeedResult | null {
  if (fixture === 'travel-demo') {
    // Lazy require keeps agent-ui unit tests free of Zustand/AsyncStorage.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTravel } = require('@/store/travel') as typeof import('@/store/travel');
    const plan = buildAgentUiDemoTrip();
    const saved = useTravel.getState().savePlan(plan);
    if (!saved) return null;
    useTravel.getState().recordPlanInteraction(plan.id);
    return {
      fixture,
      primaryId: plan.id,
      planId: plan.id,
      flightItemId: AGENT_UI_DEMO_FLIGHT_ID,
    };
  }

  if (fixture === 'travel-punta-cana') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTravel } = require('@/store/travel') as typeof import('@/store/travel');
    const plan = buildAgentUiPuntaCanaTrip();
    const saved = useTravel.getState().savePlan(plan);
    if (!saved) return null;
    useTravel.getState().recordPlanInteraction(plan.id);
    return {
      fixture,
      primaryId: plan.id,
      planId: plan.id,
      itemId: AGENT_UI_PUNTA_CANA_STAY_ID,
    };
  }

  if (fixture === 'travel-home') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTravel } = require('@/store/travel') as typeof import('@/store/travel');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useUI } = require('@/store/ui') as typeof import('@/store/ui');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      TRAVEL_HOME_ANTIGUA_TRIP_ID,
      TRAVEL_HOME_ICELAND_TRIP_ID,
      TRAVEL_HOME_THIRD_TRIP_ID,
    } =
      require('@/features/travel/fixtures/travel-home') as typeof import('@/features/travel/fixtures/travel-home');
    const plans = buildTravelHomeVisualTrips();
    for (const plan of plans) {
      if (!useTravel.getState().savePlan(plan)) return null;
    }
    // Recency order: Iceland first, then Antigua, then third (below fold).
    useTravel.getState().recordPlanInteraction(TRAVEL_HOME_THIRD_TRIP_ID);
    useTravel.getState().recordPlanInteraction(TRAVEL_HOME_ANTIGUA_TRIP_ID);
    useTravel.getState().recordPlanInteraction(TRAVEL_HOME_ICELAND_TRIP_ID);
    useUI.getState().setTabBarCollapsed(false);
    return {
      fixture,
      primaryId: TRAVEL_HOME_ICELAND_TRIP_ID,
      planId: TRAVEL_HOME_ICELAND_TRIP_ID,
    };
  }

  // travel-home-empty
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useTravel } = require('@/store/travel') as typeof import('@/store/travel');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useUI } = require('@/store/ui') as typeof import('@/store/ui');
  // Clear leftover seeds so zero-trip welcome is visible.
  useTravel.getState().replacePlans([]);
  useUI.getState().setTabBarCollapsed(false);
  return {
    fixture,
    primaryId: 'travel-home-empty',
  };
}
