import { useEffect, useRef } from 'react';

import { withoutGuestDirtyTracking } from '@/features/auth/guest-dirty-tracking';
import { useSchedule } from '@/store/schedule';
import { deferUntilIdle } from '@/utils/defer-until-idle';

/** Upgrades user-added meal photos once after persisted state has loaded. */
export function useMealPhotoMigration(enabled: boolean) {
  const started = useRef(false);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    let cancelled = false;

    const migrate = async () => {
      const {
        CURRENT_MEAL_PHOTO_PROCESSING_VERSION,
        enhanceMealPhoto,
      } = await import('@/services/nutrition/client');
      if (cancelled) return;
      const state = useSchedule.getState();
      const pending = state.meals.filter((meal) =>
        typeof meal.photo === 'string' &&
        meal.photoProcessingVersion !== CURRENT_MEAL_PHOTO_PROCESSING_VERSION,
      );

      for (const meal of pending) {
        if (cancelled || typeof meal.photo !== 'string') return;
        const sourcePhoto = meal.photo;
        try {
          const enhanced = await enhanceMealPhoto(
            meal.originalPhoto ?? sourcePhoto,
            meal.name,
            `meal-${meal.activityId}-v${CURRENT_MEAL_PHOTO_PROCESSING_VERSION}`,
          );
          if (cancelled) return;
          withoutGuestDirtyTracking(() => {
            useSchedule.getState().setProcessedMealPhoto(
              meal.activityId,
              enhanced.photoUri,
              meal.originalPhoto ?? sourcePhoto,
              enhanced.version,
            );
          });
        } catch {
          // Keep the original usable photo. A future app launch can retry.
        }
      }
    };

    const cancelIdle = deferUntilIdle(() => {
      if (!cancelled) void migrate();
    });
    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [enabled]);
}
