import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { AppText, GlassIconWell, Symbol } from '@/components/primitives';
import { fieldTitleCase } from '@/components/primitives/field-title-case';
import { radii } from '@/design-system';
import {
  travelHomeFontFamily,
  travelHomeTokens,
} from '@/features/travel/travel-home-tokens';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

type TravelHomeEmptyProps = {
  onAddTrip: () => void;
};

/**
 * Zero-trips welcome — soft plane mark, serif invitation, text CTA.
 * Matches the Travel Home empty reference (hero fade + calm paper).
 */
export function TravelHomeEmpty({ onAddTrip }: TravelHomeEmptyProps) {
  const theme = useTheme();
  const { s, spacing, layout } = useResponsive();
  const dark = theme.name === 'dark';
  /** Remount on every Travel focus so FadeInDown replays (tab stays mounted). */
  const [entranceKey, setEntranceKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setEntranceKey((key) => key + 1);
    }, []),
  );

  const actionLabel = fieldTitleCase('Add Your First Trip');
  const handleAction = () => {
    haptics.tap();
    onAddTrip();
  };
  const agent = useAgentUiTarget(AgentUiIds.travel.list.emptyCreate, {
    label: actionLabel,
    onPress: handleAction,
  });

  const iconWell = Math.max(76, s(84));
  const planeSize = Math.max(34, s(38));
  const titleSize = Math.max(22, s(24));
  const messageSize = Math.max(15, s(16));
  const actionSize = Math.max(17, s(18));
  const brand = dark ? theme.accentPrimary : travelHomeTokens.colors.brandBlue;
  const titleColor = dark ? theme.textPrimary : travelHomeTokens.colors.ink;
  const messageColor = dark
    ? theme.textSecondary
    : travelHomeTokens.colors.inkMuted;

  const body = (
    <View
      style={[
        styles.root,
        {
          gap: spacing.md,
          paddingTop: Math.max(spacing.lg, s(20)),
          paddingBottom: spacing.xxxl,
          paddingHorizontal: spacing.xl,
        },
      ]}>
      <GlassIconWell
        size={iconWell}
        borderRadius={radii.pill}
        variant="mist">
        <Symbol name="flight" size={planeSize} color={brand} />
      </GlassIconWell>

      <AppText
        align="center"
        numberOfLines={2}
        adjustsFontSizeToFit
        style={{
          fontFamily: travelHomeFontFamily,
          fontSize: titleSize,
          lineHeight: Math.round(titleSize * 1.22),
          fontWeight: '600',
          color: titleColor,
        }}>
        Your next adventure starts here.
      </AppText>

      <AppText
        align="center"
        numberOfLines={4}
        style={{
          fontFamily: travelHomeFontFamily,
          fontSize: messageSize,
          lineHeight: Math.round(messageSize * 1.4),
          color: messageColor,
          maxWidth: s(320),
        }}>
        Add a trip to organize your itinerary, stays, activities, friends, and
        memories.
      </AppText>

      <Pressable
        ref={agent.ref}
        testID={AgentUiIds.travel.list.emptyCreate}
        onLayout={agent.onLayout}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={handleAction}
        hitSlop={8}
        style={({ pressed }) => [
          styles.actionHit,
          {
            minHeight: layout.minTapTarget,
            marginTop: spacing.sm,
            opacity: pressed ? 0.72 : 1,
            justifyContent: 'center',
          },
        ]}>
        {/* Editorial text CTA (mock) — not a glass pill; + FAB stays the chrome add. */}
        <AppText
          align="center"
          numberOfLines={1}
          style={{
            fontFamily: travelHomeFontFamily,
            fontSize: actionSize,
            lineHeight: Math.round(actionSize * 1.25),
            fontWeight: '700',
            color: titleColor,
          }}>
          {actionLabel}
        </AppText>
      </Pressable>
    </View>
  );

  return (
    <AgentTestId testID={AgentUiIds.travel.list.sectionEmpty}>
      {entranceKey > 0 ? (
        <Animated.View
          key={entranceKey}
          entering={FadeInDown.springify().damping(18)}>
          {body}
        </Animated.View>
      ) : (
        body
      )}
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  actionHit: {
    alignSelf: 'center',
    alignItems: 'center',
  },
});
