import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { AppText, Button, GlassPlate, SectionHeader } from '@/components/primitives';
import { findCategory } from '@/constants/categories';
import { radii, spacing } from '@/design-system';
import { CalendarDetailSheet } from '@/features/daily-tracking/calendar-detail-sheet';
import { useTheme } from '@/hooks/use-theme';
import { useSchedule } from '@/store/schedule';
import { activityTimingLabel } from '@/utils/activity-time';
import { formatCount } from '@/utils/grammar';

export default function WorkDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const activityId = params.id;

  const activity = useSchedule((s) => s.activities.find((a) => a.id === activityId));
  const session = useSchedule((s) => s.workSessions.find((w) => w.activityId === activityId));
  const categories = useSchedule((s) => s.categories);
  const upsertWorkSession = useSchedule((s) => s.upsertWorkSession);

  if (!activity) {
    return (
      <CalendarDetailSheet kind="work" title="Work Session Not Found" onClose={() => router.back()}>
        <AppText variant="body" color="secondary">
          This work session is no longer available.
        </AppText>
      </CalendarDetailSheet>
    );
  }

  const category = findCategory(categories, activity.categoryId);
  const tasks = session?.tasks ?? [];

  const toggleTask = (taskId: string) => {
    if (!session) return;
    upsertWorkSession({
      ...session,
      tasks: tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
    });
  };

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <CalendarDetailSheet
      kind="work"
      eyebrow={category.name}
      title={activity.title}
      subtitle={activityTimingLabel(activity)}
      subtitleIcon="clock"
      onClose={() => router.back()}>
      <AppText variant="body" color="secondary">
        {doneCount} of {formatCount(tasks.length, 'task')} complete · {session?.focusMinutes ?? 0}m focus logged
      </AppText>
      <Button
        variant="secondary"
        icon="edit"
        style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
        onPress={() => router.push({ pathname: '/activity-form', params: { id: activity.id } })}
        accessibilityLabel="Edit work session">
        Edit work session
      </Button>

      <SectionHeader title="Tasks" />
      {tasks.map((task) => (
        <GlassPlate
          airy
          key={task.id}
          style={[
            styles.taskRow,
            { borderColor: task.done ? theme.success : theme.separator },
          ]}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.done }}
            accessibilityLabel={task.title}
            onPress={() => toggleTask(task.id)}
            style={styles.taskRowInner}>
            <AppText variant="callout" color={task.done ? 'secondary' : 'primary'}>
              {task.done ? '✓ ' : ''}
              {task.title}
            </AppText>
            <AppText variant="caption" color="tertiary">
              {task.priority}
            </AppText>
          </Pressable>
        </GlassPlate>
      ))}
    </CalendarDetailSheet>
  );
}

const styles = StyleSheet.create({
  taskRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  taskRowInner: {
    padding: spacing.lg,
    gap: spacing.xxs,
    zIndex: 1,
  },
});
