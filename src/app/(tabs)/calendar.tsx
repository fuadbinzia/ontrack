import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { isActivityEnabled } from '@/addons/registry';
import {
    AppText,
    Button,
    GlassPlate,
    IconButton,
    Screen,
} from '@/components/primitives';
import { layout, radii, spacing } from '@/design-system';
import { CalendarShine } from '@/features/calendar/calendar-shine';
import { MonthGrid } from '@/features/calendar/month-grid';
import { useResponsive } from '@/hooks/use-responsive';
import { syncGoogleCalendarIfConnected } from '@/services/calendar/google-client';
import { useAddons } from '@/store/addons';
import { useSchedule } from '@/store/schedule';
import { useUI } from '@/store/ui';
import { AgentUiIds } from '@/utils/agent-ui';
import {
    formatDateLong,
    formatMonthTitle,
    fromDateKey,
    toDateKey,
    todayKey,
} from '@/utils/date';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';

export default function CalendarScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { spacing: rs } = useResponsive();
  const activities = useSchedule((state) => state.activities);
  const enabledAddons = useAddons((state) => state.enabled);
  const selectedDate = useUI((state) => state.selectedDate);
  const setSelectedDate = useUI((state) => state.setSelectedDate);
  const [shinePlay, setShinePlay] = useState(false);
  const activitiesByDate = useMemo(() => {
    const grouped: Record<string, typeof activities> = {};
    for (const activity of activities) {
      if (!isActivityEnabled(activity, enabledAddons)) continue;
      (grouped[activity.date] ??= []).push(activity);
    }
    return grouped;
  }, [activities, enabledAddons]);

  // Tab preload can mount Calendar off-screen — settle after each land so the
  // sheen runs when the month plate is visible (replay on every visit).
  useEffect(() => {
    if (!isFocused) {
      setShinePlay(false);
      return;
    }
    return deferAfterPageTransition(() => setShinePlay(true));
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) return;
    // Calendar remains local-first; a failed provider refresh never blocks the tab.
    void syncGoogleCalendarIfConnected().catch(() => undefined);
  }, [isFocused]);

  const today = todayKey();
  const selected = selectedDate;
  const cursor = fromDateKey(selectedDate);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const dayCount = useMemo(
    () => (activitiesByDate[selected] ?? []).length,
    [activitiesByDate, selected],
  );
  const dayLabel = formatDateLong(selected, { year: true });

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setSelectedDate(toDateKey(next));
  };

  const openDay = () => {
    setSelectedDate(selected);
    router.navigate('/');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <AppText variant="title">Calendar</AppText>
        <Button
          variant="ghost"
          onPress={() => setSelectedDate(today)}
          testID={AgentUiIds.calendar.jumpToday}
          accessibilityLabel="Jump to Today">
          Today
        </Button>
      </View>

      <View style={styles.monthShell}>
        <GlassPlate
          style={[
            styles.monthGlass,
            {
              padding: rs.md,
              borderRadius: radii.lg,
              gap: rs.sm,
            },
          ]}>
          <View style={styles.monthRow}>
            <IconButton
              icon="chevron-left"
              accessibilityLabel="Previous month"
              testID={AgentUiIds.calendar.prevMonth}
              onPress={() => shiftMonth(-1)}
            />
            <AppText variant="subheading" fit style={styles.monthTitle}>
              {formatMonthTitle(year, month)}
            </AppText>
            <IconButton
              icon="chevron-right"
              accessibilityLabel="Next month"
              testID={AgentUiIds.calendar.nextMonth}
              onPress={() => shiftMonth(1)}
            />
          </View>

          <MonthGrid
            year={year}
            month={month}
            selected={selected}
            activitiesByDate={activitiesByDate}
            onSelect={setSelectedDate}
          />
        </GlassPlate>
        <CalendarShine play={shinePlay} borderRadius={radii.lg} />
      </View>

      <GlassPlate
        style={[
          styles.summary,
          {
            marginTop: rs.xl,
            padding: layout.screenPadding,
            borderRadius: radii.lg,
            gap: rs.md,
          },
        ]}>
        <AppText variant="callout" color="secondary" align="center" fit>
          {dayCount === 0
            ? 'Wide open day.'
            : dayCount === 1
              ? '1 thing lined up'
              : `${dayCount} things lined up`}
        </AppText>
        <Button
          onPress={openDay}
          trailing="chevron-right"
          testID={AgentUiIds.calendar.openDay}
          accessibilityLabel={`Open ${dayLabel}`}>
          {dayLabel}
        </Button>
      </GlassPlate>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  monthShell: {
    width: '100%',
    position: 'relative',
  },
  monthGlass: {
    width: '100%',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  monthTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  summary: {
    width: '100%',
  },
});
