/** Cap stagger so long catalogs still settle quickly. */
export const ROW_ENTER_STAGGER_MS = 48;
export const ROW_ENTER_STAGGER_MAX = 10;

export const TRACKER_ROW_HIDDEN_POSE = {
  scale: 0.82,
  translateY: 20,
  opacity: 0,
} as const;

export const TRACKER_ROW_REST_POSE = {
  scale: 1,
  translateY: 0,
  opacity: 1,
} as const;

/** Page open stays at rest — never hide then bounce existing rows. */
export function trackerRowMountPose(
  _reduceMotion?: boolean | null,
): typeof TRACKER_ROW_REST_POSE {
  return TRACKER_ROW_REST_POSE;
}

/** Dragging holds rest so releasing a row does not restart the bounce. */
export function trackerRowDragPose(): typeof TRACKER_ROW_REST_POSE {
  return TRACKER_ROW_REST_POSE;
}

export function trackerRowEnterDelay(index: number): number {
  return Math.min(Math.max(0, index), ROW_ENTER_STAGGER_MAX) * ROW_ENTER_STAGGER_MS;
}
