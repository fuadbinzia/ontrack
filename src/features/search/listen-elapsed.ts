/** Re-render cadence for the dock dictation clock (8Hz, within 4–10Hz). */
export const LISTEN_TICK_MS = 125;

/**
 * Wall-clock elapsed from listen start. Expo `durationMillis` often sticks at 0,
 * so the visible timer must not depend on it.
 */
export function listenElapsedMs(
  startedAt: number | null | undefined,
  nowMs: number = Date.now(),
): number {
  if (startedAt == null || startedAt <= 0) return 0;
  return Math.max(0, nowMs - startedAt);
}
