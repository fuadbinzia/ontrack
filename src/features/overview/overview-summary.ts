import type { FinanceRecurringBill } from '@/features/finance/types';
import type { TravelPlan } from '@/features/travel/types';
import type { Vehicle } from '@/features/vehicles/types';
import { isMaintenanceDue } from '@/features/vehicles/maintenance-due';
import type { Activity, Plant } from '@/types/models';
import { formatMinutes } from '@/utils/date';

export type OverviewAttentionItem = {
  key: string;
  label: string;
};

function dateComparableValue(dateKey: string): number {
  const normalized = dateKey.trim().match(/^\d{4}-\d{1,2}-\d{1,2}/)?.[0];
  if (!normalized) return Number.NaN;
  const [year, month, day] = normalized.split('-').map(Number);
  if ([year, month, day].some((value) => !Number.isFinite(value))) {
    return Number.NaN;
  }
  return Date.UTC(year, month - 1, day);
}

function compareDateKeys(left: string, right: string): number {
  const leftValue = dateComparableValue(left);
  const rightValue = dateComparableValue(right);

  if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
    return leftValue - rightValue || left.localeCompare(right);
  }

  if (Number.isFinite(leftValue)) return -1;
  if (Number.isFinite(rightValue)) return 1;
  return left.localeCompare(right);
}

export function activityAttentionKey(activity: Activity): string {
  return `activity:${activity.id}:${activity.updatedAt}`;
}

export function overviewAttentionItems(input: {
  activities: readonly Activity[];
  overdueBills: readonly FinanceRecurringBill[];
  duePlants: readonly Plant[];
  vehicles: readonly Vehicle[];
  dateKey: string;
}): OverviewAttentionItem[] {
  const activityItems = input.activities.map((activity) =>
    activity.allDay
      ? {
          key: activityAttentionKey(activity),
          label: `${activity.title} · All day`,
        }
      : {
          key: activityAttentionKey(activity),
          label: `${activity.title} · ${formatMinutes(activity.startMinutes)}`,
        },
  );
  const billItems = input.overdueBills.map((bill) => ({
    key: `bill:${bill.id}:${bill.nextDue}`,
    label: `${bill.name} · Bill due`,
  }));
  const plantItems = input.duePlants.map((plant) => ({
    key: `plant:${plant.id}:${plant.nextWateringAt}`,
    label: `${plant.nickname} · Watering due`,
  }));
  const maintenanceItems = input.vehicles.flatMap((vehicle) =>
    vehicle.maintenanceSchedules
      .filter((schedule) =>
        isMaintenanceDue(schedule, vehicle.odometerMiles, input.dateKey),
      )
      .map((schedule) => ({
        key: `vehicle:${vehicle.id}:${schedule.id}:${schedule.updatedAt}`,
        label: `${vehicle.nickname} · ${schedule.title} due`,
      })),
  );

  return [...activityItems, ...billItems, ...plantItems, ...maintenanceItems];
}

export function remainingActivities(
  activities: readonly Activity[],
  dateKey: string,
  minuteOfDay: number,
): Activity[] {
  return activities
    .filter(
      (activity) =>
        activity.date === dateKey &&
        activity.status !== 'completed' &&
        activity.status !== 'skipped' &&
        (activity.allDay ||
          activity.startMinutes + activity.durationMinutes >= minuteOfDay),
    )
    .sort(
      (a, b) =>
        Number(Boolean(b.allDay)) - Number(Boolean(a.allDay)) ||
        a.startMinutes - b.startMinutes,
    );
}

export function nextTravelPlan(
  plans: readonly TravelPlan[],
  dateKey: string,
): TravelPlan | undefined {
  const today = dateComparableValue(dateKey);
  if (!Number.isFinite(today)) return undefined;

  return [...plans]
    .filter((plan) => {
      const planEnd = dateComparableValue(plan.endDate);
      return Number.isFinite(planEnd) ? planEnd >= today : false;
    })
    .sort((a, b) => compareDateKeys(a.startDate, b.startDate))[0];
}

export function upcomingBills(
  bills: readonly FinanceRecurringBill[],
  dateKey: string,
): FinanceRecurringBill[] {
  const today = dateComparableValue(dateKey);
  if (!Number.isFinite(today)) return [];

  return bills
    .filter(
      (bill) =>
        bill.active && Number.isFinite(dateComparableValue(bill.nextDue))
          ? dateComparableValue(bill.nextDue) >= today
          : false,
    )
    .sort((a, b) => compareDateKeys(a.nextDue, b.nextDue));
}

export function plantsDue(plants: readonly Plant[], dateKey: string): Plant[] {
  return plants.filter((plant) => plant.nextWateringAt.slice(0, 10) <= dateKey);
}

export function maintenanceDueCount(
  vehicles: readonly Vehicle[],
  dateKey: string,
): number {
  return vehicles.reduce(
    (count, vehicle) =>
      count +
      vehicle.maintenanceSchedules.filter((schedule) =>
        isMaintenanceDue(schedule, vehicle.odometerMiles, dateKey),
      ).length,
    0,
  );
}
