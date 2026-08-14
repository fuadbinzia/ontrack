export type DurationParts = {
  hours: number;
  minutes: number;
};

/** Splits a stored total-minute duration into the two values shown by duration fields. */
export function splitDurationMinutes(totalMinutes: number): DurationParts {
  const safeMinutes = Number.isFinite(totalMinutes)
    ? Math.max(0, Math.round(totalMinutes))
    : 0;

  return {
    hours: Math.floor(safeMinutes / 60),
    minutes: safeMinutes % 60,
  };
}

/** Converts explicit hour/minute field values back to storage minutes. */
export function durationPartsToMinutes(hours: string, minutes: string): number {
  if (!/^\d+$/.test(hours) || !/^\d+$/.test(minutes)) return Number.NaN;

  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes);
  if (!Number.isSafeInteger(parsedHours) || parsedMinutes > 59) return Number.NaN;

  return parsedHours * 60 + parsedMinutes;
}
