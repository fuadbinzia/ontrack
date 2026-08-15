import { useMemo } from 'react';

import { gymCategoryIds } from '@/constants/categories';
import { useFinance } from '@/store/finance';
import { useMealPlan } from '@/store/food-meal-plan';
import { useHealth } from '@/store/health';
import { useJournal } from '@/store/journal';
import { usePlants } from '@/store/plants';
import { useSchedule } from '@/store/schedule';
import { useTravel } from '@/store/travel';
import { useVehicles } from '@/store/vehicles';
import { useVisionBoard } from '@/store/vision-board';

import {
  type TrackerPresenceInput,
  visibleMoreRoutes,
} from './tracker-presence';

export function useTrackerPresenceInput(): TrackerPresenceInput {
  const meals = useSchedule((state) => state.meals);
  const activities = useSchedule((state) => state.activities);
  const categories = useSchedule((state) => state.categories);
  const mealPlanEntries = useMealPlan((state) => state.entries);
  const plants = usePlants((state) => state.plants);
  const plans = useTravel((state) => state.plans);
  const visionItems = useVisionBoard((state) => state.items);
  const vehicles = useVehicles((state) => state.vehicles);
  const healthSummaries = useHealth((state) => state.dailySummaries);
  const moodEntries = useHealth((state) => state.moodEntries);
  const bills = useFinance((state) => state.bills);
  const transactions = useFinance((state) => state.transactions);
  const accounts = useFinance((state) => state.accounts);
  const buckets = useFinance((state) => state.buckets);
  const journalPages = useJournal((state) => state.pages);

  return useMemo(() => {
    const gymIds = gymCategoryIds(categories);
    return {
      mealCount: meals.length + mealPlanEntries.length,
      gymActivityCount: activities.filter((activity) =>
        gymIds.has(activity.categoryId),
      ).length,
      plantCount: plants.length,
      travelPlanCount: plans.length,
      visionItemCount: visionItems.length,
      vehicleCount: vehicles.length,
      healthEntryCount: healthSummaries.length + moodEntries.length,
      financeRecordCount:
        bills.length + transactions.length + accounts.length + buckets.length,
      journalBlockCount: journalPages.reduce(
        (count, page) => count + page.blocks.length,
        0,
      ),
    };
  }, [
    accounts.length,
    activities,
    bills.length,
    buckets.length,
    categories,
    healthSummaries.length,
    journalPages,
    mealPlanEntries.length,
    meals.length,
    moodEntries.length,
    plans.length,
    plants.length,
    transactions.length,
    vehicles.length,
    visionItems.length,
  ]);
}

export function useVisibleMoreRoutes(others: readonly string[]): string[] {
  const input = useTrackerPresenceInput();
  return useMemo(() => visibleMoreRoutes(others, input), [input, others]);
}
