import {
  AGENT_UI_DEMO_ACTIVITY_ID,
  AGENT_UI_DEMO_CHECKLIST_LIST_ID,
  AGENT_UI_DEMO_EVENT_ACTIVITY_ID,
  AGENT_UI_DEMO_FOOD_ACTIVITY_ID,
  AGENT_UI_DEMO_GROCERY_LIST_ID,
  AGENT_UI_DEMO_HEALTH_FACTOR_ID,
  AGENT_UI_DEMO_HEALTH_MOOD_ID,
  AGENT_UI_DEMO_PLANT_ID,
  AGENT_UI_DEMO_PLANT_WATERING_ACTIVITY_ID,
  AGENT_UI_DEMO_VEHICLE_ID,
  AGENT_UI_DEMO_VISION_CATEGORY_ID,
  AGENT_UI_DEMO_WORKOUT_ACTIVITY_ID,
  AGENT_UI_PUNTA_CANA_TRIP_ID,
  AGENT_UI_RESERVED_TRIP_IDS,
  type AgentUiFixtureName,
} from './fixtures-constants';
import { seedDomainAgentUiFixture } from './fixtures-seed-domains';
import {
  restoreTravelPlansFromDocuments,
  seedTravelAgentUiFixture,
} from './fixtures-seed-travel';
import type { AgentUiSeedResult } from './fixtures-seed-types';

export type { AgentUiSeedResult } from './fixtures-seed-types';
export { restoreTravelPlansFromDocuments } from './fixtures-seed-travel';

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

  if (
    fixture === 'travel-demo' ||
    fixture === 'travel-map-demo' ||
    fixture === 'travel-punta-cana' ||
    fixture === 'travel-home' ||
    fixture === 'travel-home-empty'
  ) {
    return seedTravelAgentUiFixture(fixture);
  }

  return seedDomainAgentUiFixture(fixture);
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
  if (key === 'travel-map-demo' || key === 'travel-map' || key === 'atlas-demo') {
    return 'travel-map-demo';
  }
  if (
    key === 'travel-punta-cana' ||
    key === 'punta-cana' ||
    key === 'punta' ||
    key === AGENT_UI_PUNTA_CANA_TRIP_ID
  ) {
    return 'travel-punta-cana';
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
    key === 'event-demo' ||
    key === 'event' ||
    key === AGENT_UI_DEMO_EVENT_ACTIVITY_ID
  ) {
    return 'event-demo';
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
  AGENT_UI_DEMO_EVENT_ACTIVITY_ID,
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
