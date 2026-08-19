export interface TimeFieldProps {
  label?: string;
  /** Minutes from local midnight (0–1439), or null until a time is chosen. */
  value: number | null;
  onChange: (minutesFromMidnight: number) => void;
  disabled?: boolean;
  /** Shown when `value` is null. */
  placeholder?: string;
  /** Persistent label above the value (sheet stacked chrome). */
  stackedLabel?: string;
  iconBackground?: string;
  iconColor?: string;
  fieldBackground?: string;
  fieldBorderColor?: string;
  fieldBorderRadius?: number;
  stackedLabelColor?: string;
  placeholderColor?: string;
  showChevron?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function clampMinutesFromMidnight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  return Math.min(1439, Math.max(0, rounded));
}

export function minutesToDate(minutesFromMidnight: number): Date {
  const clamped = clampMinutesFromMidnight(minutesFromMidnight);
  const date = new Date(2000, 0, 1);
  date.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0);
  return date;
}

export function dateToMinutes(date: Date): number {
  return clampMinutesFromMidnight(date.getHours() * 60 + date.getMinutes());
}

/** Native time pickers pass `undefined` when the user cancels. */
export function minutesFromPickerDate(date: Date | undefined | null): number | undefined {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return undefined;
  return dateToMinutes(date);
}
