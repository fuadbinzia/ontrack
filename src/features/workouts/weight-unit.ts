import { deviceLocale } from '@/utils/date';
import { formatCompactNumber } from '@/utils/parse';

export type WorkoutWeightUnit = 'kg' | 'lb';

const POUNDS_PER_KILOGRAM = 2.2046226218;

/** Regions whose general measurement system uses U.S. or U.K. customary units. */
const POUND_REGIONS = new Set(['GB', 'LR', 'MM', 'US']);

function regionForLocale(locale: string): string | undefined {
  try {
    if (typeof Intl.Locale === 'function') {
      return new Intl.Locale(locale.replace('_', '-')).maximize().region?.toUpperCase();
    }
  } catch {
    // Fall through to a conservative BCP-47 region lookup.
  }

  const normalized = locale.replace('_', '-');
  const language = normalized.split('-')[0]?.toLowerCase();
  return normalized
    .split('-')
    .find((segment) => /^[A-Za-z]{2}$/.test(segment) && segment.toLowerCase() !== language)
    ?.toUpperCase();
}

export function workoutWeightUnitForLocale(locale: string): WorkoutWeightUnit {
  const region = regionForLocale(locale);
  return region && POUND_REGIONS.has(region) ? 'lb' : 'kg';
}

export function deviceWorkoutWeightUnit(): WorkoutWeightUnit {
  return workoutWeightUnitForLocale(deviceLocale());
}

export function kilogramsToWorkoutWeight(
  kilograms: number,
  unit: WorkoutWeightUnit,
): number {
  return unit === 'lb' ? kilograms * POUNDS_PER_KILOGRAM : kilograms;
}

export function workoutWeightToKilograms(
  value: number,
  unit: WorkoutWeightUnit,
): number {
  return unit === 'lb' ? value / POUNDS_PER_KILOGRAM : value;
}

export function workoutWeightInputValue(
  kilograms: number,
  unit: WorkoutWeightUnit,
): string {
  return formatCompactNumber(kilogramsToWorkoutWeight(kilograms, unit));
}

export function workoutWeightLabel(unit: WorkoutWeightUnit): string {
  return `Weight (${unit})`;
}

