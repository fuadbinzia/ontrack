import { Pressable, StyleSheet } from 'react-native';

import { AppText, Symbol } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { ScheduledMeal } from '@/store/food-selectors';
import { formatMinutes } from '@/utils/date';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { formatCount } from '@/utils/grammar';
import { haptics } from '@/utils/haptics';

export function scheduledMealCalories(entry: ScheduledMeal): number {
  return Math.round(
    entry.meal.items.reduce((sum, item) => sum + item.calories, 0),
  );
}

/** Time · name · kcal row into the existing food detail route. */
export function ScheduledMealRow({
  entry,
  testID,
  onPress,
}: {
  entry: ScheduledMeal;
  testID: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { spacing, layout, s } = useResponsive();
  const name = entry.meal.name || entry.activity.title;
  const time = formatMinutes(entry.activity.startMinutes);
  const calories = scheduledMealCalories(entry);
  const handlePress = () => {
    haptics.select();
    onPress();
  };
  const agent = useAgentUiTarget(testID, { label: name, onPress: handlePress });

  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${time}${calories > 0 ? `, ${formatCount(calories, 'calorie')}` : ''}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        { minHeight: layout.minTapTarget, gap: spacing.md, opacity: pressed ? 0.85 : 1 },
      ]}>
      <AppText variant="caption" color="secondary" style={{ minWidth: s(58) }} fit>
        {time}
      </AppText>
      <AppText variant="body" numberOfLines={1} style={styles.grow}>
        {name}
      </AppText>
      {calories > 0 ? (
        <AppText variant="caption" color="secondary" fit>
          {`${calories} kcal`}
        </AppText>
      ) : null}
      <Symbol name="chevron-right" size="sm" color={theme.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grow: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
});
