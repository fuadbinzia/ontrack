import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components/primitives';
import { CategoryBadge } from '@/components/shared';
import { findCategory } from '@/constants/categories';
import { spacing } from '@/design-system';
import { useSchedule } from '@/store/schedule';
import { AgentUiIds } from '@/utils/agent-ui';
import { activityTimingLabel } from '@/utils/activity-time';

export default function GenericDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const activityId = params.id;

  const activity = useSchedule((s) => s.activities.find((a) => a.id === activityId));
  const categories = useSchedule((s) => s.categories);
  const setStatus = useSchedule((s) => s.setStatus);

  if (!activity) {
    return (
      <Screen>
        <AppText variant="title">Activity Not Found</AppText>
        <Button
          onPress={() => router.back()}
          accessibilityLabel="Go Back"
          testID={AgentUiIds.eventDetail.goBack}>
          Go Back
        </Button>
      </Screen>
    );
  }

  const category = findCategory(categories, activity.categoryId);

  return (
    <Screen>
      <CategoryBadge category={category} />
      <AppText variant="title" style={styles.title}>
        {activity.title}
      </AppText>
      <AppText variant="callout" color="secondary">
        {activityTimingLabel(activity)}
      </AppText>
      <Button
        variant="secondary"
        icon="edit"
        style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
        onPress={() => router.push({ pathname: '/activity-form', params: { id: activity.id } })}
        accessibilityLabel={`Edit ${activity.title}`}
        testID={AgentUiIds.eventDetail.edit}>
        Edit event
      </Button>

      {activity.summary ? (
        <AppText variant="body" color="secondary" style={styles.summary}>
          {activity.summary}
        </AppText>
      ) : null}

      {activity.notes ? (
        <View style={styles.notes}>
          <AppText variant="overline" color="tertiary">
            Notes
          </AppText>
          <AppText variant="body">{activity.notes}</AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          onPress={() =>
            setStatus(activity.id, activity.status === 'completed' ? 'upcoming' : 'completed')
          }
          accessibilityLabel="Toggle complete"
          testID={AgentUiIds.eventDetail.toggleComplete}>
          {activity.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
        </Button>
        <Button
          variant="ghost"
          onPress={() => router.back()}
          accessibilityLabel="Close"
          testID={AgentUiIds.eventDetail.close}>
          Close
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.md, marginBottom: spacing.xs },
  summary: { marginTop: spacing.lg },
  notes: { marginTop: spacing.xl, gap: spacing.sm },
  actions: { marginTop: spacing.xl, gap: spacing.sm },
});
