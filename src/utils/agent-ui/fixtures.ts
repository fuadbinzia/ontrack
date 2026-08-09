import {
    TRAVEL_HOME_ANTIGUA_TRIP_ID,
    TRAVEL_HOME_ICELAND_TRIP_ID,
    TRAVEL_HOME_THIRD_TRIP_ID,
} from '@/features/travel/fixtures/travel-home';
import type { TravelPlan } from '@/features/travel/types';
import type { TodoList, TodoRecipe, TodoTask } from '@/store/todos-types';

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
  | 'travel-home'
  | 'travel-home-empty'
  | 'travel-restore-documents'
  | 'checklist-demo'
  | 'grocery-demo'
  | 'health-demo'
  | 'vehicle-demo'
  | 'plants-demo'
  | 'activity-demo'
  | 'home-weather'
  | 'food-demo'
  | 'workouts-demo'
  | 'vision-board-demo';

/** Stable place label for Today weather agent flows (not a personal address). */
export const AGENT_UI_DEMO_HOME_LOCATION = 'Austin, Texas, United States';

/** Reserved sandbox / agent-ui trip ids — never keep these on a live account. */
export const AGENT_UI_RESERVED_TRIP_IDS: readonly string[] = [
  AGENT_UI_DEMO_TRIP_ID,
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
export function leaveReservedAgentUiTravelRouteIfNeeded(
  route: string | null = null,
): boolean {
  // Lazy require avoids fixtures ↔ route cycles in unit tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { agentUiNavigate, getAgentUiRoute, travelPlanIdFromRoute } =
    require('@/utils/agent-ui/route') as typeof import('@/utils/agent-ui/route');
  const resolved = route ?? getAgentUiRoute();
  const tripId = travelPlanIdFromRoute(resolved);
  if (!tripId || !isReservedAgentUiTripId(tripId)) return false;
  return agentUiNavigate('/travel');
}

/**
 * Reserved demo route with no plan: re-seed while a sandbox is still on;
 * otherwise leave Travel so cold start / verify-both release cannot stick.
 * Returns true when the plan exists after recovery.
 */
export function recoverMissingReservedTravelPlan(planId: string): boolean {
  if (!planId || !isReservedAgentUiTripId(planId)) return false;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useTravel } = require('@/store/travel') as typeof import('@/store/travel');
  if (useTravel.getState().plans.some((plan) => plan.id === planId)) return true;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useDevMode } = require('@/store/dev-mode') as typeof import('@/store/dev-mode');
  if (__DEV__ && useDevMode.getState().enabled) {
    const fixture = fixtureNameForReservedTripId(planId);
    if (fixture) {
      seedAgentUiFixture(fixture);
      if (useTravel.getState().plans.some((plan) => plan.id === planId)) return true;
    }
  }

  leaveReservedAgentUiTravelRouteIfNeeded(`/travel/${planId}`);
  return useTravel.getState().plans.some((plan) => plan.id === planId);
}

/** Dropped after a successful live restore (host places the file in Documents). */
const TRAVEL_RESTORE_DOCUMENTS_FILENAME = 'travel-plans-restore.json';

export type AgentUiSeedResult = {
  fixture: AgentUiFixtureName;
  /** Primary entity id for host status (`id` field). */
  primaryId: string;
  planId?: string;
  flightItemId?: string;
  listId?: string;
  taskId?: string;
  recipeId?: string;
  factorId?: string;
  moodEntryId?: string;
  vehicleId?: string;
  plantId?: string;
  activityId?: string;
  categoryId?: string;
  itemId?: string;
};

function buildTravelHomeParticipant(
  id: string,
  name: string,
  nowIso: string,
): TravelPlan['participants'][number] {
  return {
    id,
    name,
    inviteCode: `home-${id}`,
    invitedAt: nowIso,
    acceptedAt: nowIso,
  };
}

/**
 * Iceland + Antigua + third trip for Travel Home visual QA.
 * Hero images resolve via `travelHomeFixtureHeroUris` in __DEV__.
 */
export function buildTravelHomeVisualTrips(
  nowIso = new Date().toISOString(),
): TravelPlan[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    TRAVEL_HOME_ANTIGUA_TRIP_ID,
    TRAVEL_HOME_ICELAND_TRIP_ID,
    TRAVEL_HOME_THIRD_TRIP_ID,
  } =
    require('@/features/travel/fixtures/travel-home') as typeof import('@/features/travel/fixtures/travel-home');

  const iceland: TravelPlan = {
    id: TRAVEL_HOME_ICELAND_TRIP_ID,
    title: 'Iceland',
    mode: 'flight',
    destination: 'Reykjavík, Iceland',
    startDate: '2026-09-08',
    endDate: '2026-09-14',
    notes: 'Travel Home visual fixture. Safe to overwrite.',
    itinerary: [],
    participants: [
      buildTravelHomeParticipant('p-home-alex', 'Alex Rivera', nowIso),
      buildTravelHomeParticipant('p-home-jordan', 'Jordan Lee', nowIso),
      buildTravelHomeParticipant('p-home-morgan', 'Morgan Blake', nowIso),
    ],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const antigua: TravelPlan = {
    id: TRAVEL_HOME_ANTIGUA_TRIP_ID,
    title: 'Antigua, Guatemala',
    mode: 'flight',
    destination: 'Antigua, Guatemala',
    startDate: '2026-09-22',
    endDate: '2026-09-27',
    notes: 'Travel Home visual fixture. Safe to overwrite.',
    itinerary: [],
    participants: [
      buildTravelHomeParticipant('p-home-casey', 'Casey Morgan', nowIso),
      buildTravelHomeParticipant('p-home-sam', 'Sam Quinn', nowIso),
      buildTravelHomeParticipant('p-home-riley', 'Riley Chen', nowIso),
      buildTravelHomeParticipant('p-home-avery', 'Avery Brooks', nowIso),
      buildTravelHomeParticipant('p-home-jamie', 'Jamie Patel', nowIso),
    ],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const third: TravelPlan = {
    id: TRAVEL_HOME_THIRD_TRIP_ID,
    title: 'Faroe Islands',
    mode: 'flight',
    destination: 'Tórshavn, Faroe Islands',
    startDate: '2026-10-04',
    endDate: '2026-10-10',
    notes: 'Travel Home visual fixture (below-fold third trip). Safe to overwrite.',
    itinerary: [],
    participants: [
      buildTravelHomeParticipant('p-home-taylor', 'Taylor Nguyen', nowIso),
    ],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  return [iceland, antigua, third];
}

export function buildAgentUiDemoTrip(
  nowIso = new Date().toISOString(),
): TravelPlan {
  return {
    id: AGENT_UI_DEMO_TRIP_ID,
    title: 'Agent UI Demo',
    mode: 'flight',
    origin: 'New York, NY',
    destination: 'Lisbon, Portugal',
    startDate: '2026-09-27',
    endDate: '2026-09-30',
    notes: 'Demo trip for agent navigation. Safe to overwrite.',
    itinerary: [
      {
        id: AGENT_UI_DEMO_FLIGHT_ID,
        kind: 'flight',
        title: 'UA 70',
        date: '2026-09-27',
        startMinutes: 18 * 60 + 30,
        durationMinutes: 420,
        flight: {
          airline: 'United',
          flightNumber: 'UA70',
          departureAirport: 'EWR',
          departureTerminal: 'C',
          departureGate: 'C71',
          arrivalAirport: 'LIS',
          arrivalTerminal: '1',
          arrivalGate: '18',
          confirmationCode: 'AGENTUI',
          passengerCount: 1,
          // Durable cloud marker — proves the View Confirmation control survives
          // normalize/sync (local file:// alone was previously stripped on pull).
          confirmationUris: [
            'ontrack-media:agent-ui/travel/demo-flight-confirmation.pdf',
          ],
        },
      },
      {
        // Seed per-leg terminals/gates so opening the demo never triggers a
        // live AeroDataBox enrichment just to paint the itinerary chips.
        id: AGENT_UI_DEMO_CONNECTING_FLIGHT_ID,
        kind: 'flight',
        title: 'UA 1907',
        date: '2026-09-30',
        startMinutes: 90,
        durationMinutes: 599,
        flight: {
          airline: 'United Airlines',
          flightNumber: 'UA1907',
          departureAirport: 'GUA',
          departureTerminal: '1',
          departureGate: '5',
          arrivalAirport: 'LGA',
          arrivalTerminal: 'B',
          arrivalGate: '22',
          confirmationCode: 'HF7K2Q',
          passengerCount: 1,
          legs: [
            {
              airline: 'United Airlines',
              flightNumber: 'UA1907',
              departureAirport: 'GUA',
              departureTerminal: '1',
              departureGate: '5',
              arrivalAirport: 'IAH',
              arrivalTerminal: 'C',
              arrivalGate: '41',
              aircraft: 'Boeing 737-800 Passenger',
              date: '2026-09-30',
              departureMinutes: 90,
              arrivalMinutes: 321,
              durationMinutes: 171,
              layoverMinutesAfter: 99,
            },
            {
              airline: 'United Airlines',
              flightNumber: 'UA1697',
              departureAirport: 'IAH',
              departureTerminal: 'C',
              departureGate: '12',
              arrivalAirport: 'LGA',
              arrivalTerminal: 'B',
              arrivalGate: '22',
              aircraft: 'Boeing 737 MAX 8',
              date: '2026-09-30',
              departureMinutes: 420,
              arrivalMinutes: 689,
              durationMinutes: 209,
            },
          ],
        },
      },
      {
        id: AGENT_UI_DEMO_STAY_ID,
        kind: 'stay',
        title: 'Centerhotel Miðgarður',
        date: '2026-09-27',
        startMinutes: 15 * 60,
        durationMinutes: 2 * 24 * 60,
        details: 'Laugavegur 120, 105 Reykjavík, Iceland',
        // No OTA booking URL — brand logo resolves dynamically from the hotel name.
        stay: {
          checkoutDate: '2026-09-29',
          checkoutMinutes: 11 * 60,
          confirmationCode: 'STAYDEMO',
        },
      },
      {
        id: AGENT_UI_DEMO_RENTAL_ID,
        kind: 'rental',
        title: 'Hertz Rental · Lisbon Airport (LIS)',
        date: '2026-09-27',
        startMinutes: 10 * 60 + 30,
        durationMinutes: 2 * 24 * 60 + 6 * 60,
        rental: {
          company: 'Hertz',
          confirmationCode: 'RENTALDEMO',
          pickupLocation: 'Lisbon Airport (LIS)',
          dropoffLocation: 'Lisbon Airport (LIS)',
          dropoffDate: '2026-09-29',
          dropoffMinutes: 16 * 60 + 30,
          vehicleClass: 'Compact',
        },
      },
    ],
    participants: [],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: nowIso,
  };
}

export function buildAgentUiDemoChecklist(nowIso = new Date().toISOString()): {
  list: TodoList;
  tasks: TodoTask[];
} {
  const list: TodoList = {
    id: AGENT_UI_DEMO_CHECKLIST_LIST_ID,
    name: 'Agent UI Checklist',
    kind: 'checklist',
    mode: 'private',
    role: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: nowIso,
  };
  const tasks: TodoTask[] = [
    {
      id: AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID,
      listId: list.id,
      title: 'Plan the weekend',
      completed: false,
      important: true,
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: nowIso,
      version: 1,
    },
    {
      id: AGENT_UI_DEMO_CHECKLIST_TASK_PACK_ID,
      listId: list.id,
      title: 'Pack the bag',
      completed: false,
      important: false,
      position: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: nowIso,
      version: 1,
    },
  ];
  return { list, tasks };
}

export function buildAgentUiDemoGrocery(nowIso = new Date().toISOString()): {
  list: TodoList;
  recipe: TodoRecipe;
  tasks: TodoTask[];
} {
  const list: TodoList = {
    id: AGENT_UI_DEMO_GROCERY_LIST_ID,
    name: 'Agent UI Grocery',
    kind: 'grocery',
    mode: 'private',
    role: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: nowIso,
  };
  const recipe: TodoRecipe = {
    id: AGENT_UI_DEMO_GROCERY_RECIPE_ID,
    listId: list.id,
    name: 'Demo Pasta',
    sourceKind: 'url',
    sourceUrl: 'https://example.com/demo-pasta',
    targetServings: 2,
    position: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: nowIso,
  };
  const tasks: TodoTask[] = [
    {
      id: AGENT_UI_DEMO_GROCERY_TASK_TOMATOES_ID,
      listId: list.id,
      recipeId: recipe.id,
      ingredientPosition: 0,
      ingredientName: 'Tomatoes',
      title: 'Tomatoes',
      quantityText: '4',
      unit: 'whole',
      completed: false,
      important: false,
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: nowIso,
      version: 1,
    },
    {
      id: AGENT_UI_DEMO_GROCERY_TASK_PASTA_ID,
      listId: list.id,
      recipeId: recipe.id,
      ingredientPosition: 1,
      ingredientName: 'Pasta',
      title: 'Pasta',
      quantityText: '12',
      unit: 'oz',
      completed: false,
      important: false,
      position: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: nowIso,
      version: 1,
    },
  ];
  return { list, recipe, tasks };
}

function upsertTodoFixtureLists(input: {
  lists: TodoList[];
  tasks: TodoTask[];
  recipes?: TodoRecipe[];
}): void {
  // Lazy require keeps agent-ui unit tests free of Zustand/AsyncStorage.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useTodos } = require('@/store/todos') as typeof import('@/store/todos');
  const listIds = new Set(input.lists.map((list) => list.id));
  const recipes = input.recipes ?? [];
  useTodos.setState((state) => ({
    lists: [
      ...state.lists.filter((list) => !listIds.has(list.id)),
      ...input.lists,
    ],
    tasks: [
      ...state.tasks.filter((task) => !listIds.has(task.listId)),
      ...input.tasks,
    ],
    recipes: [
      ...state.recipes.filter((recipe) => !listIds.has(recipe.listId)),
      ...recipes,
    ],
  }));
}

/** Live-account recovery from Documents — must not enter the Dev Mode sandbox. */
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

export function seedAgentUiFixture(
  name: string | undefined,
): AgentUiSeedResult | null {
  const fixture = normalizeFixtureName(name);
  if (!fixture) return null;

  // Async-only recovery path — use restoreTravelPlansFromDocuments() / agent-ui seed.
  if (fixture === 'travel-restore-documents') {
    return null;
  }

  // Snapshot + pause cloud push so demo data never lands on the live account.
  // Lazy require keeps pure fixture unit tests free of the controller graph.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ensureDevModeSandboxSync } =
    require('@/features/account/dev-mode-controller') as typeof import('@/features/account/dev-mode-controller');
  ensureDevModeSandboxSync();

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

  if (fixture === 'travel-home-empty') {
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

  if (fixture === 'checklist-demo') {
    const built = buildAgentUiDemoChecklist();
    upsertTodoFixtureLists({
      lists: [built.list],
      tasks: built.tasks,
    });
    return {
      fixture,
      primaryId: built.list.id,
      listId: built.list.id,
      taskId: AGENT_UI_DEMO_CHECKLIST_TASK_PLAN_ID,
    };
  }

  if (fixture === 'grocery-demo') {
    const built = buildAgentUiDemoGrocery();
    upsertTodoFixtureLists({
      lists: [built.list],
      tasks: built.tasks,
      recipes: [built.recipe],
    });
    return {
      fixture,
      primaryId: built.list.id,
      listId: built.list.id,
      recipeId: built.recipe.id,
      taskId: AGENT_UI_DEMO_GROCERY_TASK_TOMATOES_ID,
    };
  }

  if (fixture === 'health-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useHealth } = require('@/store/health') as typeof import('@/store/health');
    const health = useHealth.getState();
    const factorId = health.saveFactor({
      id: AGENT_UI_DEMO_HEALTH_FACTOR_ID,
      name: 'Work deadlines',
      category: 'situation',
      emotionIds: ['stressed'],
    });
    const moodEntryId = health.saveMoodEntry({
      id: AGENT_UI_DEMO_HEALTH_MOOD_ID,
      occurredAt: '2026-08-01T12:00:00.000Z',
      emotions: [{ emotionId: 'calm', intensity: 4 }],
      factorIds: [factorId],
      note: 'Stable agent fixture.',
      source: 'ontrack',
    });
    return {
      fixture,
      primaryId: moodEntryId,
      factorId,
      moodEntryId,
    };
  }

  if (fixture === 'vehicle-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vehiclesMod =
      require('@/store/vehicles') as typeof import('@/store/vehicles');
    const vehicle = vehiclesMod.createEmptyVehicle({
      id: AGENT_UI_DEMO_VEHICLE_ID,
      nickname: 'Demo Car',
      year: 2022,
      make: 'Honda',
      model: 'Civic',
      odometerMiles: 12000,
    });
    vehiclesMod.useVehicles.getState().saveVehicle(vehicle);
    return {
      fixture,
      primaryId: vehicle.id,
      vehicleId: vehicle.id,
    };
  }

  if (fixture === 'plants-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sample =
      require('@/features/plants/sample') as typeof import('@/features/plants/sample');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { usePlants } = require('@/store/plants') as typeof import('@/store/plants');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { todayKey } = require('@/utils/date') as typeof import('@/utils/date');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSchedule } =
      require('@/store/schedule') as typeof import('@/store/schedule');
    const plant = {
      ...sample.createSamplePlant(),
      wateringActivityId: AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
      // Fresh seed: no prior log so Undo appears only after Log Watering.
      wateringLogs: [] as [],
      lastWateredAt: undefined,
    };
    const reminderMinutes = plant.reminderMinutes ?? 9 * 60;
    const minMl = plant.carePlan?.watering?.minMl ?? 250;
    const maxMl = plant.carePlan?.watering?.maxMl ?? 400;
    useSchedule.getState().saveEvent({
      id: AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
      detailKind: 'plant',
      activity: {
        date: todayKey(),
        title: `Water ${plant.nickname}`,
        categoryId: 'plant',
        startMinutes: reminderMinutes,
        durationMinutes: 10,
        status: 'upcoming',
        photo: plant.photoUri,
        summary: `${Math.round(minMl)}–${Math.round(maxMl)} mL · check soil`,
        plantId: plant.id,
        careKind: 'watering',
      },
    });
    usePlants.setState((state) => ({
      plants: [
        plant,
        ...state.plants.filter((item) => item.id !== sample.SAMPLE_PLANT_ID),
      ],
      sampleVersion: Math.max(state.sampleVersion, sample.PLANT_SAMPLE_VERSION),
      sampleDismissed: false,
    }));
    return {
      fixture,
      primaryId: plant.id,
      plantId: plant.id,
      activityId: AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
    };
  }

  if (fixture === 'home-weather') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { usePreferences } =
      require('@/store/preferences') as typeof import('@/store/preferences');
    usePreferences.getState().setHomeLocation(AGENT_UI_DEMO_HOME_LOCATION);
    return {
      fixture,
      primaryId: AGENT_UI_DEMO_HOME_LOCATION,
    };
  }

  if (fixture === 'activity-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { todayKey } = require('@/utils/date') as typeof import('@/utils/date');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSchedule } =
      require('@/store/schedule') as typeof import('@/store/schedule');
    const activity = useSchedule.getState().saveEvent({
      id: AGENT_UI_DEMO_ACTIVITY_ID,
      detailKind: 'generic',
      activity: {
        title: 'Agent UI Mindfulness',
        categoryId: 'mindfulness',
        date: todayKey(),
        startMinutes: 9 * 60,
        durationMinutes: 30,
        status: 'upcoming',
        notes: 'Stable agent fixture.',
      },
    });
    return {
      fixture,
      primaryId: activity.id,
      activityId: activity.id,
    };
  }

  if (fixture === 'food-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { todayKey } = require('@/utils/date') as typeof import('@/utils/date');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSchedule } =
      require('@/store/schedule') as typeof import('@/store/schedule');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seedFoodDemoStores } =
      require('./fixtures-food') as typeof import('./fixtures-food');
    const { recipeId } = seedFoodDemoStores();

    const activity = useSchedule.getState().saveEvent({
      id: AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
      detailKind: 'food',
      activity: {
        title: 'Agent UI Meal',
        categoryId: 'food',
        date: todayKey(),
        startMinutes: 12 * 60,
        durationMinutes: 30,
        status: 'upcoming',
        notes: 'Stable agent meal fixture.',
      },
      meal: {
        activityId: AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
        mealType: 'lunch',
        name: 'Agent UI Meal',
        items: [],
      },
    });
    return {
      fixture,
      primaryId: activity.id,
      activityId: activity.id,
      recipeId,
    };
  }

  if (fixture === 'workouts-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { todayKey } = require('@/utils/date') as typeof import('@/utils/date');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSchedule } =
      require('@/store/schedule') as typeof import('@/store/schedule');
    const activity = useSchedule.getState().saveEvent({
      id: AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
      detailKind: 'gym',
      activity: {
        title: 'Agent UI Bench Press',
        categoryId: 'gym',
        date: todayKey(),
        startMinutes: 10 * 60,
        durationMinutes: 30,
        status: 'upcoming',
        summary: '1 exercise · 30 min',
        notes: 'Stable agent fixture.',
      },
      workout: {
        activityId: 'draft',
        type: 'strength',
        name: 'Agent UI Bench Press',
        exercises: [
          {
            id: AGENT_UI_DEMO_WORKOUT_EXERCISE_ID,
            name: 'Bench Press',
            icon: 'dumbbell.fill',
            restSeconds: 120,
            sets: [
              {
                id: AGENT_UI_DEMO_WORKOUT_SET_ID,
                reps: 8,
                weightKg: 0,
                done: false,
              },
            ],
          },
        ],
      },
    });
    return {
      fixture,
      primaryId: activity.id,
      activityId: activity.id,
    };
  }

  if (fixture === 'vision-board-demo') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const defaults =
      require('@/features/vision-board/defaults') as typeof import('@/features/vision-board/defaults');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sample =
      require('@/features/vision-board/sample') as typeof import('@/features/vision-board/sample');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useVisionBoard } =
      require('@/store/vision-board') as typeof import('@/store/vision-board');
    const at = '2026-01-01T00:00:00.000Z';
    useVisionBoard.getState().replaceVisionBoardData(
      defaults.createDefaultVisionBoardCategories(at),
      sample.createSampleVisionBoardItems(at),
      at,
      sample.VISION_BOARD_SAMPLE_VERSION,
    );
    return {
      fixture,
      primaryId: AGENT_UI_DEMO_VISION_CATEGORY_ID,
      categoryId: AGENT_UI_DEMO_VISION_CATEGORY_ID,
      itemId: AGENT_UI_DEMO_VISION_ITEM_ID,
    };
  }

  return null;
}

export function normalizeFixtureName(
  raw: string | undefined,
): AgentUiFixtureName | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (
    key === 'travel-demo' ||
    key === 'travel' ||
    key === 'demo' ||
    key === 'trip-agent-ui-demo'
  ) {
    return 'travel-demo';
  }
  if (
    key === 'travel-home' ||
    key === 'travel-home-visual' ||
    key === 'trip-travel-home-iceland'
  ) {
    return 'travel-home';
  }
  if (key === 'travel-home-empty' || key === 'travel-empty') {
    return 'travel-home-empty';
  }
  if (
    key === 'travel-restore-documents' ||
    key === 'travel-restore' ||
    key === 'restore-travel'
  ) {
    return 'travel-restore-documents';
  }
  if (
    key === 'checklist-demo' ||
    key === 'checklist' ||
    key === AGENT_UI_DEMO_CHECKLIST_LIST_ID
  ) {
    return 'checklist-demo';
  }
  if (
    key === 'grocery-demo' ||
    key === 'grocery' ||
    key === AGENT_UI_DEMO_GROCERY_LIST_ID
  ) {
    return 'grocery-demo';
  }
  if (
    key === 'health-demo' ||
    key === 'health' ||
    key === AGENT_UI_DEMO_HEALTH_MOOD_ID
  ) {
    return 'health-demo';
  }
  if (
    key === 'vehicle-demo' ||
    key === 'vehicle' ||
    key === AGENT_UI_DEMO_VEHICLE_ID
  ) {
    return 'vehicle-demo';
  }
  if (
    key === 'plants-demo' ||
    key === 'plants' ||
    key === 'plant' ||
    key === AGENT_UI_DEMO_PLANT_ID
  ) {
    return 'plants-demo';
  }
  if (
    key === 'activity-demo' ||
    key === 'activity' ||
    key === AGENT_UI_DEMO_ACTIVITY_ID
  ) {
    return 'activity-demo';
  }
  if (
    key === 'home-weather' ||
    key === 'today-weather' ||
    key === 'weather-home'
  ) {
    return 'home-weather';
  }
  if (
    key === 'food-demo' ||
    key === 'food' ||
    key === 'meal' ||
    key === AGENT_UI_DEMO_FOOD_ACTIVITY_ID
  ) {
    return 'food-demo';
  }
  if (
    key === 'workouts-demo' ||
    key === 'workouts' ||
    key === 'workout' ||
    key === AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID
  ) {
    return 'workouts-demo';
  }
  if (
    key === 'vision-board-demo' ||
    key === 'vision-board' ||
    key === 'vision' ||
    key === AGENT_UI_DEMO_VISION_CATEGORY_ID
  ) {
    return 'vision-board-demo';
  }
  return null;
}

/** Fixtures shown in Developer Hub / listed for routine seeding. */
export const AGENT_UI_FIXTURE_NAMES = [
  'travel-demo',
  'travel-home',
  'checklist-demo',
  'grocery-demo',
  'health-demo',
  'vehicle-demo',
  'plants-demo',
  'activity-demo',
  'home-weather',
  'food-demo',
  'workouts-demo',
  'vision-board-demo',
] as const;

/** Compact host-status detail for a seed result. */
export function formatAgentUiSeedDetail(seeded: AgentUiSeedResult): string {
  const parts: string[] = [`seeded ${seeded.fixture}`];
  if (seeded.planId) parts.push(`planId=${seeded.planId}`);
  if (seeded.flightItemId) parts.push(`flightId=${seeded.flightItemId}`);
  if (seeded.listId) parts.push(`listId=${seeded.listId}`);
  if (seeded.recipeId) parts.push(`recipeId=${seeded.recipeId}`);
  if (seeded.taskId) parts.push(`taskId=${seeded.taskId}`);
  if (seeded.factorId) parts.push(`factorId=${seeded.factorId}`);
  if (seeded.moodEntryId) parts.push(`moodEntryId=${seeded.moodEntryId}`);
  if (seeded.vehicleId) parts.push(`vehicleId=${seeded.vehicleId}`);
  if (seeded.plantId) parts.push(`plantId=${seeded.plantId}`);
  if (seeded.activityId) parts.push(`activityId=${seeded.activityId}`);
  if (seeded.categoryId) parts.push(`categoryId=${seeded.categoryId}`);
  if (seeded.itemId) parts.push(`itemId=${seeded.itemId}`);
  return parts.join(' ');
}

/** Reserved Today / schedule activity ids from agent-ui demo seeds. */
const AGENT_UI_DEMO_ACTIVITY_IDS = [
  AGENT_UI_DEMO_ACTIVITY_ID,
  AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
  AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
  AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
] as const;

const AGENT_UI_DEMO_TODO_LIST_IDS = [
  AGENT_UI_DEMO_CHECKLIST_LIST_ID,
  AGENT_UI_DEMO_GROCERY_LIST_ID,
] as const;

/**
 * Strip reserved agent-ui demo entities from local stores.
 * Safe for live accounts — these ids are never used by real user data.
 * Does not touch shared sample content (plant sample / vision-board sample).
 */
export function purgeAgentUiDemoFixtures(): void {
  // Lazy requires keep fixture unit tests free of the full store graph.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useTravel } = require('@/store/travel') as typeof import('@/store/travel');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useTodos } = require('@/store/todos') as typeof import('@/store/todos');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useSchedule } =
    require('@/store/schedule') as typeof import('@/store/schedule');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useHealth } = require('@/store/health') as typeof import('@/store/health');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useVehicles } =
    require('@/store/vehicles') as typeof import('@/store/vehicles');

  for (const tripId of AGENT_UI_RESERVED_TRIP_IDS) {
    if (useTravel.getState().plans.some((plan) => plan.id === tripId)) {
      useTravel.getState().removePlan(tripId);
    }
  }

  for (const listId of AGENT_UI_DEMO_TODO_LIST_IDS) {
    if (useTodos.getState().lists.some((list) => list.id === listId)) {
      useTodos.getState().deleteList(listId);
    }
  }

  for (const activityId of AGENT_UI_DEMO_ACTIVITY_IDS) {
    if (useSchedule.getState().activities.some((activity) => activity.id === activityId)) {
      useSchedule.getState().deleteActivity(activityId);
    }
  }

  const health = useHealth.getState();
  if (health.factors.some((factor) => factor.id === AGENT_UI_DEMO_HEALTH_FACTOR_ID)) {
    health.removeFactor(AGENT_UI_DEMO_HEALTH_FACTOR_ID);
  }
  if (health.moodEntries.some((entry) => entry.id === AGENT_UI_DEMO_HEALTH_MOOD_ID)) {
    health.removeMoodEntry(AGENT_UI_DEMO_HEALTH_MOOD_ID);
  }

  if (useVehicles.getState().vehicles.some((vehicle) => vehicle.id === AGENT_UI_DEMO_VEHICLE_ID)) {
    useVehicles.getState().removeVehicle(AGENT_UI_DEMO_VEHICLE_ID);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { purgeFoodDemoFixtures } =
    require('./fixtures-food') as typeof import('./fixtures-food');
  purgeFoodDemoFixtures();
}
