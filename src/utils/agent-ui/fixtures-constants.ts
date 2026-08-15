import {
    TRAVEL_HOME_ANTIGUA_TRIP_ID,
    TRAVEL_HOME_ICELAND_TRIP_ID,
    TRAVEL_HOME_THIRD_TRIP_ID,
} from '@/features/travel/fixtures/travel-home';

export {
    TRAVEL_HOME_ANTIGUA_TRIP_ID,
    TRAVEL_HOME_ICELAND_TRIP_ID,
    TRAVEL_HOME_THIRD_TRIP_ID,
};

/** Stable __DEV__ plan id — agents can deep-link without creating trips. */
export const AGENT_UI_DEMO_TRIP_ID = 'trip-agent-ui-demo';
/** Stable flight itinerary item on the demo trip. */
export const AGENT_UI_DEMO_FLIGHT_ID = 'item-agent-ui-demo-flight';
/** Stable connecting (multi-stop) flight so agents can verify both card shapes. */
export const AGENT_UI_DEMO_CONNECTING_FLIGHT_ID =
  'item-agent-ui-demo-connecting-flight';
/** Stable stay with an address so agents can exercise Open with… maps. */
export const AGENT_UI_DEMO_STAY_ID = 'item-agent-ui-demo-stay';

/** Airbnb Punta Cana stay mock (screenshot / trip-page OCR fixture). */
export const AGENT_UI_PUNTA_CANA_TRIP_ID = 'trip-agent-ui-punta-cana';
export const AGENT_UI_PUNTA_CANA_STAY_ID = 'item-agent-ui-punta-cana-stay';
/** JetBlue JFK → SDQ (trip-detail OCR). */
export const AGENT_UI_PUNTA_CANA_OUTBOUND_ID =
  'item-agent-ui-punta-cana-outbound';
/** JetBlue SDQ → JFK (trip-detail OCR). */
export const AGENT_UI_PUNTA_CANA_RETURN_ID = 'item-agent-ui-punta-cana-return';

export const AGENT_UI_DEMO_RENTAL_ID = 'item-agent-ui-demo-rental';
/** Chase round-trip fixture outbound (EWR → KEF) after importFlight=roundtrip submit. */
export const AGENT_UI_DEMO_CHASE_OUTBOUND_ID =
  'item-agent-ui-demo-chase-outbound';
/** Chase round-trip fixture return (KEF → EWR) after importFlight=roundtrip submit. */
export const AGENT_UI_DEMO_CHASE_RETURN_ID = 'item-agent-ui-demo-chase-return';

/** Stable checklist list for agent deep-links. */
export const AGENT_UI_DEMO_CHECKLIST_LIST_ID = 'list-agent-ui-demo-checklist';
export const AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID = 'task-agent-ui-demo-plan';
export const AGENT_UI_DEMO_CHECKLIST_TASK_PACK_ID = 'task-agent-ui-demo-pack';

/** Stable grocery list + meal for agent deep-links. */
export const AGENT_UI_DEMO_GROCERY_LIST_ID = 'list-agent-ui-demo-grocery';
export const AGENT_UI_DEMO_GROCERY_RECIPE_ID = 'recipe-agent-ui-demo-pasta';
export const AGENT_UI_DEMO_GROCERY_TASK_TOMATOES_ID =
  'task-agent-ui-demo-pasta-tomatoes';
export const AGENT_UI_DEMO_GROCERY_TASK_PASTA_ID =
  'task-agent-ui-demo-pasta-noodles';

/** Stable health Mind fixtures. */
export const AGENT_UI_DEMO_HEALTH_FACTOR_ID = 'factor-agent-ui-demo-work';
export const AGENT_UI_DEMO_HEALTH_MOOD_ID = 'mood-agent-ui-demo-calm';

/** Stable vehicle for agent deep-links. */
export const AGENT_UI_DEMO_VEHICLE_ID = 'vehicle-agent-ui-demo';

/** Stable plant sample (matches `SAMPLE_PLANT_ID` in plants/sample). */
export const AGENT_UI_DEMO_PLANT_ID = 'plant-sample-monstera';
export const AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID =
  'activity-agent-ui-demo-plant-watering';

/** Stable Today activity for agent deep-links. */
export const AGENT_UI_DEMO_ACTIVITY_ID = 'activity-agent-ui-demo-mindfulness';
export const AGENT_UI_DEMO_FOOD_ACTIVITY_ID = 'activity-agent-ui-demo-meal';
export const AGENT_UI_DEMO_EVENT_ACTIVITY_ID = 'activity-agent-ui-demo-event';
export const AGENT_UI_DEMO_EVENT_BOUT_ID = 'bout_agent_ui_demo_main';

/** Stable linked-card transaction for Finance categorization flows. */
export const AGENT_UI_DEMO_FINANCE_TRANSACTION_ID =
  'transaction-agent-ui-demo-finance';

/** Stable gym activity for workouts Today’s Plan. */
export const AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID = 'activity-agent-ui-demo-workout';
export const AGENT_UI_DEMO_WORKOUT_EXERCISE_ID =
  'exercise-agent-ui-demo-bench-press';
export const AGENT_UI_DEMO_WORKOUT_SET_ID = 'set-agent-ui-demo-bench-press-1';
/** Catalog exercise visible on the default Biceps explorer selection. */
export const AGENT_UI_DEMO_WORKOUT_CATALOG_EXERCISE_ID = 'incline-curl';

/** Stable vision-board sample category / canvas item. */
export const AGENT_UI_DEMO_VISION_CATEGORY_ID = 'vision-mindset';
export const AGENT_UI_DEMO_VISION_ITEM_ID = 'vision-sample-forest';

/**
 * Prefer ordered __DEV__ fixture ids, then fall back (e.g. `newId('trip-item')`).
 * Used when a pending import carries `agentUiItemIds`.
 */
export function createIdFromAgentUiItemIds(
  agentUiItemIds: string[] | undefined,
  fallback: () => string,
): () => string {
  let index = 0;
  return () => {
    const next = agentUiItemIds?.[index];
    if (typeof next === 'string' && next.trim()) {
      index += 1;
      return next.trim();
    }
    return fallback();
  };
}

export type AgentUiFixtureName =
  | 'travel-demo'
  | 'travel-map-demo'
  | 'travel-punta-cana'
  | 'travel-home'
  | 'travel-home-empty'
  | 'travel-restore-documents'
  | 'checklist-demo'
  | 'grocery-demo'
  | 'health-demo'
  | 'vehicle-demo'
  | 'plants-demo'
  | 'activity-demo'
  | 'event-demo'
  | 'home-weather'
  | 'food-demo'
  | 'finance-demo'
  | 'workouts-demo'
  | 'vision-board-demo';

/** Stable place label for Today weather agent flows (not a personal address). */
export const AGENT_UI_DEMO_HOME_LOCATION = 'Austin, Texas, United States';

/** Reserved sandbox / agent-ui trip ids — never keep these on a live account. */
export const AGENT_UI_RESERVED_TRIP_IDS: readonly string[] = [
  AGENT_UI_DEMO_TRIP_ID,
  AGENT_UI_PUNTA_CANA_TRIP_ID,
  TRAVEL_HOME_ICELAND_TRIP_ID,
  TRAVEL_HOME_ANTIGUA_TRIP_ID,
  TRAVEL_HOME_THIRD_TRIP_ID,
];

export function isReservedAgentUiTripId(id: string): boolean {
  return AGENT_UI_RESERVED_TRIP_IDS.includes(id);
}

/** Fixture that (re)creates a reserved trip id for DEV sandboxes. */
export function fixtureNameForReservedTripId(
  id: string,
): AgentUiFixtureName | null {
  if (id === AGENT_UI_DEMO_TRIP_ID) return 'travel-demo';
  if (id === AGENT_UI_PUNTA_CANA_TRIP_ID) return 'travel-punta-cana';
  if (
    id === TRAVEL_HOME_ICELAND_TRIP_ID ||
    id === TRAVEL_HOME_ANTIGUA_TRIP_ID ||
    id === TRAVEL_HOME_THIRD_TRIP_ID
  ) {
    return 'travel-home';
  }
  return null;
}

/**
 * After sandbox exit/purge: leave `/travel/<reserved-id>…` so plan detail is
 * not stuck on Trip Not Found with a wiped fixture.
 */

export const AGENT_UI_FIXTURE_NAMES = [
  'travel-demo',
  'travel-map-demo',
  'travel-punta-cana',
  'travel-home',
  'checklist-demo',
  'grocery-demo',
  'health-demo',
  'vehicle-demo',
  'plants-demo',
  'activity-demo',
  'event-demo',
  'home-weather',
  'food-demo',
  'finance-demo',
  'workouts-demo',
  'vision-board-demo',
] as const;

/** Compact host-status detail for a seed result. */
