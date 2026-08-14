import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
    AppText,
    ErrorMessage,
    GlassIconWell,
    GlassMetaChip,
    GlassPlate,
    LoadingSpinner,
    Symbol,
} from '@/components/primitives';
import type { Theme } from '@/design-system';
import { fontFamilies, radii } from '@/design-system';
import { itinerarySheetChrome } from '@/features/travel/travel-itinerary-sheet-chrome';
import {
    TRAVEL_EDITORIAL_ACCENT,
    travelCardShadow
} from '@/features/travel/travel-surface';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import type { DateDisplayFormat } from '@/utils/date';
import { formatDateKey } from '@/utils/date';
import { getDateTimeFormatter } from '@/utils/intl-cache';
import { formatCount } from '@/utils/grammar';

import {
    getDestinationCurrentWeather,
    getTravelWeather,
    weatherFetchErrorMessage,
    weatherIconForCode,
} from './provider';
import { temperatureUnitForDateFormat, unitSymbol } from './temperature-unit';
import type { DestinationCurrentWeather, TravelWeather } from './types';

interface TravelWeatherCardProps {
  destination: string;
  startDate: string;
  endDate: string;
  dateDisplayFormat: DateDisplayFormat;
  compact?: boolean;
}

export function TravelWeatherCard({
  destination,
  startDate,
  endDate,
  dateDisplayFormat,
  compact = false,
}: TravelWeatherCardProps) {
  const theme = useTheme();
  const chrome = itinerarySheetChrome(theme);
  const { s, spacing: rs } = useResponsive();
  const light = theme.name === 'light';
  const temperatureUnit = temperatureUnitForDateFormat(dateDisplayFormat);
  const [requestVersion, setRequestVersion] = useState(0);
  const requestKey = [
    destination,
    startDate,
    endDate,
    temperatureUnit,
    requestVersion,
  ].join('|');
  const [result, setResult] = useState<{
    key: string;
    weather?: TravelWeather;
    current?: DestinationCurrentWeather;
    forecastError?: string;
    currentError?: string;
  }>({ key: '' });
  const matched = result.key === requestKey;
  const weather = matched ? result.weather : undefined;
  const current = matched ? result.current : undefined;
  const forecastError = matched ? result.forecastError : undefined;
  const currentError = matched ? result.currentError : undefined;
  const loading = !matched || (!weather && !forecastError) || (!current && !currentError);

  useEffect(() => {
    const controller = new AbortController();
    let forecastSettled = false;
    let currentSettled = false;
    let nextWeather: TravelWeather | undefined;
    let nextCurrent: DestinationCurrentWeather | undefined;
    let nextForecastError: string | undefined;
    let nextCurrentError: string | undefined;

    const publish = () => {
      if (controller.signal.aborted) return;
      if (!forecastSettled || !currentSettled) return;
      setResult({
        key: requestKey,
        weather: nextWeather,
        current: nextCurrent,
        forecastError: nextForecastError,
        currentError: nextCurrentError,
      });
    };

    void getTravelWeather(destination, startDate, endDate, temperatureUnit, controller.signal)
      .then((value) => {
        nextWeather = value;
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        nextForecastError = weatherFetchErrorMessage(reason);
      })
      .finally(() => {
        forecastSettled = true;
        publish();
      });

    void getDestinationCurrentWeather(destination, temperatureUnit, controller.signal)
      .then((value) => {
        nextCurrent = value;
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        nextCurrentError = weatherFetchErrorMessage(
          reason,
          'Current conditions are unavailable.',
        );
      })
      .finally(() => {
        currentSettled = true;
        publish();
      });

    return () => controller.abort();
  }, [destination, endDate, requestKey, startDate, temperatureUnit]);

  const shownDays = useMemo(
    () => weather?.days.slice(0, compact ? 3 : weather.days.length) ?? [],
    [compact, weather],
  );
  const hiddenDayCount = Math.max(0, (weather?.days.length ?? 0) - shownDays.length);
  const iconSize = Math.max(44, s(48));
  const accent = light ? TRAVEL_EDITORIAL_ACCENT : chrome.ctaFrom;
  const locationLabel = current?.locationLabel ?? weather?.locationLabel ?? destination;
  const error = currentError && forecastError ? forecastError : forecastError;

  return (
    <GlassPlate
      airy
      accessibilityLabel={`Destination Weather for ${destination}`}
      style={[
        styles.card,
        {
          borderRadius: Math.max(20, s(22)),
          padding: Math.max(16, rs.md + 2),
          gap: Math.max(14, rs.md),
          boxShadow: travelCardShadow(theme),
        },
      ]}>
      <View style={styles.header}>
        <GlassIconWell size={iconSize} borderRadius={iconSize / 2}>
          <Symbol
            name={
              current
                ? weatherIconForCode(current.weatherCode, { isDay: current.isDay })
                : 'weather'
            }
            size="md"
            color={accent}
          />
        </GlassIconWell>
        <View style={styles.flex}>
          <AppText
            variant="callout"
            fit
            numberOfLines={1}
            style={[
              styles.cardTitle,
              {
                color: accent,
                fontSize: s(17),
                lineHeight: s(22),
              },
            ]}>
            Destination Weather
          </AppText>
          <AppText
            variant="caption"
            fit
            numberOfLines={1}
            style={{
              color: chrome.subtitle,
              fontSize: s(14),
              lineHeight: s(18),
            }}>
            {locationLabel}
          </AppText>
        </View>
        {loading ? <LoadingSpinner color={accent} /> : null}
      </View>

      {current ? (
        <CurrentWeatherBlock current={current} theme={theme} accent={accent} />
      ) : null}

      {currentError && !current ? (
        <AppText variant="caption" color="secondary">
          {currentError}
        </AppText>
      ) : null}

      {weather?.availability === 'too-early' ? (
        <TypicalWeatherBlock
          startDate={startDate}
          availableOn={weather.availableOn!}
          dateDisplayFormat={dateDisplayFormat}
          theme={theme}
          accent={accent}
        />
      ) : null}
      {weather?.availability === 'past' ? (
        <AppText variant="caption" color="secondary">
          Forecasts are available for upcoming travel dates.
        </AppText>
      ) : null}

      {shownDays.length > 0 ? (
        <View style={[styles.days, { gap: rs.sm }]}>
          {shownDays.map((day) => (
            <GlassPlate
              mist
              key={day.date}
              style={[
                styles.day,
                {
                  borderRadius: radii.sm,
                  padding: rs.sm,
                  gap: rs.xxs,
                },
              ]}>
              <AppText variant="caption" color="secondary">
                {formatDateKey(day.date, dateDisplayFormat)}
              </AppText>
              <AppText style={{ fontSize: s(22), lineHeight: s(28) }}>{day.symbol}</AppText>
              <AppText variant="callout">
                {day.temperatureMax}
                {unitSymbol(temperatureUnit)}
              </AppText>
              <AppText variant="caption" color="secondary">
                {day.temperatureMin}° · {day.precipitationProbability}% rain
              </AppText>
            </GlassPlate>
          ))}
          {hiddenDayCount > 0 ? (
            <GlassMetaChip
              accessibilityLabel={`Plus ${formatCount(hiddenDayCount, 'more day', 'more days')}`}
              style={{
                minWidth: Math.max(72, s(72)),
                minHeight: Math.max(40, s(40)),
                alignSelf: 'center',
              }}>
              <AppText variant="caption" color="accent" fit>
                +{formatCount(hiddenDayCount, 'day')}
              </AppText>
            </GlassMetaChip>
          ) : null}
        </View>
      ) : null}

      {weather?.availability === 'partial' && weather.availableThrough ? (
        <AppText variant="caption" color="secondary">
          Forecast currently available through{' '}
          {formatDateKey(weather.availableThrough, dateDisplayFormat)}.
        </AppText>
      ) : null}

      {error ? (
        <View style={[styles.errorRow, { gap: rs.sm }]}>
          <ErrorMessage message={error} variant="caption" style={styles.flex} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry destination weather"
            onPress={() => setRequestVersion((version) => version + 1)}
            style={({ pressed }) => [
              {
                minHeight: Math.max(36, s(36)),
                justifyContent: 'center',
                paddingHorizontal: rs.sm,
              },
              pressed ? styles.pressed : undefined,
            ]}>
            <AppText variant="caption" color="accent">
              Retry
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </GlassPlate>
  );
}

function CurrentWeatherBlock({
  current,
  theme,
  accent,
}: {
  current: DestinationCurrentWeather;
  theme: Theme;
  accent: string;
}) {
  const chrome = itinerarySheetChrome(theme);
  const { s, spacing: rs } = useResponsive();
  const iconSize = Math.max(52, s(56));

  return (
    <AgentTestId testID={AgentUiIds.travel.weather.current} label="Current destination weather">
      <GlassPlate
        airy
        accessibilityLabel={`Right now ${current.temperature}${unitSymbol(current.temperatureUnit)}, ${current.condition}`}
        style={[
          styles.currentBox,
          {
            borderRadius: Math.max(16, s(18)),
            padding: Math.max(16, rs.md),
            gap: Math.max(12, rs.sm + 2),
            boxShadow:
              theme.name === 'light' ? '0 2px 10px rgba(51, 39, 28, 0.06)' : undefined,
          },
        ]}>
        <AppText
          variant="caption"
          fit
          numberOfLines={1}
          style={{
            color: accent,
            fontSize: s(13),
            lineHeight: s(17),
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}>
          Right now
        </AppText>
        <View style={[styles.currentRow, { gap: rs.md }]}>
          <GlassIconWell size={iconSize} borderRadius={iconSize / 2} variant="airy">
            <Symbol
              name={weatherIconForCode(current.weatherCode, { isDay: current.isDay })}
              size="lg"
              color={accent}
            />
          </GlassIconWell>
          <View style={styles.flex}>
            <AppText
              variant="title"
              fit
              numberOfLines={1}
              style={{
                color: chrome.title,
                fontFamily: fontFamilies.serif,
                fontSize: s(36),
                lineHeight: s(40),
                fontWeight: '400',
              }}>
              {current.temperature}
              {unitSymbol(current.temperatureUnit)}
            </AppText>
            <AppText
              variant="callout"
              fit
              numberOfLines={1}
              style={{
                color: chrome.subtitle,
                fontSize: s(16),
                lineHeight: s(21),
              }}>
              {current.condition}
            </AppText>
          </View>
        </View>
      </GlassPlate>
    </AgentTestId>
  );
}

function TypicalWeatherBlock({
  startDate,
  availableOn,
  dateDisplayFormat,
  theme,
  accent,
}: {
  startDate: string;
  availableOn: string;
  dateDisplayFormat: DateDisplayFormat;
  theme: Theme;
  accent: string;
}) {
  const chrome = itinerarySheetChrome(theme);
  const { s, spacing: rs } = useResponsive();
  const light = theme.name === 'light';

  let monthName = 'the month';
  try {
    monthName = getDateTimeFormatter('en-US', { month: 'long' }).format(
      new Date(`${startDate}T12:00:00`),
    );
  } catch {
    /* keep fallback */
  }

  const ruleColor = light ? 'rgba(160, 120, 80, 0.28)' : chrome.fieldBorder;
  const diamondColor = light ? '#C4A06A' : chrome.ctaFrom;

  return (
    <View style={{ gap: Math.max(12, rs.sm + 2) }}>
      <AppText
        variant="caption"
        style={{
          color: chrome.subtitle,
          fontSize: s(13),
          lineHeight: s(18),
        }}>
        Exact daily forecasts will be available {formatDateKey(availableOn, dateDisplayFormat)}.
      </AppText>
      <GlassPlate
        airy
        style={[
          styles.typicalWeatherBox,
          {
            borderRadius: Math.max(16, s(18)),
            padding: Math.max(16, rs.md),
            gap: Math.max(14, rs.md),
            boxShadow: light ? '0 2px 10px rgba(51, 39, 28, 0.06)' : undefined,
          },
        ]}>
        <View style={[styles.typicalWeatherHeader, { gap: rs.sm }]}>
          <Symbol name="calendar" size="sm" color={accent} />
          <AppText
            variant="callout"
            fit
            numberOfLines={1}
            style={[
              styles.typicalTitle,
              {
                color: accent,
                fontSize: s(16),
                lineHeight: s(21),
              },
            ]}>
            Forecast Coming for {monthName}
          </AppText>
        </View>

        <View style={styles.diamondRule}>
          <View style={[styles.ruleLine, { backgroundColor: ruleColor }]} />
          <View style={[styles.diamond, { backgroundColor: diamondColor }]} />
          <View style={[styles.ruleLine, { backgroundColor: ruleColor }]} />
        </View>

        <AppText
          variant="caption"
          style={{
            color: chrome.subtitle,
            fontFamily: fontFamilies.serif,
            fontSize: s(14),
            lineHeight: s(20),
            textAlign: 'center',
          }}>
          Daily highs, lows, and conditions appear here once this trip is inside the forecast
          window. Check back closer to departure for destination-specific weather.
        </AppText>
      </GlassPlate>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
  },
  currentBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: 'continuous',
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  days: { flexDirection: 'row', flexWrap: 'wrap' },
  day: {
    minWidth: 108,
    flexGrow: 1,
    flexBasis: '28%',
  },
  errorRow: { flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.6 },
  flex: { flex: 1, minWidth: 0, flexShrink: 1 },
  typicalWeatherBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: 'continuous',
  },
  typicalWeatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  typicalTitle: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
  },
  diamondRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ruleLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  diamond: {
    width: 7,
    height: 7,
    transform: [{ rotate: '45deg' }],
  },
});
