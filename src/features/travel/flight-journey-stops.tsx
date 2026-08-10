import { StyleSheet, View } from 'react-native';

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
import type { FlightJourneyLayover } from '@/features/travel/flight-journey-model';
import {
  useTravelItineraryInk,
  useTravelItineraryOnGlass,
} from '@/features/travel/use-travel-itinerary-glass';
import { useResponsive } from '@/hooks/use-responsive';
import { formatDuration } from '@/utils/date';

import {
  accentForArtworkGlass,
  codeLabel,
  timeLabel,
} from './flight-journey-chrome-helpers';
import { DashedLine, FlightFacilityChips, useJourneyMetrics } from './flight-journey-chrome';
import { FlightStatusBadge } from './flight-status-badge';
import type { FlightOperationalStatus } from './flights/types';

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
  }
});
