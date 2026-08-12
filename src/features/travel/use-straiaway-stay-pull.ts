import { useEffect, useRef } from 'react';

import { useAuthSession } from '@/features/auth/auth-provider';
import { applyStayPackagesToPlan } from '@/features/travel/stay-package';
import type { TravelPlan } from '@/features/travel/types';
import { getStraiawayStatus, pullStraiawayStays } from '@/services/partner/straiaway';
import { useTravel } from '@/store/travel';

const PULL_DEBOUNCE_MS = 1_200;

/** When StraiAway is linked, pull StayPackages after the trip is focused. */
export function useStraiawayStayPull(plan: TravelPlan | undefined) {
  const { isGuest } = useAuthSession();
  const savePlan = useTravel((state) => state.savePlan);
  const lastKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!plan || isGuest) return;
    const key = `${plan.id}:${plan.updatedAt}`;
    if (lastKey.current === key) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const status = await getStraiawayStatus();
          if (!status.connected || cancelled) return;
          const { stays } = await pullStraiawayStays();
          if (cancelled || !stays.length) return;
          const current = useTravel.getState().plans.find((item) => item.id === plan.id);
          if (!current) return;
          const next = applyStayPackagesToPlan(current, stays);
          if (!next) return;
          lastKey.current = `${next.id}:${next.updatedAt}`;
          savePlan(next);
        } catch {
          /* optional pull — stay local if StraiAway is unreachable */
        }
      })();
    }, PULL_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isGuest, plan, savePlan]);
}
