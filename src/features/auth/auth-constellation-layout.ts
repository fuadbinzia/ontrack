/**
 * Auth constellation geometry — keep hero copy and the low orbit sweep apart.
 * Fractions are of canvas height unless noted.
 */

export type AuthOrbitNode = {
  tab: string;
  x: number;
  y: number;
  dropWhenCompact?: boolean;
};

/**
 * A top sweep, a right column, and a low sweep around the planet. The copy
 * block owns `COPY_TOP … COPY_TOP + copy height`, so the top row stays above
 * it and the low sweep stays below it.
 */
export const AUTH_ORBIT_NODES: readonly AuthOrbitNode[] = [
  { tab: 'social', x: 0.34, y: 0.085 },
  { tab: 'calendar', x: 0.545, y: 0.062 },
  { tab: 'travel', x: 0.755, y: 0.068 },
  { tab: 'workouts', x: 0.865, y: 0.25 },
  { tab: 'food', x: 0.878, y: 0.435 },
  { tab: 'health', x: 0.855, y: 0.625, dropWhenCompact: true },
  // Low sweep sits below the copy clear-line (see `authCopyMaxHeightFrac`).
  // Keep centres high enough that the well+label still clears the provider card.
  { tab: 'games', x: 0.245, y: 0.855, dropWhenCompact: true },
  { tab: 'to-do', x: 0.415, y: 0.875 },
  { tab: 'vision-board', x: 0.595, y: 0.878 },
  { tab: 'vehicles', x: 0.775, y: 0.855 },
];

export const AUTH_COPY_TOP = 0.2;
export const AUTH_COPY_WIDTH = 0.58;

/** Full-size copy reference height; shorter canvases scale type down. */
export const AUTH_COPY_BASE_HEIGHT = 390;

/** Breathing room + orbit sway so a left-arc node cannot kiss the intro. */
export const AUTH_COPY_CLEAR_PAD = 0.045;

/** Nodes at/below this Y own the low sweep (Games → Vehicles). */
const LOW_SWEEP_Y = 0.7;

export function authLowSweepMinY(
  nodes: readonly AuthOrbitNode[] = AUTH_ORBIT_NODES,
): number {
  const ys = nodes.filter((node) => node.y >= LOW_SWEEP_Y).map((node) => node.y);
  return ys.length ? Math.min(...ys) : 1;
}

/**
 * Max copy block height as a canvas fraction: from `COPY_TOP` down to the
 * top of the highest low-sweep well, minus pad.
 */
export function authCopyMaxHeightFrac(
  wellFrac: number,
  nodes: readonly AuthOrbitNode[] = AUTH_ORBIT_NODES,
): number {
  const wellTop = authLowSweepMinY(nodes) - wellFrac / 2;
  return Math.max(0.22, wellTop - AUTH_COPY_CLEAR_PAD - AUTH_COPY_TOP);
}
