import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText, Symbol } from '@/components/primitives';
import type { AppIconName } from '@/design-system';
import {
  TRAVEL_TITLE_ICON_GAP,
  travelEditorialTextStyle,
} from '@/features/travel/travel-chrome';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import { travelAccent } from '@/features/travel/travel-surface';
import {
  useTravelItineraryInk,
  useTravelItineraryMistProps,
  useTravelItineraryOnGlass,
  useTravelItineraryShellProps,
} from '@/features/travel/use-travel-itinerary-glass';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

const PULSE_MS = 900;

function SkeletonBone({
  height,
  width,
  style,
}: {
  height: number;
  width?: number | `${number}%`;
  style?: object;
}) {
  const mistProps = useTravelItineraryMistProps();
  const { allowsLoopMotion } = usePerformanceTier();
  const routeIsActive = useRouteIsActive();
  const animatePulse = allowsLoopMotion && routeIsActive;
  const pulse = useSharedValue(animatePulse ? 0.55 : 0.72);

  useEffect(() => {
    if (!animatePulse) {
      cancelAnimation(pulse);
      pulse.value = 0.72;
      return;
    }
    pulse.value = 0.55;
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [animatePulse, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View style={[{ width: width ?? '100%' }, pulseStyle, style]}>
      <TravelHomeGlass
        {...mistProps}
        style={{
          height,
          width: '100%',
          borderRadius: Math.max(8, height * 0.35),
          borderCurve: 'continuous',
        }}
      />
    </Animated.View>
  );
}

function SkeletonSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: AppIconName;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { s, spacing } = useResponsive();
  const onGlass = useTravelItineraryOnGlass();
  const primaryInk = useTravelItineraryInk();
  const shellProps = useTravelItineraryShellProps();
  const accent = onGlass ? primaryInk : travelAccent(theme);
  const tap = Math.max(32, s(32));

  return (
    <TravelHomeGlass
      {...shellProps}
      style={[
        styles.section,
        {
          borderRadius: Math.max(14, s(16)),
          borderCurve: 'continuous',
        },
      ]}
    >
      <View
        style={[
          styles.sectionHeader,
          {
            minHeight: tap,
            paddingHorizontal: spacing.sm,
            paddingVertical: Math.max(6, s(6)),
            gap: TRAVEL_TITLE_ICON_GAP,
          },
        ]}
      >
        <Symbol name={icon} size="sm" color={accent} />
        <AppText
          variant="subheading"
          fit
          style={[
            travelEditorialTextStyle,
            { color: primaryInk, flexShrink: 1, minWidth: 0 },
          ]}
        >
          {title}
        </AppText>
      </View>
      <View
        style={{
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing.sm,
          gap: spacing.xs,
        }}
      >
        {children}
      </View>
    </TravelHomeGlass>
  );
}

/**
 * Immediate glass shells under the itinerary hero while heavy transport /
 * timeline / tools wait for the stack transition to settle.
 */
export function TravelPlanDetailBodySkeleton({
  cardHint = 3,
}: {
  /** Rough card count so the skeleton height tracks the trip. */
  cardHint?: number;
}) {
  const { s, spacing: rs } = useResponsive();
  const cards = Math.max(2, Math.min(4, cardHint || 3));
  const cardH = Math.max(72, s(78));
  const toolH = Math.max(56, s(60));

  return (
    <AgentTestId
      testID={AgentUiIds.travel.planDetail.bodyLoading}
      label="Loading itinerary"
    >
      <View
        accessibilityLabel="Loading itinerary"
        accessibilityState={{ busy: true }}
        style={{ gap: Math.max(rs.md, s(20)) }}
      >
        <SkeletonSection title="Transportation, Stays & Events" icon="backpack">
          {Array.from({ length: Math.min(2, cards) }, (_, i) => (
            <SkeletonBone key={`transport-${i}`} height={cardH} />
          ))}
        </SkeletonSection>

        <SkeletonSection title="Timeline" icon="clock">
          <SkeletonBone height={Math.max(36, s(40))} width="55%" />
          {Array.from({ length: cards }, (_, i) => (
            <View key={`timeline-${i}`} style={{ gap: Math.max(6, s(6)) }}>
              {i === 0 ? (
                <SkeletonBone height={Math.max(18, s(20))} width="34%" />
              ) : null}
              <SkeletonBone height={cardH} />
            </View>
          ))}
        </SkeletonSection>

        <SkeletonSection title="Trip Tools" icon="settings">
          <View style={[styles.toolsGrid, { gap: rs.xs }]}>
            {Array.from({ length: 4 }, (_, i) => (
              <View key={`tool-${i}`} style={styles.toolCell}>
                <SkeletonBone height={toolH} />
              </View>
            ))}
          </View>
        </SkeletonSection>
      </View>
    </AgentTestId>
  );
}

/** Compact day-card bones while later timeline days mount in batches. */
export function TravelTimelineDaySkeleton({ count = 1 }: { count?: number }) {
  const { s, spacing: rs } = useResponsive();
  const cardH = Math.max(72, s(78));
  return (
    <View style={{ gap: Math.max(16, s(18)), paddingTop: rs.sm }}>
      {Array.from({ length: Math.max(1, count) }, (_, i) => (
        <View key={`day-skel-${i}`} style={{ gap: Math.max(8, s(8)) }}>
          <SkeletonBone height={Math.max(22, s(24))} width="40%" />
          <SkeletonBone height={cardH} />
          <SkeletonBone height={cardH} width="92%" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  toolCell: {
    width: '48%',
    flexGrow: 1,
  },
});
