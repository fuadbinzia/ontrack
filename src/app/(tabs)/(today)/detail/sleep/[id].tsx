import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card } from '@/components/primitives';
import { findCategory } from '@/constants/categories';
import { spacing } from '@/design-system';
import { CalendarDetailSheet } from '@/features/daily-tracking/calendar-detail-sheet';
import { useSchedule } from '@/store/schedule';
import { activityTimingLabel, isAllDayActivity } from '@/utils/activity-time';
import { openSleepData } from '@/utils/open-sleep-data';
import { useAddons } from '@/store/addons';
import { AgentUiIds } from '@/utils/agent-ui';

export default function SleepDetailScreen() {
  const router = useRouter();
  const { id: activityId } = useLocalSearchParams<{ id: string }>();
  const activity = useSchedule((state) =>
    state.activities.find((candidate) => candidate.id === activityId),
  );
  const categories = useSchedule((state) => state.categories);
  const setStatus = useSchedule((state) => state.setStatus);
  const healthEnabled = useAddons((state) => state.enabled.health);

  if (!activity) {
    return (
      <CalendarDetailSheet kind="sleep" title="Sleep Activity Not Found" onClose={() => router.back()}>
        <AppText variant="body" color="secondary">
          This sleep activity is no longer available.
        </AppText>
      </CalendarDetailSheet>
    );
  }

  const category = findCategory(categories, activity.categoryId);
  const healthAppName = process.env.EXPO_OS === 'ios' ? 'Apple Health' : 'Health Connect';
  const healthDashboardEnabled = healthEnabled && process.env.EXPO_OS === 'ios';

  return (
    <CalendarDetailSheet
      kind="sleep"
      eyebrow={category.name}
      title={activity.title}
      subtitle={isAllDayActivity(activity) ? 'All day' : `${activityTimingLabel(activity)} planned`}
      subtitleIcon="clock"
      onClose={() => router.back()}>

      <Card variant="sunken" style={styles.healthCard}>
        <AppText variant="subheading">Your Recorded Sleep</AppText>
        <AppText variant="body" color="secondary">
          Review sleep duration, stages, and trends from your connected devices in {healthAppName}.
        </AppText>
        <Button
          size="lg"
          icon="health"
          testID={AgentUiIds.health.sleepHandoff}
          onPress={() => healthDashboardEnabled ? router.push('/health' as never) : void openSleepData()}
          accessibilityLabel={healthDashboardEnabled ? 'Open onTrack Health dashboard' : `Open sleep data in ${healthAppName}`}>
          {healthDashboardEnabled ? 'Open Health dashboard' : 'Open sleep data'}
        </Button>
      </Card>

      <View style={styles.actions}>
        <Button
          variant="secondary"
          icon="edit"
          onPress={() => router.push({ pathname: '/activity-form', params: { id: activity.id } })}
          accessibilityLabel={`Edit ${activity.title}`}>
          Edit sleep plan
        </Button>
        <Button
          variant="ghost"
          onPress={() =>
            setStatus(activity.id, activity.status === 'completed' ? 'upcoming' : 'completed')
          }
          accessibilityLabel="Toggle sleep complete">
          {activity.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
        </Button>
      </View>
    </CalendarDetailSheet>
  );
}

const styles = StyleSheet.create({
  healthCard: { gap: spacing.lg, marginTop: spacing.lg },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
