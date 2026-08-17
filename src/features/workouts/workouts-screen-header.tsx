import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText, GlassPlate, Symbol } from '@/components/primitives';
import { fontFamilies, radii, spacing } from '@/design-system';
import { ChallengeFriendButton } from '@/features/workouts/challenge-friend-button';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

export function WorkoutsScreenHeader({
  todaysCount,
  gymColors,
  onOpenCustomPlanner,
}: {
  todaysCount: number;
  gymColors: { main: string; tint: string };
  onOpenCustomPlanner: () => void;
}) {
  const theme = useTheme();
  const { s } = useResponsive();
  const titleSize = s(34);
  const titleControlSize = s(30);
  const customPlannerAgent = useAgentUiTarget(AgentUiIds.workouts.customPlanner, {
    label: 'Plan a custom workout',
    onPress: onOpenCustomPlanner,
  });

  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <View style={[styles.eyebrowRow, { height: titleControlSize }]}>
          <View style={[styles.eyebrowLabelWrap, { height: titleControlSize }]}>
            <AppText
              variant="overline"
              color="accent"
              fit
              style={[
                styles.eyebrowLabel,
                {
                  fontSize: s(11),
                  lineHeight: s(13),
                  // Optical top-align with the pill/button.
                  marginTop: s(-1),
                },
              ]}>
              Strength Studio
            </AppText>
          </View>
          <View style={styles.eyebrowActions}>
            <View
              style={[
                styles.schedulePill,
                {
                  backgroundColor: gymColors.tint,
                  height: titleControlSize,
                },
              ]}>
              <View style={[styles.scheduleDot, { backgroundColor: gymColors.main }]} />
              <AppText variant="caption" color="secondary" fit>
                {todaysCount === 0 ? 'Plan is open' : `${todaysCount} today`}
              </AppText>
            </View>
            <Pressable
              ref={customPlannerAgent.ref}
              testID={customPlannerAgent.testID}
              onLayout={customPlannerAgent.onLayout}
              accessibilityRole="button"
              accessibilityLabel="Plan a custom workout"
              hitSlop={8}
              onPress={onOpenCustomPlanner}
              style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}>
              <GlassPlate
                airy
                style={[
                  styles.headerAction,
                  {
                    width: titleControlSize,
                    height: titleControlSize,
                    borderRadius: titleControlSize / 2,
                    borderColor: theme.separator,
                  },
                ]}>
                <View style={styles.glassContent}>
                  <Symbol
                    name="slider.horizontal.3"
                    size="sm"
                    color={theme.textPrimary}
                  />
                </View>
              </GlassPlate>
            </Pressable>
          </View>
        </View>
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={[
            styles.titleText,
            {
              color: theme.textPrimary,
              fontSize: titleSize,
              lineHeight: Math.round(titleSize * 1.12),
            },
          ]}>
          Build around your body.
        </Text>
        <AppText variant="body" color="secondary" style={styles.headerBody}>
          Explore the anatomy, choose a focus, and shape a session that feels intentional.
        </AppText>
        <ChallengeFriendButton style={styles.challengeFriend} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 0,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyebrowActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 0,
    gap: spacing.sm,
  },
  eyebrowLabelWrap: {
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'flex-start',
  },
  eyebrowLabel: {
    includeFontPadding: false,
    letterSpacing: 1.2,
  },
  schedulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
  scheduleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  titleText: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
    letterSpacing: -0.6,
    includeFontPadding: false,
  },
  headerBody: {
    maxWidth: 500,
  },
  challengeFriend: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  glassContent: { zIndex: 1 },
  headerAction: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    boxShadow: '0 4px 16px rgba(27, 24, 21, 0.08)',
  },
});
