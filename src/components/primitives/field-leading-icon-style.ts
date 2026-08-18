import type { ViewStyle } from 'react-native';

/**
 * Row layout for any control that hosts a leading field icon + label/value.
 * Leading icons must always be vertically centered in the field — never
 * top-aligned or nudged with paddingTop on stacked chrome.
 */
export function fieldLeadingIconRowStyle(
  overrides?: Omit<ViewStyle, 'alignItems' | 'flexDirection'>,
): ViewStyle {
  return {
    ...overrides,
    flexDirection: 'row',
    alignItems: 'center',
  };
}

/**
 * Optically center the first line inside an icon+multiline chrome row.
 *
 * Do not vertically center the TextInput itself: iOS contentSize jitters a
 * few pixels on each letter before wrap, and alignItems/alignSelf center
 * turns that into a caret refresh on line 1.
 */
export function iconMultilineOpticalPad(
  rowMinHeight: number,
  oneLineHeight: number,
): number {
  if (rowMinHeight <= 0 || oneLineHeight <= 0) return 0;
  return Math.max(0, (rowMinHeight - oneLineHeight) / 2);
}

/** Square plate size for `FieldLeadingIcon` (with or without tint background). */
export function fieldLeadingIconPlateSize({
  iconSize,
  s,
  withPlate,
}: {
  iconSize: number;
  s: (n: number) => number;
  withPlate: boolean;
}): number {
  return withPlate ? Math.max(iconSize + 10, s(32)) : iconSize;
}

/** Minimum height for a stacked label + value at the active Dynamic Type scale. */
export function stackedFieldMinHeight({
  baseMinHeight,
  fontScale,
  labelLineHeight,
  valueLineHeight,
  verticalPadding,
  gap = 2,
}: {
  baseMinHeight: number;
  fontScale: number;
  labelLineHeight: number;
  valueLineHeight: number;
  verticalPadding: number;
  gap?: number;
}): number {
  const labelScale = Math.min(fontScale, 1.15);
  const valueScale = Math.min(fontScale, 1.3);
  return Math.max(
    baseMinHeight,
    Math.ceil(
      labelLineHeight * labelScale
        + valueLineHeight * valueScale
        + verticalPadding * 2
        + gap,
    ),
  );
}
