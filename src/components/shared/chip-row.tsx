import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppText, GlassPlate, fieldTitleCase } from '@/components/primitives';
import { borders, radii, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipRowProps<T extends string> {
  options: ChipOption<T>[];
  selected: T | T[];
  onSelect: (value: T) => void;
  scrollable?: boolean;
  testIDForOption?: (value: T) => string;
}

/** Horizontally-flowing selectable chips used in forms and onboarding. */
export function ChipRow<T extends string>({
  options,
  selected,
  onSelect,
  scrollable,
  testIDForOption,
}: ChipRowProps<T>) {
  const theme = useTheme();
  const isSelected = (v: T) =>
    Array.isArray(selected) ? selected.includes(v) : selected === v;

  const chips = options.map((option) => {
    const active = isSelected(option.value);
    const testID = testIDForOption?.(option.value);
    const select = () => {
      haptics.select();
      onSelect(option.value);
    };
    const chip = (
      <Pressable
        key={option.value}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={fieldTitleCase(option.label)}
        accessibilityState={{ selected: active }}
        onPress={select}
        style={styles.chipPressable}>
        <GlassPlate
          mist
          style={[
            styles.chip,
            {
              borderColor: active ? theme.accentPrimary : 'transparent',
              borderWidth: borders.thin,
            },
          ]}>
          <AppText variant="callout" color={active ? 'accent' : 'secondary'} fit>
            {fieldTitleCase(option.label)}
          </AppText>
        </GlassPlate>
      </Pressable>
    );
    return testID ? (
      <AgentTestId
        key={option.value}
        testID={testID}
        label={option.label}
        onPress={select}>
        {chip}
      </AgentTestId>
    ) : (
      chip
    );
  });

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {chips}
      </ScrollView>
    );
  }
  return (
    <ScrollView
      scrollEnabled={false}
      contentContainerStyle={[styles.row, styles.wrap]}>
      {chips}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  chipPressable: {
    minWidth: 0,
    maxWidth: 140,
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    minWidth: 0,
    justifyContent: 'center',
  },
});
