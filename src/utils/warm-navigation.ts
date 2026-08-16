import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';

export const WARM_HUB_HREF_CAP = 6;

const warmedKeys = new Set<string>();

function hrefKey(href: Href): string {
  return typeof href === 'string' ? href : JSON.stringify(href);
}

/** Prefetch a route once — no-ops if already warmed this session. */
export function warmHref(href: Href): boolean {
  const key = hrefKey(href);
  if (warmedKeys.has(key)) return false;
  warmedKeys.add(key);
  try {
    router.prefetch(href);
    return true;
  } catch {
    warmedKeys.delete(key);
    return false;
  }
}

/**
 * Stagger route prefetches after the current page transition so taps feel
 * instant without spiking the JS thread on land.
 */
export function warmHrefsAfterTransition(
  hrefs: Href[],
  gapMs = 140,
): () => void {
  const unique = hrefs.filter((href, index, list) => {
    const key = hrefKey(href);
    return list.findIndex((item) => hrefKey(item) === key) === index;
  });
  let cancelled = false;
  let index = 0;
  let gapTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelTransition = deferAfterPageTransition(() => {
    const step = () => {
      if (cancelled || index >= unique.length) return;
      warmHref(unique[index]!);
      index += 1;
      if (index < unique.length) {
        gapTimer = setTimeout(step, gapMs);
      }
    };
    step();
  });
  return () => {
    cancelled = true;
    cancelTransition();
    if (gapTimer) clearTimeout(gapTimer);
  };
}

/** Warm a hub’s likely next screens after the current page is at rest. */
export function useWarmHrefs(
  hrefs: readonly Href[],
  cap = WARM_HUB_HREF_CAP,
): void {
  const next = hrefs.slice(0, cap);
  const token = next.map(hrefKey).join('|');
  useEffect(() => {
    return warmHrefsAfterTransition(next);
    // token stands in for next — same hrefs, same warm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
}

/** Test helper — clears the session warm cache. */
export function resetWarmNavigationForTests(): void {
  warmedKeys.clear();
}
