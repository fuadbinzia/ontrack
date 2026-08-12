import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { isActivityEnabled } from '@/addons/registry';
import {
    EmptyState,
    IconButton,
    ScreenAtmosphere,
    screenAtmosphereBottomColor,
    SectionHeader,
    usePageSurfaceBackground,
} from '@/components/primitives';
import { ActivityCard } from '@/components/shared';
import { findCategory } from '@/constants/categories';
import { layout, spacing } from '@/design-system';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useTheme } from '@/hooks/use-theme';
import { aiProvider } from '@/services/ai';
import { logPlantWatering, undoPlantWatering } from '@/services/plants/schedule';
import { useAddons } from '@/store/addons';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { useUI } from '@/store/ui';
import type { Activity } from '@/types/models';
import { confirmDeleteActivity, showActivityActions, type ActivityAction } from '@/utils/activity-actions';
import { AgentUiIds } from '@/utils/agent-ui';
import { addDays, isToday, nowMinutes, todayKey } from '@/utils/date';
import { listReferenceEquality } from '@/utils/list-equality';

interface DayViewProps {
  date: string;
  onChangeDate: (date: string) => void;
  /** Rendered above the timeline (the DayHeader) */
  renderHeader: (args: {
    completion: number;
    nowLine?: string;
    summaryLine?: string;
    topInset: number;
  }) => React.ReactNode;
}

function computeNowLine(activities: Activity[], date: string): string | undefined {
  if (!isToday(date)) return undefined;
  const now = nowMinutes();
  const current = activities.find(
    (a) => a.status === 'upcoming' && a.startMinutes <= now && now < a.startMinutes + a.durationMinutes,
  );
  if (current) return `Now · ${current.title}`;
  const next = activities.find((a) => a.status === 'upcoming' && a.startMinutes > now);
  if (next) return `Next · ${next.title}`;
  return undefined;
}

export function DayView({ date, onChangeDate, renderHeader }: DayViewProps) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Today doesn't use Screen — publish atmosphere fill for the frosted dock.
  usePageSurfaceBackground(screenAtmosphereBottomColor(theme.name));
  const measuredTabBarHeight = useUI((state) => state.tabBarHeight);
  const tabBarHeight =
    measuredTabBarHeight ||
    layout.bottomNavBarBaseHeight + insets.bottom;
  const aiEnabled = usePreferences((s) => s.aiEnabled);
  const enabledAddons = useAddons((s) => s.enabled);
  const notifyPageInteraction = useUI((state) => state.notifyPageInteraction);
  const { refreshControl } = usePullToRefresh();

  const dayActivities = useSchedule(
    (s) => s.activities.filter((activity) => activity.date === date),
    listReferenceEquality,
  );
  const activities = useMemo(
    () =>
      dayActivities
        .filter((activity) => isActivityEnabled(activity, enabledAddons))
        .sort((a, b) => a.startMinutes - b.startMinutes),
    [dayActivities, enabledAddons],
  );
  const categories = useSchedule((s) => s.categories);
  const setStatus = useSchedule((s) => s.setStatus);
  const deleteActivity = useSchedule((s) => s.deleteActivity);
  const duplicateActivity = useSchedule((s) => s.duplicateActivity);
  const moveActivityToDate = useSchedule((s) => s.moveActivityToDate);

  const completion = useMemo(() => {
    const counted = activities.filter((a) => a.status !== 'skipped');
    if (counted.length === 0) return 0;
    return (
      counted.reduce(
        (sum, a) => sum + (a.status === 'completed' ? 1 : a.status === 'partial' ? 0.5 : 0),
        0,
      ) / counted.length
    );
  }, [activities]);

  const completedCount = activities.filter((a) => a.status === 'completed').length;
  const skippedTitles = activities.filter((a) => a.status === 'skipped').map((a) => a.title);
  const nowLine = computeNowLine(activities, date);

  const [summary, setSummary] = useState<{ date: string; line: string } | undefined>();
  const canSummarize =
    aiEnabled && activities.length > 0 && date <= todayKey();
  useEffect(() => {
    let cancelled = false;
    if (!canSummarize) return;
    aiProvider
      .summarizeDay({
        dateKey: date,
        completed: completedCount,
        total: activities.filter((a) => a.status !== 'skipped').length,
        skippedTitles,
      })
      .then((s) => {
        if (!cancelled) setSummary({ date, line: `${s.headline} ${s.body}` });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, completedCount, skippedTitles.length, canSummarize]);

  const summaryLine = canSummarize && summary?.date === date ? summary.line : undefined;

  const now = nowMinutes();
  const currentId = isToday(date)
    ? activities.find(
        (a) =>
          a.status === 'upcoming' && a.startMinutes <= now && now < a.startMinutes + a.durationMinutes,
      )?.id
    : undefined;

  const handleActivityAction = (activity: Activity, action: ActivityAction) => {
    switch (action) {
      case 'edit':
        router.push({ pathname: '/activity-form', params: { id: activity.id } });
        break;
      case 'skip':
        setStatus(activity.id, 'skipped');
        break;
      case 'unskip':
        setStatus(activity.id, 'upcoming');
        break;
      case 'duplicate':
        duplicateActivity(activity.id);
        break;
      case 'move-tomorrow':
        moveActivityToDate(activity.id, addDays(activity.date, 1));
        break;
      case 'delete':
        confirmDeleteActivity(activity.title, () => deleteActivity(activity.id));
        break;
    }
  };

  const toggleComplete = async (activity: Activity) => {
    if (activity.plantId && activity.careKind === 'watering') {
      if (activity.status === 'completed') await undoPlantWatering(activity.id);
      else await logPlantWatering(activity.plantId);
      return;
    }
    if (activity.status === 'completed') setStatus(activity.id, 'upcoming');
    else if (activity.status === 'skipped') setStatus(activity.id, 'upcoming');
    else setStatus(activity.id, 'completed');
  };

  const openActivity = (activity: Activity) => {
    const category = findCategory(categories, activity.categoryId);
    switch (category.detailKind) {
      case 'food':
        router.push({ pathname: '/detail/food/[id]', params: { id: activity.id } });
        break;
      case 'gym':
        router.push({ pathname: '/detail/gym/[id]', params: { id: activity.id } });
        break;
      case 'work':
        router.push({ pathname: '/detail/work/[id]', params: { id: activity.id } });
        break;
      case 'movie':
        router.push({ pathname: '/detail/movie/[id]', params: { id: activity.id } });
        break;
      case 'sleep':
        router.push({ pathname: '/detail/sleep/[id]', params: { id: activity.id } });
        break;
      case 'plant':
        if (activity.plantId) router.push({ pathname: '/plants/[id]', params: { id: activity.plantId } });
        else router.push({ pathname: '/detail/generic/[id]', params: { id: activity.id } });
        break;
      default:
        router.push({ pathname: '/detail/generic/[id]', params: { id: activity.id } });
    }
  };

  return (
    <SafeAreaView
      edges={['left', 'right']}
      onTouchStart={notifyPageInteraction}
      style={[styles.fill, { backgroundColor: 'transparent' }]}>
      <ScreenAtmosphere />
      <FlashList
        data={activities}
        keyExtractor={(item) => item.id}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 80 }}
        ListHeaderComponent={
          <View>
            {renderHeader({ completion, nowLine, summaryLine, topInset: 0 })}
            <View style={styles.timeline}>
              {activities.length === 0 ? (
                <EmptyState
                  icon="today"
                  title="Today is wide open."
                  message="Nothing on the books yet — add a workout, a meal, or whatever sounds good and the day starts to feel like yours."
                  actionLabel="Add Activity"
                  actionTestID={AgentUiIds.today.emptyAddActivity}
                  onAction={() => router.push({ pathname: '/activity-form', params: { date } })}
                />
              ) : (
                <SectionHeader title="Timeline" flush titleColor="tertiary" />
              )}
            </View>
          </View>
        }
        renderItem={({ item: activity, index }) => (
          <View style={styles.rowPad}>
            <ActivityCard
              activity={activity}
              category={findCategory(categories, activity.categoryId)}
              isCurrent={activity.id === currentId}
              index={index}
              testID={AgentUiIds.today.activity(activity.id)}
              toggleTestID={AgentUiIds.today.activityToggle(activity.id)}
              onPress={() => openActivity(activity)}
              onLongPress={activity.plantId ? undefined : () =>
                showActivityActions({
                  activity,
                  onAction: (action) => handleActivityAction(activity, action),
                })
              }
              onToggleComplete={() => void toggleComplete(activity)}
            />
          </View>
        )}
      />

      <View style={[styles.fab, { bottom: tabBarHeight + spacing.lg }]}>
        <IconButton
          icon="add"
          size={48}
          color={theme.accentPrimary}
          accessibilityLabel="Add Activity"
          testID={AgentUiIds.today.addActivity}
          onPress={() =>
            router.push({ pathname: '/activity-form', params: { date } })
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  timeline: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  rowPad: {
    paddingHorizontal: layout.screenPadding,
  },
  fab: {
    position: 'absolute',
    right: layout.screenPadding,
    borderRadius: 24,
  },
});
