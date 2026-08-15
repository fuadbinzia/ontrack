export const CORE_TRACKER_ROUTES = new Set([
  'overview',
  '(today)',
  'calendar',
  'to-do',
  'social',
  'insights',
  'profile',
]);

export type TrackerPresenceInput = {
  mealCount: number;
  gymActivityCount: number;
  plantCount: number;
  travelPlanCount: number;
  visionItemCount: number;
  vehicleCount: number;
  healthEntryCount: number;
  financeRecordCount: number;
  journalBlockCount: number;
};

export function trackerRouteHasPresence(
  routeName: string,
  input: TrackerPresenceInput,
): boolean {
  if (CORE_TRACKER_ROUTES.has(routeName)) return true;
  switch (routeName) {
    case 'food':
      return input.mealCount > 0;
    case 'workouts':
      return input.gymActivityCount > 0;
    case 'plants':
      return input.plantCount > 0;
    case 'travel':
      return input.travelPlanCount > 0;
    case 'vision-board':
      return input.visionItemCount > 0;
    case 'vehicles':
      return input.vehicleCount > 0;
    case 'health':
      return input.healthEntryCount > 0;
    case 'finance':
      return input.financeRecordCount > 0;
    case 'journal':
      return input.journalBlockCount > 0;
    case 'games':
      return false;
    default:
      return true;
  }
}

export function visibleMoreRoutes(
  others: readonly string[],
  input: TrackerPresenceInput,
): string[] {
  return others.filter((name) => trackerRouteHasPresence(name, input));
}
