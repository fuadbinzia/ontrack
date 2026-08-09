import { useAddons } from '@/store/addons';
import { useAgents } from '@/store/agents';
import { useAuthAccess } from '@/store/auth-access';
import { useMealPlan } from '@/store/food-meal-plan';
import { usePantry } from '@/store/food-pantry';
import { useFoodProfile } from '@/store/food-profile';
import { useRecipes } from '@/store/food-recipes';
import { usePlants } from '@/store/plants';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { useTodos } from '@/store/todos';
import { useTravel } from '@/store/travel';
import { useVehicles } from '@/store/vehicles';
import { useVisionBoard } from '@/store/vision-board';

import { isGuestDirtyTrackingSuppressed } from './guest-dirty-tracking';

/**
 * Subscribe local-first stores so guest edits mark `guestDataDirty` for the
 * upgrade conflict path. Seed/migration writes must use
 * `withoutGuestDirtyTracking` instead.
 */
export function subscribeGuestDirtyStores(): () => void {
  const mark = () => {
    if (!isGuestDirtyTrackingSuppressed()) {
      useAuthAccess.getState().markGuestDataDirty();
    }
  };
  const unsubscribers = [
    usePreferences.subscribe(mark),
    useSchedule.subscribe(mark),
    usePlants.subscribe(mark),
    useAddons.subscribe(mark),
    useAgents.subscribe(mark),
    useTravel.subscribe(mark),
    useTodos.subscribe(mark),
    useVehicles.subscribe(mark),
    useVisionBoard.subscribe(mark),
    useFoodProfile.subscribe(mark),
    usePantry.subscribe(mark),
    useRecipes.subscribe(mark),
    useMealPlan.subscribe(mark),
  ];
  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
