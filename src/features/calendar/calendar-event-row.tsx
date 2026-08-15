import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  GlassIconWell,
  Symbol,
} from '@/components/primitives';
import { categoryColors } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { Activity, ActivityCategory } from '@/types/models';
import { activityTimingLabel } from '@/utils/activity-time';

interface CalendarEventRowProps {
  activity: Activity;
  category: ActivityCategory;
  testID: string;
  onPress: () => void;
}

export function CalendarEventRow({
  activity,
  category,
  testID,
  onPress,
}: CalendarEventRowProps) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const colors = categoryColors(theme, category.colorKey);
  const timing = activityTimingLabel(activity);

  return (
    <Card
      padded={false}
      airy
      testID={testID}
      accessibilityLabel={`${activity.title}, ${timing}`}
      onPress={onPress}>
      <View
        style={[
          styles.row,
          { minHeight: s(64), gap: spacing.md, padding: spacing.md },
        ]}>
        <GlassIconWell size={s(44)} borderRadius={s(14)}>
          <Symbol name={category.icon} size="sm" color={colors.main} />
        </GlassIconWell>
        <View style={styles.copy}>
          <AppText variant="bodyMedium" numberOfLines={1}>
            {activity.title}
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {timing}
            {activity.summary ? ` · ${activity.summary}` : ''}
          </AppText>
        </View>
        <Symbol name="chevron-right" size="sm" color={theme.textTertiary} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
});
