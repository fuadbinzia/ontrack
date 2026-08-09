/**
 * Settle the auth constellation canvas size after layout.
 * Follow the live slot so a taller provider card (longer guest copy, locked
 * chrome) compresses the orbit instead of clipping the low sweep under the
 * plate. Ignore zero/negative pulses from transient measure frames.
 */
export function settleAuthCanvasExtent(prev: number, next: number): number {
  const rounded = Math.round(next);
  if (rounded <= 0) return prev;
  return rounded;
}
