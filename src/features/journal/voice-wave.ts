/** Live recording wave: metering dB → bar levels for the composer pill. */

export const WAVE_BAR_COUNT = 28;

/** Quiet-room floor so the wave breathes instead of flatlining. */
export const WAVE_SILENCE_LEVEL = 0.12;

const WAVE_DB_FLOOR = -55;
const WAVE_DB_CEILING = -8;

/** Recorder metering is negative dBFS (0 = clipping, ~-160 = silence). */
export function meteringToWaveLevel(db: number | null | undefined): number {
  if (typeof db !== 'number' || !Number.isFinite(db)) return WAVE_SILENCE_LEVEL;
  const normalized = (db - WAVE_DB_FLOOR) / (WAVE_DB_CEILING - WAVE_DB_FLOOR);
  return Math.min(1, Math.max(WAVE_SILENCE_LEVEL, normalized));
}

/** Append the newest level, keeping only the most recent `capacity` samples. */
export function pushWaveSample(
  samples: readonly number[],
  level: number,
  capacity = WAVE_BAR_COUNT,
): number[] {
  const next = [...samples, level];
  return next.length > capacity ? next.slice(next.length - capacity) : next;
}
