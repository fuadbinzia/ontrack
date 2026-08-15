import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { resolveEventCalendarArtwork } from '@/features/events/event-calendar-artwork';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useTheme } from '@/hooks/use-theme';
import { aiProvider } from '@/services/ai';
import { logPlantWatering, undoPlantWatering } from '@/services/plants/schedule';
import { useAddons } from '@/store/addons';
import { useJournal } from '@/store/journal';
import { usePreferences } from '@/store/preferences';
import { useSchedule } from '@/store/schedule';
import { DEFAULT_CHECKLIST_NAME, useTodos } from '@/store/todos';
import { useUI } from '@/store/ui';
import type { Activity } from '@/types/models';
import { confirmDeleteActivity, showActivityActions, type ActivityAction } from '@/utils/activity-actions';
import { AgentUiIds } from '@/utils/agent-ui';
import { addDays, toDateKey, todayKey } from '@/utils/date';
import { listReferenceEquality } from '@/utils/list-equality';

import { DayAddSheet } from './day-add-sheet';
import { emptyDayTitle, resolveDayTimeState } from './day-view-model';
import { activityDetailPath } from './activity-detail-route';

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
  const lists = useTodos((s) => s.lists);
  const createList = useTodos((s) => s.createList);
  const addTask = useTodos((s) => s.addTask);
  const addJournalText = useJournal((s) => s.addText);
  const notifyPageInteraction = useUI((state) => state.notifyPageInteraction);
  const [addOpen, setAddOpen] = useState(false);
  const { refreshControl } = usePullToRefresh();
  const routeIsActive = useRouteIsActive();
  const [clock, setClock] = useState(() => new Date());
  const lastTodayKey = useRef(todayKey());

  useEffect(() => {
    if (!routeIsActive) return;
    const tick = () => {
      const nextClock = new Date();
      const nextTodayKey = toDateKey(nextClock);
      if (nextTodayKey !== lastTodayKey.current) {
        if (date === lastTodayKey.current) onChangeDate(nextTodayKey);
        lastTodayKey.current = nextTodayKey;
      }
      setClock(nextClock);
    };
    const interval = setInterval(tick, 60_000);
    tick();
    return () => clearInterval(interval);
  }, [date, onChangeDate, routeIsActive]);

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
  const eventDetails = useSchedule((s) => s.eventDetails);
  const eventFollows = useSchedule((s) => s.eventFollows);
  const setStatus = useSchedule((s) => s.setStatus);
  const deleteActivity = useSchedule((s) => s.deleteActivity);
  const duplicateActivity = useSchedule((s) => s.duplicateActivity);
  const moveActivityToDate = useSchedule((s) => s.moveActivityToDate);
  const eventDetailsByActivityId = useMemo(
    () => new Map(eventDetails.map((details) => [details.activityId, details])),
    [eventDetails],
  );
  const eventFollowsById = useMemo(
    () => new Map(eventFollows.map((follow) => [follow.id, follow])),
    [eventFollows],
  );

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
  const countedTotal = activities.filter((a) => a.status !== 'skipped').length;
  const skippedTitles = useMemo(
    () => activities.filter((a) => a.status === 'skipped').map((a) => a.title),
    [activities],
  );
  const { currentId, nowLine } = useMemo(
    () => resolveDayTimeState(activities, date, clock),
    [activities, clock, date],
  );

  const [summary, setSummary] = useState<{ date: string; line: string } | undefined>();
  const canSummarize =
    aiEnabled && activities.length > 0 && date <= todayKey();
  useEffect(() => {
    let cancelled = false;
    if (!canSummarize) {
      setSummary(undefined);
      return;
    }
    void aiProvider
      .summarizeDay({
        dateKey: date,
        completed: completedCount,
        total: countedTotal,
        skippedTitles,
      })
      .then((s) => {
        if (!cancelled) setSummary({ date, line: `${s.headline} ${s.body}` });
      })
      .catch(() => {
        if (!cancelled) setSummary(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [canSummarize, completedCount, countedTotal, date, skippedTitles]);

  const summaryLine = canSummarize && summary?.date === date ? summary.line : undefined;

  const handleActivityAction = useCallback(
    (activity: Activity, action: ActivityAction) => {
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
    },
    [addDays, confirmDeleteActivity, deleteActivity, duplicateActivity, moveActivityToDate, router, setStatus],
  );

  const toggleComplete = useCallback(
    async (activity: Activity) => {
      if (activity.plantId && activity.careKind === 'watering') {
        if (activity.status === 'completed') await undoPlantWatering(activity.id);
        else await logPlantWatering(activity.plantId);
        return;
      }
      if (activity.status === 'completed') setStatus(activity.id, 'upcoming');
      else if (activity.status === 'skipped') setStatus(activity.id, 'upcoming');
      else setStatus(activity.id, 'completed');
    },
    [logPlantWatering, setStatus, undoPlantWatering],
  );

  const openAdd = useCallback(() => setAddOpen(true), []);

  const addEvent = useCallback(() => {
    router.push({ pathname: '/activity-form', params: { date } });
  }, [date, router]);

  const addMeal = useCallback(() => {
    router.push({
      pathname: '/activity-form',
      params: { date, category: 'food' },
    });
  }, [date, router]);

  const addChecklistItem = useCallback(
    (title: string) => {
      const inbox =
        lists.find(
          (list) =>
            list.kind === 'checklist' && list.name === DEFAULT_CHECKLIST_NAME,
        ) ?? lists.find((list) => list.kind === 'checklist');
      const listId = inbox?.id ?? createList(DEFAULT_CHECKLIST_NAME, 'checklist')?.id;
      if (!listId) return;
      addTask(listId, title);
    },
    [addTask, createList, lists],
  );

  const addJournalLine = useCallback(
    (text: string) => {
      addJournalText(date, text);
    },
    [addJournalText, date],
  );

  const openActivity = useCallback(
    (activity: Activity) => {
      const category = findCategory(categories, activity.categoryId);
      router.push({
        pathname: activityDetailPath(activity, category),
        params: { id: activity.id },
      });
    },
    [categories, router],
  );

  const renderActivityItem = useCallback(
    ({ item: activity, index }: { item: Activity; index: number }) => {
      const details = eventDetailsByActivityId.get(activity.id);
      const follow = details?.followId
        ? eventFollowsById.get(details.followId)
        : undefined;

      return (
        <View style={styles.rowPad}>
          <ActivityCard
            activity={activity}
            category={findCategory(categories, activity.categoryId)}
            leadingArtwork={resolveEventCalendarArtwork(activity.title, details, follow)}
            isCurrent={activity.id === currentId}
            index={index}
            testID={AgentUiIds.today.activity(activity.id)}
            toggleTestID={AgentUiIds.today.activityToggle(activity.id)}
            onPress={() => openActivity(activity)}
            onLongPress={
              activity.plantId
                ? undefined
                : () =>
                    showActivityActions({
                      activity,
                      onAction: (action) => handleActivityAction(activity, action),
                    })
            }
            onToggleComplete={() => void toggleComplete(activity)}
          />
        </View>
      );
    },
    [
      categories,
      currentId,
      eventDetailsByActivityId,
      eventFollowsById,
      handleActivityAction,
      openActivity,
      toggleComplete,
    ],
  );

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
                  title={emptyDayTitle(date)}
                  message="Nothing on the books yet — add a workout, a meal, or whatever sounds good and the day starts to feel like yours."
                  actionLabel="Add Activity"
                  actionTestID={AgentUiIds.today.emptyAddActivity}
                  onAction={openAdd}
                />
              ) : (
                <SectionHeader title="Timeline" flush titleColor="tertiary" />
              )}
            </View>
          </View>
        }
        renderItem={renderActivityItem}
      />

      <View style={[styles.fab, { bottom: tabBarHeight + spacing.lg }]}>
        <IconButton
          icon="add"
          size={48}
          color={theme.accentPrimary}
          accessibilityLabel="Add Activity"
          testID={AgentUiIds.today.addActivity}
          onPress={openAdd}
        />
      </View>
      <DayAddSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onEvent={addEvent}
        onMeal={addMeal}
        onChecklist={addChecklistItem}
        onJournal={addJournalLine}
        mealEnabled={enabledAddons.food}
        journalEnabled={enabledAddons.journal}
      />
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
