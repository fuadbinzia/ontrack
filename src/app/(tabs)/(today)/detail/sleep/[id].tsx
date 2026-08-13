import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components/primitives';
import { CategoryBadge } from '@/components/shared';
import { findCategory } from '@/constants/categories';
import { spacing } from '@/design-system';
import { useSchedule } from '@/store/schedule';
import { activityTimingLabel } from '@/utils/activity-time';
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
      <Screen>
        <AppText variant="title">Sleep Activity Not Found</AppText>
        <Button onPress={() => router.back()} accessibilityLabel="Go Back">
          Go Back
        </Button>
      </Screen>
    );
  }

  const category = findCategory(categories, activity.categoryId);
  const healthAppName = process.env.EXPO_OS === 'ios' ? 'Apple Health' : 'Health Connect';
  const healthDashboardEnabled = healthEnabled && process.env.EXPO_OS === 'ios';

  return (
    <Screen contentStyle={styles.screen}>
      <CategoryBadge category={category} />
      <AppText variant="title">{activity.title}</AppText>
      <AppText variant="callout" color="secondary">
        {activity.allDay ? 'All day' : `${activityTimingLabel(activity)} planned`}
      </AppText>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.md },
  healthCard: { gap: spacing.lg, marginTop: spacing.lg },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
