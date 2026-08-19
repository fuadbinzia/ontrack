import type { VehicleMaintenanceSchedule } from '@/features/vehicles/types';
import { addCalendarMonths, isDateKey } from '@/utils/date';

/** Approximate next due miles from last service + interval. */
export function nextDueMiles(
  schedule: Pick<VehicleMaintenanceSchedule, 'intervalMiles' | 'lastDoneMiles'>,
  currentMiles?: number,
): number | undefined {
  if (!schedule.intervalMiles) return undefined;
  const base = schedule.lastDoneMiles ?? currentMiles;
  if (base === undefined) return schedule.intervalMiles;
  return base + schedule.intervalMiles;
}

/** Next due calendar date from lastDoneAt + intervalMonths (local YYYY-MM-DD). */
export function nextDueDate(
  schedule: Pick<VehicleMaintenanceSchedule, 'intervalMonths' | 'lastDoneAt'>,
): string | undefined {
  if (!schedule.intervalMonths || !schedule.lastDoneAt || !isDateKey(schedule.lastDoneAt)) {
    return undefined;
  }
  return addCalendarMonths(schedule.lastDoneAt, schedule.intervalMonths);
}

export function isMaintenanceDue(
  schedule: VehicleMaintenanceSchedule,
  currentMiles: number | undefined,
  todayKey: string,
): boolean {
  const dueMiles = nextDueMiles(schedule, currentMiles);
  if (dueMiles !== undefined && currentMiles !== undefined && currentMiles >= dueMiles) {
    return true;
  }
  const dueDate = nextDueDate(schedule);
  return Boolean(dueDate && dueDate <= todayKey);
}
