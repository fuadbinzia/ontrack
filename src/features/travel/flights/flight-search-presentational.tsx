import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { AppText, GlassIconWell, Symbol } from '@/components/primitives';
import { fontFamilies, radii, spacing } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { formatDateKey } from '@/utils/date';

import type { FlightLeg } from './types';

export type FlightSearchNotice = {
  title: string;
  detail: string;
};

export const GOOGLE_FLIGHTS_NOTICE: FlightSearchNotice = {
  title: 'Couldn’t open Google Flights',
  detail: 'Check your connection and try again.',
};

export function FlightSearchErrorBanner({
  notice,
}: {
  notice: FlightSearchNotice;
}) {
  const theme = useTheme();
  const { s, spacing: rs } = useResponsive();
  const light = theme.name === 'light';
  const iconSize = Math.max(36, s(36));
  const fill = light ? '#F8EBE6' : 'rgba(206, 108, 96, 0.16)';
  const border = light ? 'rgba(176, 74, 63, 0.18)' : 'rgba(206, 108, 96, 0.28)';
  const titleColor = light ? '#8F3A32' : '#E8A098';
  const detailColor = light ? '#6E4A44' : '#C9A8A2';

  useEffect(() => {
    const timeout = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(
        `Error: ${notice.title}. ${notice.detail}`,
      );
    }, 100);
    return () => clearTimeout(timeout);
  }, [notice.detail, notice.title]);

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={`Error: ${notice.title}. ${notice.detail}`}
      style={[
        styles.errorBanner,
        {
          backgroundColor: fill,
          borderColor: border,
          borderRadius: radii.lg,
          paddingHorizontal: rs.md,
          paddingVertical: rs.md,
          gap: rs.sm,
        },
      ]}>
      <GlassIconWell size={iconSize} borderRadius={radii.sm} style={styles.errorIcon}>
        <Symbol name="itinerary" size="sm" color={theme.danger} />
      </GlassIconWell>
      <View style={styles.errorCopy}>
        <AppText
          fit
          numberOfLines={1}
          style={[
            styles.errorTitle,
            {
              color: titleColor,
              fontSize: Math.max(15, s(16)),
              lineHeight: Math.max(20, s(21)),
            },
          ]}>
          {notice.title}
        </AppText>
        <AppText
          numberOfLines={4}
          style={[
            styles.errorDetail,
            {
              color: detailColor,
              fontSize: Math.max(13, s(14)),
              lineHeight: Math.max(18, s(19)),
            },
          ]}>
          {notice.detail}
        </AppText>
      </View>
    </View>
  );
}

function formatDuration(value: string): string {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(value);
  if (!match) return value;
  return [match[1] ? `${match[1]}h` : '', match[2] ? `${match[2]}m` : '']
    .filter(Boolean)
    .join(' ');
}

function formatDateTime(value: string, dateDisplayFormat: string): string {
  const [date, rawTime = ''] = value.split('T');
  const time = rawTime.slice(0, 5);
  return `${formatDateKey(date, dateDisplayFormat)} · ${time}`;
}

export function FlightSearchLegSummary({
  label,
  leg,
  dateDisplayFormat,
  labelColor,
}: {
  label: string;
  leg: FlightLeg;
  dateDisplayFormat: string;
  labelColor: string;
}) {
  // Keep rendering compatible while a separately deployed API rolls forward.
  const segments = leg.segments?.length ? leg.segments : [];
  const route = [
    segments[0]?.departureCode ?? leg.departureCode,
    ...(segments.length > 0
      ? segments.map((segment) => segment.arrivalCode)
      : [leg.arrivalCode]),
  ];
  const flightNumbers = segments
    .map((segment) => segment.flightNumber)
    .filter(Boolean)
    .join(' · ');
  const carriers = Array.from(
    new Set(segments.map((segment) => segment.carrier).filter(Boolean)),
  ).join(' · ');

  return (
    <View style={styles.leg}>
      <AppText variant="overline" style={{ color: labelColor, textTransform: 'none' }}>
        {label}
      </AppText>
      <View style={styles.route}>
        <View style={styles.flex}>
          <AppText variant="subheading">{route.join(' → ')}</AppText>
          <AppText variant="caption" color="secondary">
            {formatDateTime(leg.departureAt, dateDisplayFormat)}
          </AppText>
          {leg.stops > 0 && (carriers || flightNumbers) ? (
            <AppText variant="caption" color="secondary">
              {[carriers, flightNumbers].filter(Boolean).join(' · ')}
            </AppText>
          ) : null}
        </View>
        <AppText variant="caption" color="secondary">
          {formatDuration(leg.duration)} ·{' '}
          {leg.stops === 0
            ? 'Nonstop'
            : `${leg.stops} stop${leg.stops === 1 ? '' : 's'}`}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, flexShrink: 1, minWidth: 0 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  errorIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  errorCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  errorTitle: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
    flexShrink: 1,
    minWidth: 0,
  },
  errorDetail: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
    flexShrink: 1,
    minWidth: 0,
  },
  leg: { gap: spacing.sm },
  route: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
});
