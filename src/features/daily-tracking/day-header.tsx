import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

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
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { addDays, formatDateLong, formatWeekday, isToday } from '@/utils/date';

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
  const { spacing: rs } = useResponsive();
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
        <IconButton
          icon="chevron-left"
          accessibilityLabel="Previous day"
          testID={AgentUiIds.today.prevDay}
          onPress={() => onChangeDate(addDays(date, -1))}
        />
        <View style={styles.titleBlock}>
          <AppText variant="overline" color="tertiary" align="center">
            {viewingToday ? 'Today' : formatWeekday(date)}
          </AppText>
          <AppText variant="title" align="center">
            {formatDateLong(date)}
          </AppText>
        </View>
        <IconButton
          icon="chevron-right"
          accessibilityLabel="Next day"
          testID={AgentUiIds.today.nextDay}
          onPress={() => onChangeDate(addDays(date, 1))}
        />
      </View>

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

      {completion > 0 || nowLine || summaryLine ? (
        <View style={styles.progressRow}>
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
            <View style={styles.progressText}>
              {nowLine ? (
                <AppText variant="callout" color="accent" numberOfLines={1}>
                  {nowLine}
                </AppText>
              ) : null}
              {summaryLine ? (
                <AppText variant="callout" color="secondary" numberOfLines={3}>
                  {summaryLine}
                </AppText>
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
    paddingBottom: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
    gap: spacing.xxs,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    minWidth: 0,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  progressText: {
    flex: 1,
    gap: spacing.xs,
  },
});
