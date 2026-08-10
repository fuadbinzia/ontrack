import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppText, Card, Symbol } from '@/components/primitives';
import { radii, type AppIconName } from '@/design-system';
import {
  formatHomeWeatherPrimaryLabel,
  formatHomeWeatherRangeLabel,
  weatherPlaceLabelLadder,
  type HomeWeatherSnapshot,
} from '@/features/daily-tracking/resolve-home-weather-day';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

/**
 * full → region → city; city uses ellipsis if it still overflows.
 */
function WeatherPlaceText({ locationLabel }: { locationLabel: string }) {
  const { typography } = useResponsive();
  const ladder = useMemo(
    () => weatherPlaceLabelLadder(locationLabel),
    [locationLabel],
  );
  const [boxWidth, setBoxWidth] = useState(0);
  const [measured, setMeasured] = useState<Record<string, number>>({});

  const chosen = useMemo(() => {
    if (ladder.length === 0) return '';
    if (boxWidth <= 0) return ladder[0]!;
    for (const label of ladder) {
      const width = measured[label];
      if (typeof width === 'number' && width <= boxWidth + 0.5) return label;
    }
    return ladder[ladder.length - 1]!;
  }, [boxWidth, ladder, measured]);

  if (!chosen) return null;

  return (
    <View
      style={styles.weatherPlaceText}
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        if (next > 0 && next !== boxWidth) setBoxWidth(next);
      }}>
      {ladder.map((label) => (
        <Text
          key={label}
          pointerEvents="none"
          allowFontScaling
          maxFontSizeMultiplier={1.15}
          numberOfLines={1}
          style={[typography.caption as object, styles.measurePlace]}
          onTextLayout={(event) => {
            const next = Math.ceil(
              event.nativeEvent.lines.reduce(
                (max, line) => Math.max(max, line.width),
                0,
              ),
            );
            if (next <= 0) return;
            setMeasured((prev) =>
              prev[label] === next ? prev : { ...prev, [label]: next },
            );
          }}>
          {label}
        </Text>
      ))}
      <AppText
        variant="caption"
        color="tertiary"
        align="center"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={styles.weatherPlaceText}>
        {chosen}
      </AppText>
    </View>
  );
}

export function DayWeatherBar({
  weather,
  icon,
  testID,
  accessibilityLabel,
  onPress,
  compact,
}: {
  weather: HomeWeatherSnapshot;
  icon?: AppIconName;
  testID: string;
  accessibilityLabel: string;
  onPress?: () => void;
  /** Half-width tile in a Home | Current row. */
  compact?: boolean;
}) {
  const theme = useTheme();
  const { s, spacing: rs } = useResponsive();
  const primaryLabel = formatHomeWeatherPrimaryLabel(weather);
  const rangeLabel = formatHomeWeatherRangeLabel(weather);
  const fitFloor = compact ? 0.55 : 0.72;
  const padX = compact ? rs.sm : rs.xl;

  const card = (
    <Card
      airy
      padded={false}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[
        styles.weatherCard,
        {
          minHeight: Math.max(48, s(48)),
          paddingHorizontal: padX,
          paddingVertical: rs.md,
          gap: rs.xs,
          borderRadius: radii.lg,
          width: '100%',
        },
      ]}>
      <View style={[styles.weatherStack, { gap: rs.xxs }]}>
        <View style={styles.weatherPrimaryRow}>
          <Symbol
            name={icon ?? 'weather'}
            size={compact ? 'sm' : 'md'}
            color={theme.accentPrimary}
          />
          <AppText
            variant={compact ? 'caption' : 'callout'}
            color="accent"
            align="center"
            fit
            fitMinimumScale={fitFloor}
            numberOfLines={1}
            style={styles.weatherPrimaryText}>
            {/* Same ` · ` break + spacing as temp · condition in the label. */}
            {` · ${primaryLabel}`}
          </AppText>
        </View>
        {rangeLabel ? (
          <AppText
            variant="caption"
            color="secondary"
            align="center"
            fit
            fitMinimumScale={fitFloor}
            numberOfLines={1}
            style={styles.weatherPlaceText}>
            {rangeLabel}
          </AppText>
        ) : null}
        <WeatherPlaceText locationLabel={weather.locationLabel} />
      </View>
    </Card>
  );

  // Glass Card puts `style` on the plate, not the outer Pressable — wrap so
  // half-width flex shrink actually applies to the row child.
  if (compact) {
    return <View style={styles.weatherCardCompact}>{card}</View>;
  }
  return card;
}

const styles = StyleSheet.create({
  weatherCard: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  weatherCardCompact: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  weatherStack: {
    width: '100%',
    alignItems: 'stretch',
    minWidth: 0,
  },
  weatherPrimaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minWidth: 0,
  },
  weatherPrimaryText: {
    flexShrink: 1,
    minWidth: 0,
  },
  weatherPlaceText: {
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
  },
  measurePlace: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    top: 0,
    zIndex: -1,
  },
});
