import {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutLeft,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import { easings, motion } from './motion';

const seenListItems = new Map<string, Set<string>>();

/**
 * First sight of a list is a page load — no enter. Later new ids enter.
 * Survives remount so tab/lazy reopen does not FadeInDown existing rows.
 */
export function nextListEnterIds(
  listKey: string,
  ids: readonly string[],
): Set<string> {
  const prev = seenListItems.get(listKey);
  if (!prev || prev.size === 0) {
    // Empty first paint (hydrate / lazy tab) must not FadeInDown existing rows
    // from below once ids arrive. First sight of real ids stays at rest.
    seenListItems.set(listKey, new Set(ids));
    return new Set();
  }
  const enter = new Set<string>();
  for (const id of ids) {
    if (!prev.has(id)) enter.add(id);
  }
  seenListItems.set(listKey, new Set(ids));
  return enter;
}

export function resetListEnterIds(listKey?: string) {
  if (listKey == null) seenListItems.clear();
  else seenListItems.delete(listKey);
}

/** Cap list stagger so long lists don't trickle in. */
export const LIST_STAGGER_MS = 36;
export const LIST_STAGGER_CAP = 6;

const reduce = ReduceMotion.System;

export function listEnterDelay(index: number): number {
  const safe = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return Math.min(safe, LIST_STAGGER_CAP) * LIST_STAGGER_MS;
}

/** Shared enter/exit/layout — prefer these over ad-hoc FadeInDown.duration(n). */
export function listEntering(index = 0) {
  return FadeInDown.delay(listEnterDelay(index))
    .duration(motion.layout)
    .easing(easings.enter)
    .reduceMotion(reduce);
}

export function listExiting() {
  return FadeOutLeft.duration(motion.fade)
    .easing(easings.exit)
    .reduceMotion(reduce);
}

export function listLayout() {
  return LinearTransition.duration(motion.layout).reduceMotion(reduce);
}

export function fadeEntering() {
  return FadeIn.duration(motion.fade)
    .easing(easings.enter)
    .reduceMotion(reduce);
}

export function fadeExiting() {
  return FadeOut.duration(motion.fade)
    .easing(easings.exit)
    .reduceMotion(reduce);
}

export function popoverEntering() {
  return FadeInDown.duration(motion.fade)
    .easing(easings.enter)
    .reduceMotion(reduce);
}

export function popoverExiting() {
  return FadeOutUp.duration(motion.fade)
    .easing(easings.exit)
    .reduceMotion(reduce);
}
