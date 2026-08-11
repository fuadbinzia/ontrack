import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import {
  AppText,
  GlassTonePill,
  Symbol,
  fieldTitleCase,
  statusBadgeToneColor,
  type StatusBadgeTone,
} from '@/components/primitives';
import { glassMaterials, radii } from '@/design-system';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import type {
  JourneyTraveler,
  TimelineProgressSummary,
} from '@/features/travel/travel-timeline-progress';
import {
  useTravelItineraryInk,
  useTravelItineraryMistProps,
  useTravelItineraryOnGlass,
} from '@/features/travel/use-travel-itinerary-glass';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

export function TimelineProgressStrip({
  summary,
  traveler,
  accent,
}: {
  summary: TimelineProgressSummary;
  traveler: JourneyTraveler;
  accent: string;
}) {
  const theme = useTheme();
  const { s, spacing: rs } = useResponsive();
  const primaryInk = useTravelItineraryInk();
  const secondaryInk = useTravelItineraryInk('secondary');
  const mistProps = useTravelItineraryMistProps();
  const onGlass = useTravelItineraryOnGlass();
  const trackFill = onGlass
    ? primaryInk
    : theme.name === 'dark'
      ? glassMaterials.border.dark
      : glassMaterials.border.mistLight;
  const tone: StatusBadgeTone =
    summary.tripPhase === 'complete'
      ? 'success'
      : summary.tripPhase === 'in_progress'
        ? 'warning'
        : 'neutral';
  const badgeColor = statusBadgeToneColor(tone, theme);
  const trackHeight = Math.max(4, s(4));
  const chipSize = Math.max(22, s(22));
  const daysDoneLabel = fieldTitleCase(
    `${summary.completedDays}/${summary.totalDays} days done`,
  );
  const [trackWidth, setTrackWidth] = useState(0);
  const progressAnim = useRef(new Animated.Value(traveler.progress)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: traveler.progress,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [progressAnim, traveler.progress]);

  const fillWidth =
    trackWidth > 0
      ? progressAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, trackWidth],
        })
      : 0;
  const chipLeft =
    trackWidth > 0
      ? progressAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.max(0, trackWidth - chipSize)],
        })
      : 0;

  return (
    <View
      style={[
        styles.strip,
        {
          gap: rs.sm,
          paddingHorizontal: rs.sm,
          paddingTop: rs.sm,
          paddingBottom: rs.md,
        },
      ]}>
      <AgentTestId
        testID={AgentUiIds.travel.timeline.progress}
        label={summary.label}>
        <View style={[styles.stripRow, { gap: rs.sm }]}>
          <AgentTestId
            testID={AgentUiIds.travel.timeline.progressBadge}
            label={summary.label}>
            <GlassTonePill
              label={summary.label}
              toneColor={onGlass ? primaryInk : badgeColor}
              textColor={onGlass ? primaryInk : undefined}
              showDot
            />
          </AgentTestId>
          <View style={styles.stripMeta}>
            <AgentTestId
              testID={AgentUiIds.travel.timeline.progressMeta}
              label={daysDoneLabel}>
              <AppText
                variant="caption"
                fit
                align="right"
                style={[styles.stripMetaText, { color: secondaryInk }]}>
                {daysDoneLabel}
              </AppText>
            </AgentTestId>
          </View>
        </View>
        <View
          style={[
            styles.trackRow,
            {
              marginTop: rs.sm,
              marginBottom: rs.xs,
              minHeight: Math.max(chipSize, trackHeight + s(10)),
            },
          ]}
          onLayout={(event) => {
            const next = event.nativeEvent.layout.width;
            if (next > 0 && next !== trackWidth) setTrackWidth(next);
          }}>
          <View
            style={[
              styles.track,
              {
                height: trackHeight,
                borderRadius: trackHeight,
                backgroundColor: trackFill,
              },
            ]}>
            <Animated.View
              style={{
                width: fillWidth,
                height: '100%',
                borderRadius: trackHeight,
                backgroundColor: accent,
              }}
            />
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.travelerChip,
              {
                width: chipSize,
                height: chipSize,
                borderRadius: chipSize / 2,
                left: chipLeft,
                top: '50%',
                marginTop: -chipSize / 2,
              },
            ]}>
            <TravelHomeGlass
              {...mistProps}
              style={{
                width: chipSize,
                height: chipSize,
                borderRadius: chipSize / 2,
                borderCurve: 'continuous',
                overflow: 'hidden',
              }}>
              <AgentTestId
                testID={AgentUiIds.travel.timeline.traveler}
                label={traveler.accessibilityLabel}>
                <View
                  style={[
                    styles.travelerInner,
                    { width: chipSize, height: chipSize },
                  ]}
                  accessibilityLabel={traveler.accessibilityLabel}>
                  <Symbol name={traveler.icon} size="sm" color="#000000" />
                </View>
              </AgentTestId>
            </TravelHomeGlass>
          </Animated.View>
        </View>
      </AgentTestId>
    </View>
  );
}

/** Slim “now” break on the current day between elapsed and upcoming stops. */
export function TimelineNowMarker({
  accent,
  spineWidth,
}: {
  accent: string;
  spineWidth: number;
}) {
  const theme = useTheme();
  const { s, spacing: rs } = useResponsive();
  const primaryInk = useTravelItineraryInk();
  const rim =
    theme.name === 'dark' ? 'rgba(255,255,255,0.55)' : 'rgba(17, 74, 110, 0.22)';
  const dot = Math.max(8, s(8));

  return (
    <View
      pointerEvents="none"
      style={[styles.nowRow, { gap: rs.xs, minHeight: Math.max(22, s(22)) }]}>
      <AgentTestId testID={AgentUiIds.travel.timeline.now} label="Now">
        <View style={[styles.nowRow, { gap: rs.xs }]}>
          <View style={[styles.nowSpine, { width: spineWidth }]}>
            <View
              style={{
                width: dot,
                height: dot,
                borderRadius: dot / 2,
                backgroundColor: accent,
                borderWidth: Math.max(2, s(2)),
                borderColor: rim,
              }}
            />
          </View>
          <AppText
            variant="caption"
            fit
            style={[styles.nowLabel, { color: primaryInk }]}>
            Now
          </AppText>
        </View>
      </AgentTestId>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    width: '100%',
    minWidth: 0,
  },
  stripRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  stripMeta: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  stripMetaText: {
    width: '100%',
    textAlign: 'right',
  },
  trackRow: {
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  travelerChip: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  travelerInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
  },
  nowSpine: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  nowLabel: {
    flexShrink: 1,
    minWidth: 0,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
