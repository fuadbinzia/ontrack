import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Stop } from 'react-native-svg';

import {
    AppText,
    GlassIconWell,
    GlassMetaChip,
    IconButton,
    Symbol,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { AirlineLogo } from '@/features/travel/airline-logo';
import {
    airportCity,
    airportCityLabel,
    airportName,
} from '@/features/travel/airport-catalog';
import type {
    FlightJourneyLayover,
    FlightJourneyViewModel,
} from '@/features/travel/flight-journey-model';
import {
    useTravelItineraryInk,
    useTravelItineraryOnGlass,
} from '@/features/travel/use-travel-itinerary-glass';
import { relativeLuminanceFromHex, parseHexRgb } from '@/features/travel/travel-home-atmosphere-ink';
import { useResponsive } from '@/hooks/use-responsive';
import { formatDuration, formatMinutes } from '@/utils/date';

import { FlightStatusBadge } from './flight-status-badge';
import { formatFlightGate, formatFlightTerminal } from './flight-terminal';
import type { FlightOperationalStatus } from './flights/types';

/**
 * Kind accents from light theme (#315A7C flight) wash out on dark artwork glass.
 * Lift toward white until the stroke/label stays readable.
 */
function accentForArtworkGlass(accent: string, darkGlass: boolean): string {
  if (!darkGlass) return accent;
  const luma = relativeLuminanceFromHex(accent);
  const rgb = parseHexRgb(accent);
  if (!rgb || luma === undefined || luma >= 0.45) return accent;
  const t = Math.min(0.72, (0.5 - luma) / 0.5);
  const to = (n: number) =>
    Math.round(n + (255 - n) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`.toUpperCase();
}

/** Column geometry shared by the vertical stops and the layover rule. */
export function useJourneyMetrics() {
  const { s, spacing: rs } = useResponsive();
  return {
    timeColWidth: Math.max(50, s(54)),
    railColWidth: Math.max(14, s(16)),
    railWidth: Math.max(2, s(2)),
    columnGap: rs.sm,
    cardPadding: rs.lg,
  };
}

function timeLabel(minutes?: number): string {
  return minutes !== undefined ? formatMinutes(minutes) : '—';
}

function codeLabel(airport?: string): string {
  return airport?.trim().toUpperCase() ?? '';
}

/** SVG dashed stroke — RN View borderStyle:'dashed' is unreliable on iOS. */
export function DashedLine({
  color,
  toColor,
  thickness = 2,
  dashLength = 6,
  gapLength = 4,
  direction = 'horizontal',
  /** Explicit length in px — skips onLayout when the parent size is known. */
  length: lengthProp,
}: {
  color: string;
  /** Optional end color — paints a gradient along the stroke. */
  toColor?: string;
  thickness?: number;
  dashLength?: number;
  gapLength?: number;
  direction?: 'horizontal' | 'vertical';
  length?: number;
}) {
  const { s } = useResponsive();
  const gradientId = useId().replace(/:/g, '');
  const [measured, setMeasured] = useState(0);
  const stroke = Math.max(1.5, s(thickness));
  const dash = Math.max(3, s(dashLength));
  const gap = Math.max(2, s(gapLength));
  const vertical = direction === 'vertical';
  const length = lengthProp && lengthProp > 0 ? lengthProp : measured;
  const gradient = Boolean(toColor && toColor !== color);
  const strokePaint = gradient ? `url(#${gradientId})` : color;

  return (
    <View
      style={
        vertical
          ? [
              styles.dashedHostVertical,
              { width: stroke },
              lengthProp ? { height: lengthProp } : null,
            ]
          : [
              styles.dashedHost,
              { height: stroke },
              lengthProp ? { width: lengthProp } : null,
            ]
      }
      pointerEvents="none"
      onLayout={
        lengthProp
          ? undefined
          : (event) => {
              const next = vertical
                ? event.nativeEvent.layout.height
                : event.nativeEvent.layout.width;
              setMeasured(next);
            }
      }>
      {length > 0 ? (
        <Svg
          width={vertical ? stroke : length}
          height={vertical ? length : stroke}>
          {gradient ? (
            <Defs>
              <LinearGradient
                id={gradientId}
                gradientUnits="userSpaceOnUse"
                x1={vertical ? stroke / 2 : 0}
                y1={vertical ? 0 : stroke / 2}
                x2={vertical ? stroke / 2 : length}
                y2={vertical ? length : stroke / 2}>
                <Stop offset="0" stopColor={color} />
                <Stop offset="1" stopColor={toColor} />
              </LinearGradient>
            </Defs>
          ) : null}
          <Line
            x1={vertical ? stroke / 2 : 0}
            y1={vertical ? 0 : stroke / 2}
            x2={vertical ? stroke / 2 : length}
            y2={vertical ? length : stroke / 2}
            stroke={strokePaint}
            strokeWidth={stroke}
            strokeDasharray={`${dash},${gap}`}
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}

/** Terminal / gate pills shown under an airport in the vertical itinerary. */
export function FlightFacilityChips({
  terminal,
  gate,
  accent,
}: {
  terminal?: string;
  gate?: string;
  accent: string;
}) {
  const { s, spacing: rs } = useResponsive();
  const primaryInk = useTravelItineraryInk();
  const chips = [
    { icon: 'location' as const, label: formatFlightTerminal(terminal) },
    { icon: 'transit' as const, label: formatFlightGate(gate) },
  ].filter((chip): chip is { icon: 'location' | 'transit'; label: string } =>
    Boolean(chip.label),
  );
  if (!chips.length) return null;

  return (
    <View style={[styles.chipRow, { gap: rs.xs, marginTop: rs.xxs }]}>
      {chips.map((chip) => (
        <GlassMetaChip key={chip.icon} accessibilityLabel={chip.label}>
          <Symbol name={chip.icon} size="sm" color={accent} />
          <AppText variant="caption" fit style={{ color: primaryInk }}>
            {chip.label}
          </AppText>
        </GlassMetaChip>
      ))}
    </View>
  );
}

type StripStop = { time?: number; code: string };
type StripSegment =
  | { kind: 'leg'; minutes?: number }
  | { kind: 'layover'; minutes: number };

function stripModel(journey: FlightJourneyViewModel): {
  stops: StripStop[];
  segments: StripSegment[];
} {
  const stops: StripStop[] = [];
  const segments: StripSegment[] = [];
  journey.legs.forEach((leg, index) => {
    if (index === 0) {
      stops.push({
        time: leg.departure.timeMinutes,
        code: codeLabel(leg.departure.airport),
      });
    }
    segments.push({ kind: 'leg', minutes: leg.durationMinutes });
    stops.push({
      time: leg.arrival.timeMinutes,
      code: codeLabel(leg.arrival.airport),
    });
    if (leg.layoverAfter) {
      segments.push({ kind: 'layover', minutes: leg.layoverAfter.minutes });
      stops.push({
        time: leg.layoverAfter.departureMinutes,
        code: codeLabel(leg.layoverAfter.airport),
      });
    }
  });
  return { stops, segments };
}

/**
 * Horizontal at-a-glance route strip: times/codes + plane/clock icons,
 * a single-accent rail (dashed layover with duration in the gap), and
 * durations / a Layover pill underneath.
 */
export function JourneyStrip({
  journey,
  accent,
}: {
  journey: FlightJourneyViewModel;
  accent: string;
}) {
  const { s, spacing: rs } = useResponsive();
  const darkGlass = useTravelItineraryOnGlass();
  const primaryInk = useTravelItineraryInk();
  const secondaryInk = useTravelItineraryInk('secondary');
  const rail = accentForArtworkGlass(accent, darkGlass);
  const { stops, segments } = stripModel(journey);
  const stopWidth = Math.max(40, s(44));
  const dotSize = Math.max(8, s(9));
  const railHeight = Math.max(2, s(2));
  const railOverhang = (stopWidth - dotSize) / 2;
  const labelBleed = Math.max(14, s(16));

  const row = (
    rowStyle: object,
    renderStop: (stop: StripStop, index: number) => ReactNode,
    renderSegment: (segment: StripSegment, index: number) => ReactNode,
  ) => (
    <View style={[styles.stripRow, rowStyle]}>
      {stops.map((stop, index) => {
        const segment = segments[index];
        return [
          <View
            key={`stop-${index}`}
            style={[styles.stripStop, { width: stopWidth }]}>
            {renderStop(stop, index)}
          </View>,
          segment ? (
            <View
              key={`seg-${index}`}
              style={[
                styles.stripSegment,
                { flex: segment.kind === 'layover' ? 2 : 1 },
              ]}>
              {renderSegment(segment, index)}
            </View>
          ) : null,
        ];
      })}
    </View>
  );

  return (
    <View>
      {row(
        { alignItems: 'flex-end', height: Math.max(40, s(42)) },
        (stop) => (
          <View
            style={[
              styles.stripOverhang,
              { left: -labelBleed, right: -labelBleed, bottom: 0 },
            ]}>
            <AppText variant="caption" fit style={{ color: primaryInk }}>
              {timeLabel(stop.time)}
            </AppText>
            <AppText variant="caption" fit style={{ color: secondaryInk }}>
              {stop.code}
            </AppText>
          </View>
        ),
        (segment) => (
          <View style={styles.stripSegmentIcon}>
            <Symbol
              name={segment.kind === 'layover' ? 'clock' : 'flight'}
              size="sm"
              color={rail}
            />
          </View>
        ),
      )}

      {row(
        { alignItems: 'center', marginTop: rs.xs },
        () => (
          <View
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: rail,
            }}
          />
        ),
        (segment) =>
          segment.kind === 'leg' ? (
            <View
              style={{
                height: railHeight,
                borderRadius: railHeight / 2,
                backgroundColor: rail,
                marginHorizontal: -railOverhang,
              }}
            />
          ) : (
            <View
              style={[
                styles.stripLayoverRail,
                { marginHorizontal: -railOverhang, gap: rs.xxs },
              ]}>
              <View style={styles.stripDashFill}>
                <DashedLine
                  color={rail}
                  thickness={2}
                  dashLength={5}
                  gapLength={4}
                />
              </View>
              <AppText
                variant="caption"
                fit
                style={{ color: primaryInk }}>
                {formatDuration(segment.minutes)}
              </AppText>
              <View style={styles.stripDashFill}>
                <DashedLine
                  color={rail}
                  thickness={2}
                  dashLength={5}
                  gapLength={4}
                />
              </View>
            </View>
          ),
      )}

      {row(
        {
          alignItems: 'flex-start',
          marginTop: rs.xs,
          height: Math.max(24, s(26)),
        },
        () => null,
        (segment) => (
          <View
            style={[
              styles.stripOverhang,
              { left: -labelBleed * 1.6, right: -labelBleed * 1.6, top: 0 },
            ]}>
            {segment.kind === 'leg' ? (
              <AppText variant="caption" fit style={{ color: rail }}>
                {segment.minutes ? formatDuration(segment.minutes) : ' '}
              </AppText>
            ) : (
              <GlassMetaChip accessibilityLabel="Layover">
                <AppText
                  variant="caption"
                  fit
                  style={{ color: secondaryInk }}>
                  Layover
                </AppText>
              </GlassMetaChip>
            )}
          </View>
        ),
      )}
    </View>
  );
}

/** One departure or arrival row of the vertical itinerary. */
export function VerticalStop({
  timeMinutes,
  label,
  airport,
  terminal,
  gate,
  showPlane,
  filledDot,
  accent,
  airline,
  flightNumber,
  carrier,
  aircraft,
  statusLabel,
  status,
  statusTestID,
  statusSyncAvailable,
  statusSyncLoading,
  statusSyncDisabled,
  statusSyncAccessibilityLabel,
  onStatusSync,
  statusSyncTestID,
  durationMinutes,
  isLast,
}: {
  timeMinutes?: number;
  label: string;
  airport?: string;
  terminal?: string;
  gate?: string;
  showPlane?: boolean;
  filledDot?: boolean;
  accent: string;
  airline?: string;
  flightNumber?: string;
  carrier?: string;
  aircraft?: string;
  /** Live operational status for this leg (shown beside the carrier line). */
  statusLabel?: string;
  status?: FlightOperationalStatus;
  statusTestID?: string;
  statusSyncAvailable?: boolean;
  statusSyncLoading?: boolean;
  statusSyncDisabled?: boolean;
  statusSyncAccessibilityLabel?: string;
  onStatusSync?: () => void;
  statusSyncTestID?: string;
  durationMinutes?: number;
  isLast?: boolean;
}) {
  const { s, spacing: rs, typography } = useResponsive();
  const darkGlass = useTravelItineraryOnGlass();
  const primaryInk = useTravelItineraryInk();
  const secondaryInk = useTravelItineraryInk('secondary');
  const rail = accentForArtworkGlass(accent, darkGlass);
  const { timeColWidth, railColWidth, railWidth, columnGap } =
    useJourneyMetrics();
  const place = airportCityLabel(airport);
  const name = airportName(airport);
  const dotSize = Math.max(10, s(11));
  const plateSize = Math.max(28, s(30));
  const hasAirlineMeta = Boolean(
    showPlane && (carrier || aircraft || airline || flightNumber),
  );
  const showStatusControls = Boolean(
    statusLabel || (statusSyncAvailable && onStatusSync),
  );

  return (
    <View style={[styles.verticalStop, { gap: columnGap }]}>
      <View
        style={[
          styles.timeCol,
          {
            width: timeColWidth,
            paddingTop: Math.max(1, s(1)),
            gap: rs.xs,
          },
        ]}>
        <AppText
          variant="callout"
          bold
          fit
          style={{ color: primaryInk, textAlign: 'center' }}>
          {timeLabel(timeMinutes)}
        </AppText>
        {hasAirlineMeta ? (
          <GlassIconWell
            size={plateSize}
            borderRadius={Math.max(radii.sm, s(8))}>
            <AirlineLogo
              airline={airline}
              flightNumber={flightNumber}
              fallbackColor={rail}
            />
          </GlassIconWell>
        ) : null}
      </View>

      <View style={[styles.railCol, { width: railColWidth }]}>
        <View
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            borderWidth: filledDot ? 0 : Math.max(2, s(2)),
            borderColor: rail,
            // Hollow dots stay transparent so the mist board shows through.
            backgroundColor: filledDot ? rail : 'transparent',
            marginTop: Math.max(4, s(5)),
          }}
        />
        {isLast ? null : (
          <View
            style={{
              width: railWidth,
              backgroundColor: rail,
              flex: 1,
              minHeight: Math.max(36, s(40)),
              opacity: 0.85,
            }}
          />
        )}
      </View>

      <View
        style={[
          styles.stopCopy,
          { gap: Math.max(2, s(3)), paddingBottom: rs.md },
        ]}>
        <AppText variant="overline" fit style={{ color: secondaryInk }}>
          {label}
        </AppText>
        {place ? (
          <AppText variant="callout" bold fit style={{ color: primaryInk }}>
            {place}
          </AppText>
        ) : null}
        {name && name !== place && name !== codeLabel(airport) ? (
          <AppText
            variant="caption"
            numberOfLines={2}
            style={{ color: secondaryInk }}>
            {name}
          </AppText>
        ) : null}
        <FlightFacilityChips terminal={terminal} gate={gate} accent={rail} />
        {showStatusControls ? (
          <View
            style={[
              styles.carrierRow,
              { gap: rs.xs, marginTop: Math.max(1, s(1)) },
            ]}>
            <AppText
              variant="caption"
              fit
              style={[styles.carrierText, { color: secondaryInk }]}>
              Flight Status:
            </AppText>
            {statusLabel ? (
              <FlightStatusBadge
                label={statusLabel}
                status={status}
                testID={statusTestID}
              />
            ) : null}
            {statusSyncAvailable && onStatusSync && statusSyncTestID ? (
              <IconButton
                icon="sync"
                size={Math.max(28, typography.caption.lineHeight + s(8))}
                iconSize={13}
                background="transparent"
                color={secondaryInk}
                loading={statusSyncLoading}
                disabled={statusSyncDisabled}
                testID={statusSyncTestID}
                accessibilityLabel={
                  statusSyncAccessibilityLabel ??
                  (flightNumber
                    ? `Check status for ${flightNumber}`
                    : 'Check flight status')
                }
                onPress={onStatusSync}
              />
            ) : null}
          </View>
        ) : null}
        {carrier ? (
          <AppText
            variant="caption"
            fit
            style={[styles.carrierText, { color: secondaryInk }]}>
            {carrier}
          </AppText>
        ) : null}
        {aircraft ? (
          <AppText variant="caption" fit style={{ color: secondaryInk }}>
            {aircraft}
          </AppText>
        ) : null}
        {durationMinutes ? (
          <GlassMetaChip
            accessibilityLabel={`${formatDuration(durationMinutes)} flight`}
            style={{ marginTop: Math.max(2, s(2)) }}>
            <Symbol name="clock" size="sm" color={rail} />
            <AppText variant="caption" fit style={{ color: primaryInk }}>
              {formatDuration(durationMinutes)} flight
            </AppText>
          </GlassMetaChip>
        ) : null}
      </View>
    </View>
  );
}

/** Centered layover pill with dashed side rails inset from the card edges. */
export function LayoverBanner({
  layover,
  railColor,
}: {
  layover: FlightJourneyLayover;
  /** Accent for the dashed connectors (usually prior leg). */
  railColor: string;
}) {
  const { s, spacing: rs } = useResponsive();
  const city = airportCity(layover.airport);
  const ink = useTravelItineraryInk('secondary');
  /** Keep dashed rails off the card’s left/right edges. */
  const edgeInset = rs.lg;
  const lineToPillGap = rs.sm;

  return (
    <View
      style={[
        styles.layoverRow,
        {
          minHeight: Math.max(40, s(44)),
          marginVertical: rs.xs,
          paddingHorizontal: edgeInset,
          gap: lineToPillGap,
        },
      ]}>
      <View style={styles.layoverDash}>
        <DashedLine
          color={railColor}
          thickness={2}
          dashLength={5}
          gapLength={4}
        />
      </View>
      <GlassMetaChip
        style={{
          gap: rs.xs,
          paddingHorizontal: rs.md,
          paddingVertical: rs.sm,
        }}>
        <Symbol name="clock" size="sm" color={ink} />
        <AppText
          variant="callout"
          fit
          style={{ color: ink, flexShrink: 1, minWidth: 0 }}>
          {formatDuration(layover.minutes)} layover
          {city ? ` in ${city}` : ''}
        </AppText>
      </GlassMetaChip>
      <View style={styles.layoverDash}>
        <DashedLine
          color={railColor}
          thickness={2}
          dashLength={5}
          gapLength={4}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dashedHost: { width: '100%', overflow: 'hidden' },
  dashedHostVertical: { height: '100%', alignSelf: 'center', overflow: 'hidden' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  stripRow: { flexDirection: 'row' },
  stripStop: { alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 },
  stripSegment: { minWidth: 0, justifyContent: 'center' },
  stripSegmentIcon: { alignItems: 'center', justifyContent: 'flex-end' },
  stripOverhang: { position: 'absolute', alignItems: 'center' },
  stripLayoverRail: { flexDirection: 'row', alignItems: 'center' },
  stripDashFill: { flex: 1, minWidth: 0, justifyContent: 'center' },
  verticalStop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timeCol: {
    alignItems: 'center',
    flexShrink: 0,
    alignSelf: 'stretch',
  },
  railCol: { alignItems: 'center', flexShrink: 0 },
  stopCopy: { flex: 1, minWidth: 0, flexShrink: 1 },
  carrierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    minWidth: 0,
  },
  carrierText: { flexShrink: 1, minWidth: 0 },
  layoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  layoverDash: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
});
