import type { MutableRefObject } from 'react';

import { getDestinationCurrentWeather } from '@/features/travel/weather/provider';
import type { TemperatureUnit } from '@/features/travel/weather/types';
import { haptics } from '@/utils/haptics';

/**
 * Persist first, then optionally normalize via Open-Meteo.
 * Weather lookup failure must not wipe a user-authored place.
 */
async function normalizePlaceLabel(
  raw: string,
  unit: TemperatureUnit,
): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const weather = await getDestinationCurrentWeather(trimmed, unit);
    const label = weather.locationLabel.trim();
    return label || trimmed;
  } catch {
    return trimmed;
  }
}

export type PersistPlaceLabelInput = {
  raw: string;
  getSaved: () => string;
  commit: (value: string) => void;
  onUnchanged?: (trimmed: string, saved: string) => void;
  genRef: MutableRefObject<number>;
  setSaving: (saving: boolean) => void;
  unit: TemperatureUnit;
  setError: (error: string | undefined) => void;
  /**
   * Device-resolved places are already exact. Re-geocoding their text can land
   * on a same-named town in another state, so skip normalization for them.
   */
  skipNormalize?: boolean;
};

/** Commit immediately, then normalize when non-empty (shared by Home / Current). */
export async function persistPlaceLabel(input: PersistPlaceLabelInput): Promise<void> {
  const trimmed = input.raw.trim();
  const saved = input.getSaved();
  if (trimmed === saved) {
    input.setError(undefined);
    input.onUnchanged?.(trimmed, saved);
    return;
  }

  input.commit(trimmed);
  input.setError(undefined);
  if (!trimmed || input.skipNormalize) {
    haptics.tap();
    return;
  }

  const gen = ++input.genRef.current;
  input.setSaving(true);
  haptics.tap();
  try {
    const normalized = await normalizePlaceLabel(trimmed, input.unit);
    if (gen !== input.genRef.current) return;
    if (normalized !== trimmed) input.commit(normalized);
    haptics.success();
  } finally {
    if (gen === input.genRef.current) input.setSaving(false);
  }
}
