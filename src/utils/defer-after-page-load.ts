import { InteractionManager } from 'react-native';

import { motion } from '@/design-system';

import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';

/**
 * Run work only after the current route has settled AND interactions/idle clear.
 *
 * Use for bottom-nav work that would compete with the destination tab’s first
 * paint (recency track remount, neighbor preload, agent tab registration).
 * Tap selection springs the rail immediately; this helper only rebases order
 * after idle so neighbors reshuffle without stalling the page. Unlike
 * `deferUntilIdle`, there is no short fallback — we wait for a real idle after
 * the page transition window.
 */
export function deferAfterPageLoad(
  task: () => void | Promise<void>,
  pageDelayMs: number = motion.page,
): () => void {
  let cancelled = false;
  let idleHandle: { cancel?: () => void } | undefined;

  const cancelPage = deferAfterPageTransition(() => {
    if (cancelled) return;
    idleHandle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      void Promise.resolve(task());
    });
  }, pageDelayMs);

  return () => {
    cancelled = true;
    cancelPage();
    idleHandle?.cancel?.();
  };
}
