import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { AppIconName } from '@/design-system';
import { borders, radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';

import { FieldLeadingIcon } from './field-leading-icon';
import {
  fieldLeadingIconPlateSize,
  fieldLeadingIconRowStyle,
} from './field-leading-icon-style';
import { StackedFieldLabel } from './stacked-field-label';

/**
 * Tunables for stacked icon-field chrome.
 * Compact rows pin the label to the top of the icon plate and the
 * placeholder/value to the bottom so every field shares one vertical rhythm.
 */
export const stackedIconFieldLayout = {
  /** Gap between label and value when the column grows taller than the plate. */
  copyGap: 2,
  /**
   * Compact (single-line) rows size the text column to the icon plate and
   * space-between label/value so the placeholder sits on the plate bottom.
   */
  pinValueToIconBottom: true,
  /** Approx. chars before a single-line value is treated as wrapping/tall. */
  expandWrapChars: 48,
} as const;

/**
 * Multiline Inputs should stay pinned while empty/placeholder, and only expand
 * once the value actually grows past one line (Notes, auto-grow address, …).
 */
export function stackedIconFieldShouldExpand({
  multiline,
  value,
  styleMinHeight,
  oneLineHeight,
}: {
  multiline?: boolean;
  value?: string | null;
  styleMinHeight?: number;
  oneLineHeight: number;
}): boolean {
  if (!multiline) return false;
  const text = String(value ?? '');
  if (!text.trim()) return false;
  if (text.includes('\n')) return true;
  if (styleMinHeight != null && styleMinHeight > oneLineHeight + 2) return true;
  return text.length >= stackedIconFieldLayout.expandWrapChars;
}

/** Icon plate edge that fits caption + body so pin-to-edges does not clip. */
export function stackedIconFieldPlateSize({
  iconSize,
  s,
  withPlate,
  labelLineHeight,
  valueLineHeight,
  fontScale,
}: {
  iconSize: number;
  s: (n: number) => number;
  withPlate: boolean;
  labelLineHeight: number;
  valueLineHeight: number;
  fontScale: number;
}): number {
  const base = fieldLeadingIconPlateSize({ iconSize, s, withPlate });
  const stack = Math.ceil(
    labelLineHeight * Math.min(fontScale, 1.15)
      + valueLineHeight * Math.min(fontScale, 1.3),
  );
  return Math.max(base, stack);
}

export type StackedIconFieldProps = {
  /** Omit to render stacked label/value without a leading icon plate. */
  icon?: AppIconName | (string & {});
  stackedLabel: string;
  children: ReactNode;
  iconBackground?: string;
  iconColor?: string;
  fieldBackground?: string;
  /** Optional glass/hairline border around the field plate. */
  fieldBorderColor?: string;
  stackedLabelColor?: string;
  /** Align stacked label + value (`center` for short numeric fields). */
  stackedAlign?: 'start' | 'center';
  /**
   * When true, the text column may grow taller than the icon plate
   * (multiline notes / expanding address). Icon stays vertically centered.
   */
  expand?: boolean;
  minHeight?: number;
  borderRadius?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  gap?: number;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Shared icon + stacked label/value chrome for Input / DateField / TimeField /
 * Travel date range / similar sheet fields. Tweak {@link stackedIconFieldLayout}
 * to adjust placeholder ↔ icon-plate alignment globally.
 */
export function StackedIconField({
  icon,
  stackedLabel,
  children,
  iconBackground,
  iconColor,
  fieldBackground,
  fieldBorderColor,
  stackedLabelColor,
  stackedAlign = 'start',
  expand = false,
  minHeight,
  borderRadius = radii.lg,
  paddingHorizontal,
  paddingVertical,
  gap,
  trailing,
  style,
  contentStyle,
}: StackedIconFieldProps) {
  const { iconSizes, spacing, s, typography, fontScale } = useResponsive();
  const showIcon = Boolean(icon);
  const plate = stackedIconFieldPlateSize({
    iconSize: iconSizes.sm,
    s,
    withPlate: Boolean(iconBackground),
    labelLineHeight: typography.caption.lineHeight,
    valueLineHeight: typography.body.lineHeight,
    fontScale,
  });
  const pinToPlate =
    showIcon &&
    stackedIconFieldLayout.pinValueToIconBottom &&
    !expand &&
    stackedAlign === 'start';
  const centered = stackedAlign === 'center';

  return (
    <View
      style={[
        styles.row,
        fieldLeadingIconRowStyle({
          minHeight,
          borderRadius,
          borderCurve: 'continuous',
          borderWidth: fieldBorderColor ? borders.hairline : 0,
          borderColor: fieldBorderColor,
          paddingHorizontal: paddingHorizontal ?? spacing.md,
          paddingVertical: paddingVertical ?? spacing.sm,
          gap: showIcon ? (gap ?? spacing.sm) : 0,
          backgroundColor: fieldBackground,
          overflow: 'hidden',
        }),
        style,
      ]}>
      {showIcon ? (
        <FieldLeadingIcon
          name={icon!}
          backgroundColor={iconBackground}
          color={iconColor}
          size={plate}
        />
      ) : null}
      <View
        style={[
          styles.copy,
          pinToPlate ? { height: plate, gap: 0 } : { gap: stackedIconFieldLayout.copyGap },
          pinToPlate ? styles.copyPinned : styles.copyRelaxed,
          centered ? styles.copyCentered : null,
          contentStyle,
        ]}>
        <StackedFieldLabel
          color={stackedLabelColor}
          align={centered ? 'center' : 'start'}
          style={styles.label}>
          {stackedLabel}
        </StackedFieldLabel>
        <View
          style={[
            styles.value,
            centered ? styles.valueCentered : null,
            pinToPlate ? styles.valuePinned : null,
          ]}>
          {children}
        </View>
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
  },
  copy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  copyPinned: {
    justifyContent: 'space-between',
  },
  copyRelaxed: {
    justifyContent: 'center',
  },
  copyCentered: {
    alignItems: 'center',
  },
  label: {
    flexShrink: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  value: {
    flexShrink: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    // Keep TextInput / AppText value left edge flush with the stacked label.
    margin: 0,
    padding: 0,
  },
  valuePinned: {
    justifyContent: 'flex-end',
  },
  valueCentered: {
    alignItems: 'center',
  },
  trailing: {
    flexShrink: 0,
    alignSelf: 'center',
  },
});
