import { useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import type { AppIconName } from '@/design-system';
import { glassMaterials, radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

import { AppText } from './app-text';
import { GlassPlate } from './glass-plate';
import { Symbol } from './symbol';
import { planWrappedSegmentGrid } from './segmented-control-layout';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: AppIconName;
  disabled?: boolean;
  testID?: string;
}

export interface SegmentedControlProps<T extends string> {
  label?: string;
  value: T;
  options: readonly SegmentedControlOption<T>[];
  onChange: (value: T) => void;
  wrap?: boolean;
  style?: ViewStyle;
}

function Segment<T extends string>({
  option,
  selected,
  onSelect,
  wrap,
  wrappedWidth,
}: {
  option: SegmentedControlOption<T>;
  selected: boolean;
  onSelect: () => void;
  wrap: boolean;
  wrappedWidth?: number;
}) {
  const theme = useTheme();
  const { spacing, layout, s } = useResponsive();
  const handlePress = () => {
    haptics.select();
    onSelect();
  };
  const agent = useAgentUiTarget(option.testID, {
    label: option.label,
    onPress: option.disabled ? undefined : handlePress,
  });
  const dark = theme.name === 'dark';

  return (
    <Pressable
      ref={agent.ref}
      testID={option.testID}
      onLayout={agent.onLayout}
      accessibilityRole="radio"
      accessibilityLabel={option.label}
      accessibilityState={{ checked: selected, disabled: option.disabled }}
      disabled={option.disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        wrap
          ? [styles.segmentWrapped, { width: wrappedWidth ?? '100%' }]
          : styles.segmentRow,
        {
          opacity: option.disabled ? 0.4 : pressed ? 0.72 : 1,
        },
      ]}>
      <GlassPlate
        airy={!selected}
        style={[
          styles.segment,
          {
            minHeight: layout.minTapTarget,
            minWidth: wrap ? s(104) : 0,
            gap: spacing.xs,
            paddingHorizontal: wrap ? spacing.lg : spacing.md,
            paddingVertical: wrap ? spacing.md : spacing.sm,
            borderColor: selected
              ? theme.accentPrimary
              : dark
                ? glassMaterials.border.dark
                : glassMaterials.border.light,
            borderWidth: selected ? 1 : StyleSheet.hairlineWidth,
          },
        ]}>
        {option.icon ? (
          <Symbol
            name={option.icon}
            size="sm"
            color={selected ? theme.accentPrimary : theme.textSecondary}
          />
        ) : null}
        {wrap ? (
          <AppText
            variant="body"
            color={selected ? 'accent' : 'primary'}
            bold={selected}
            numberOfLines={1}
            style={{ flexShrink: 1, minWidth: 0 }}>
            {option.label}
          </AppText>
        ) : (
          <AppText variant="callout" color={selected ? 'accent' : 'secondary'} fit>
            {option.label}
          </AppText>
        )}
      </GlassPlate>
    </Pressable>
  );
}

/** Shared radio-style choice control for filters, modes, and compact option sets. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  wrap = false,
  style,
}: SegmentedControlProps<T>) {
  const { spacing, s } = useResponsive();
  const [rowWidth, setRowWidth] = useState(0);
  const wrappedGrid = planWrappedSegmentGrid(
    options.length,
    rowWidth,
    spacing.sm,
    s(104),
  );
  return (
    <View style={[styles.root, { gap: spacing.sm }, style]}>
      {label ? (
        <AppText variant="overline" color="tertiary" fit>
          {label}
        </AppText>
      ) : null}
      <View
        accessibilityRole="radiogroup"
        onLayout={
          wrap
            ? (event) => {
                const nextWidth = event.nativeEvent.layout.width;
                setRowWidth((current) =>
                  Math.abs(current - nextWidth) < 0.5 ? current : nextWidth,
                );
              }
            : undefined
        }
        style={[styles.row, { gap: spacing.sm, flexWrap: wrap ? 'wrap' : 'nowrap' }]}>
        {options.map((option, index) => (
          <Segment
            key={option.value}
            option={option}
            selected={option.value === value}
            wrap={wrap}
            wrappedWidth={wrap ? wrappedGrid.widths[index] : undefined}
            onSelect={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  row: { flexDirection: 'row', width: '100%' },
  segment: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    zIndex: 1,
  },
  /** Single-row mode: share width and allow shrink-to-fit labels. */
  segmentRow: {
    flex: 1,
    minWidth: 0,
  },
  /**
   * Exact measured widths reserve the row's gaps before sizing each cell.
   */
  segmentWrapped: {
    flexGrow: 0,
    flexShrink: 0,
  },
});
