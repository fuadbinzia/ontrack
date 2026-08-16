import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassIconWell, Symbol } from '@/components/primitives';
import { fieldTitleCase } from '@/components/primitives/field-title-case';
import { radii } from '@/design-system';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import { TravelHomeRouteIcon } from '@/features/travel/travel-home-icons';
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
 * Zero-trips welcome — one frosted departure card crossing the hero fade.
 */
export function TravelHomeEmpty({ onAddTrip }: TravelHomeEmptyProps) {
  const theme = useTheme();
  const { s, spacing, layout } = useResponsive();
  const dark = theme.name === 'dark';

  const actionLabel = fieldTitleCase('Add Your First Trip');
  const handleAction = () => {
    haptics.tap();
    onAddTrip();
  };
  const agent = useAgentUiTarget(AgentUiIds.travel.list.emptyCreate, {
    label: actionLabel,
    onPress: handleAction,
  });

  const iconWell = Math.max(56, s(60));
  const planeSize = Math.max(26, s(28));
  const titleSize = Math.max(23, s(25));
  const messageSize = Math.max(15, s(16));
  const actionSize = Math.max(16, s(17));
  const actionHeight = Math.max(layout.minTapTarget, s(52));
  const cardRadius = Math.max(travelHomeTokens.radius.tripCard, s(28));
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
          paddingTop: Math.max(spacing.md, s(16)),
          paddingBottom: spacing.xxxl,
        },
      ]}>
      <TravelHomeGlass
        intensity={dark ? 50 : 64}
        style={[
          styles.card,
          {
            borderRadius: cardRadius,
            gap: spacing.lg,
            padding: Math.max(spacing.lg, s(20)),
            boxShadow: dark
              ? travelHomeTokens.colors.cardShadowDark
              : travelHomeTokens.colors.cardShadow,
          },
        ]}>
        <View style={[styles.headingRow, { gap: spacing.md }]}>
          <GlassIconWell size={iconWell} borderRadius={radii.pill} variant="mist">
            <Symbol name="flight" size={planeSize} color={brand} />
          </GlassIconWell>

          <View style={styles.titleWrap}>
            <AppText
              numberOfLines={2}
              adjustsFontSizeToFit
              style={{
                fontFamily: travelHomeFontFamily,
                fontSize: titleSize,
                lineHeight: Math.round(titleSize * 1.2),
                fontWeight: '600',
                color: titleColor,
              }}>
              Your next adventure starts here.
            </AppText>
          </View>
        </View>

        <AppText
          numberOfLines={4}
          style={{
            fontFamily: travelHomeFontFamily,
            fontSize: messageSize,
            lineHeight: Math.round(messageSize * 1.42),
            color: messageColor,
          }}>
          Add a trip to organize your itinerary, stays, activities, friends,
          and memories.
        </AppText>

        <Pressable
          ref={agent.ref}
          testID={AgentUiIds.travel.list.emptyCreate}
          onLayout={agent.onLayout}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={handleAction}
          hitSlop={8}
          style={({ pressed }) => [styles.actionHit, { opacity: pressed ? 0.84 : 1 }]}>
          <TravelHomeGlass
            inverted
            intensity={dark ? 48 : 58}
            style={[
              styles.action,
              {
                minHeight: actionHeight,
                borderRadius: Math.max(
                  travelHomeTokens.radius.button,
                  s(travelHomeTokens.radius.button),
                ),
                gap: spacing.sm,
                paddingHorizontal: spacing.lg,
              },
            ]}>
            <TravelHomeRouteIcon size={Math.max(22, s(24))} color="#FFFFFF" />
            <View style={styles.actionLabelWrap}>
              <AppText
                fit
                align="center"
                numberOfLines={1}
                style={{
                  fontFamily: travelHomeFontFamily,
                  fontSize: actionSize,
                  lineHeight: Math.round(actionSize * 1.25),
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}>
                {actionLabel}
              </AppText>
            </View>
          </TravelHomeGlass>
        </Pressable>
      </TravelHomeGlass>
    </View>
  );

  return (
    <AgentTestId
      testID={AgentUiIds.travel.list.sectionEmpty}
      style={styles.fill}>
      {body}
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  root: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    borderCurve: 'continuous',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  actionHit: {
    width: '100%',
  },
  action: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  actionLabelWrap: {
    minWidth: 0,
    flexShrink: 1,
  },
});
