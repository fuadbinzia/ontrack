import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  IconButton,
  ProgressRing,
  useSafeAreaChrome,
} from '@/components/primitives';
import {
  hexWithAlpha,
  layout,
  spacing,
  timeOfDayGradient,
  timeOfDaySafeAreaBackground,
} from '@/design-system';
import { DayWeatherBar } from '@/features/daily-tracking/day-weather-bar';
import {
  formatHomeWeatherTemperatureLabel,
} from '@/features/daily-tracking/resolve-home-weather-day';
import { useHomeWeather } from '@/features/daily-tracking/use-home-weather';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { addDays, formatDateLong, formatWeekday, isToday } from '@/utils/date';
import { haptics } from '@/utils/haptics';

interface DayHeaderProps {
  date: string;
  completion: number;
  /** e.g. "Now · Deep work" or "Next · Lunch" */
  nowLine?: string;
  summaryLine?: string;
  onChangeDate: (date: string) => void;
  topInset: number;
}

export function DayHeader({
  date,
  completion,
  nowLine,
  summaryLine,
  onChangeDate,
  topInset,
}: DayHeaderProps) {
  const theme = useTheme();
  const { spacing: rs, layout } = useResponsive();
  const hour = isToday(date) ? new Date().getHours() : 12;
  const gradient = timeOfDayGradient(theme, hour);
  useSafeAreaChrome(timeOfDaySafeAreaBackground(theme, hour));
  const router = useRouter();
  const viewingToday = isToday(date);
  const {
    weather,
    icon,
    showWeather,
    hasSavedHome,
    showCurrentWeather,
    currentWeather,
    currentIcon,
  } = useHomeWeather(date);
  const openProfileHomeLocation = viewingToday
    ? () => router.push('/(tabs)/profile?reveal=homeLocation' as never)
    : undefined;
  const openProfileCurrentLocation = viewingToday
    ? () => router.push('/(tabs)/profile?reveal=currentLocation' as never)
    : undefined;
  const dualBars = hasSavedHome && showCurrentWeather && Boolean(currentWeather);
  const weatherAccessibilityLabel = weather
    ? viewingToday
      ? `${formatHomeWeatherTemperatureLabel(weather)} in ${weather.locationLabel}. Open Profile to edit home location.`
      : `${formatHomeWeatherTemperatureLabel(weather)} in ${weather.locationLabel}.`
    : viewingToday
      ? 'Open Profile to edit home location'
      : undefined;
  const currentAccessibilityLabel = currentWeather
    ? viewingToday
      ? `${formatHomeWeatherTemperatureLabel(currentWeather)} in ${currentWeather.locationLabel}. Open Profile to edit current location.`
      : `${formatHomeWeatherTemperatureLabel(currentWeather)} in ${currentWeather.locationLabel}.`
    : viewingToday
      ? 'Open Profile to edit current location'
      : undefined;

  const openCalendarLabel = `Open calendar for ${formatDateLong(date)}`;
  const openCalendar = () => {
    haptics.select();
    router.navigate('/(tabs)/calendar');
  };
  const openCalendarAgent = useAgentUiTarget(AgentUiIds.today.openCalendar, {
    label: openCalendarLabel,
    onPress: openCalendar,
  });
  useAgentUiTarget(
    viewingToday ? undefined : AgentUiIds.today.nonToday,
    { label: formatDateLong(date) },
  );
  const showWeatherBar = Boolean(
    showWeather && weather && weatherAccessibilityLabel,
  );
  const showDayVoice = completion > 0 || Boolean(nowLine || summaryLine);
  const navSize = layout.minTapTarget;
  const navSlotStyle = {
    width: navSize,
    height: navSize,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <View style={[styles.container, { paddingTop: topInset + spacing.md }]}>
      {/*
        Soft multi-stop dissolve into ScreenAtmosphere — avoid a mid-header
        muddy band from a hard opaque→transparent seam.
      */}
      <LinearGradient
        colors={[
          gradient[0],
          hexWithAlpha(gradient[0], 0.78),
          hexWithAlpha(gradient[0], 0.42),
          hexWithAlpha(gradient[0], 0.14),
          'transparent',
        ]}
        locations={[0, 0.24, 0.5, 0.76, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topRow}>
        <View style={navSlotStyle}>
          <IconButton
            icon="chevron-left"
            accessibilityLabel="Previous day"
            testID={AgentUiIds.today.prevDay}
            size={navSize}
            onPress={() => onChangeDate(addDays(date, -1))}
          />
        </View>
        <Pressable
          ref={openCalendarAgent.ref}
          testID={AgentUiIds.today.openCalendar}
          onLayout={openCalendarAgent.onLayout}
          accessibilityRole="button"
          accessibilityLabel={openCalendarLabel}
          onPress={openCalendar}
          hitSlop={8}
          style={({ pressed }) => [
            styles.titleBlock,
            pressed ? styles.titleBlockPressed : null,
          ]}>
          <AppText variant="overline" color="tertiary" align="center" fit>
            {viewingToday ? 'Today' : formatWeekday(date)}
          </AppText>
          <AppText variant="title" align="center" fit>
            {formatDateLong(date)}
          </AppText>
        </Pressable>
        <View style={navSlotStyle}>
          <IconButton
            icon="chevron-right"
            accessibilityLabel="Next day"
            testID={AgentUiIds.today.nextDay}
            size={navSize}
            onPress={() => onChangeDate(addDays(date, 1))}
          />
        </View>
      </View>

      {showWeatherBar || showDayVoice ? (
        <View style={styles.dayBrief}>
      {showWeather && weather && weatherAccessibilityLabel ? (
        dualBars && currentWeather ? (
          <View style={[styles.weatherRow, { gap: rs.sm }]}>
            <DayWeatherBar
              weather={weather}
              icon={icon}
              compact
              testID={AgentUiIds.today.weather}
              accessibilityLabel={weatherAccessibilityLabel}
              onPress={openProfileHomeLocation}
            />
            <DayWeatherBar
              weather={currentWeather}
              icon={currentIcon}
              compact
              testID={AgentUiIds.today.currentLocation}
              accessibilityLabel={
                currentAccessibilityLabel ?? 'Current location'
              }
              onPress={openProfileCurrentLocation}
            />
          </View>
        ) : (
          <DayWeatherBar
            weather={weather}
            icon={icon}
            testID={
              hasSavedHome
                ? AgentUiIds.today.weather
                : AgentUiIds.today.currentLocation
            }
            accessibilityLabel={
              hasSavedHome
                ? weatherAccessibilityLabel
                : (currentAccessibilityLabel ?? weatherAccessibilityLabel)
            }
            onPress={
              hasSavedHome
                ? openProfileHomeLocation
                : openProfileCurrentLocation
            }
          />
        )
      ) : null}

      {showDayVoice ? (
        <View
          style={[
            styles.progressRow,
            completion <= 0 ? styles.progressRowSolo : null,
          ]}>
          {completion > 0 ? (
            <AgentTestId testID={AgentUiIds.today.progress}>
              <ProgressRing
                progress={completion}
                size={92}
                label={`${Math.round(completion * 100)}%`}
                sublabel="complete"
              />
            </AgentTestId>
          ) : null}
          {nowLine || summaryLine ? (
            <View
              style={[
                styles.progressText,
                completion <= 0 ? styles.progressTextSolo : null,
              ]}>
              {nowLine ? (
                <AppText
                  variant="callout"
                  color="accent"
                  align={completion > 0 ? undefined : 'center'}
                  numberOfLines={1}>
                  {nowLine}
                </AppText>
              ) : null}
              {summaryLine ? (
                <AppText
                  variant="callout"
                  color="secondary"
                  align={completion > 0 ? undefined : 'center'}
                  numberOfLines={3}>
                  {summaryLine}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 0,
    gap: spacing.md,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  titleBlockPressed: {
    opacity: 0.72,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    minWidth: 0,
  },
  dayBrief: {
    width: '100%',
    gap: spacing.xl,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    width: '100%',
  },
  progressRowSolo: {
    justifyContent: 'center',
  },
  progressText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  progressTextSolo: {
    alignItems: 'center',
  },
});
