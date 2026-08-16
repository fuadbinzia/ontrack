import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassIconWell, GlassPlate, Symbol } from '@/components/primitives';
import { fieldTitleCase } from '@/components/primitives/field-title-case';
import { radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

import { journalLandingFontFamily } from './journal-landing-atmosphere';

export function JournalLandingEmpty({ onStart }: { onStart: () => void }) {
  const theme = useTheme();
  const { s, spacing, layout } = useResponsive();
  const dark = theme.name === 'dark';

  const actionLabel = fieldTitleCase("Start Today's Journal");
  const handleAction = () => {
    haptics.tap();
    onStart();
  };
  const agent = useAgentUiTarget(AgentUiIds.journal.openToday, {
    label: actionLabel,
    onPress: handleAction,
  });

  const iconWell = Math.max(56, s(60));
  const titleSize = Math.max(23, s(25));
  const messageSize = Math.max(15, s(16));
  const actionSize = Math.max(16, s(17));
  const actionHeight = Math.max(layout.minTapTarget, s(52));
  const cardRadius = Math.max(28, s(28));
  const brand = theme.accentPrimary;
  const titleColor = dark ? theme.textPrimary : '#000000';
  const messageColor = dark ? theme.textSecondary : '#5A5A5A';

  const body = (
    <View
      style={[
        styles.root,
        {
          paddingTop: Math.max(spacing.md, s(16)),
          paddingBottom: spacing.xxxl,
        },
      ]}>
      <GlassPlate
        intensity={dark ? 50 : 64}
        style={[
          styles.card,
          {
            borderRadius: cardRadius,
            gap: spacing.lg,
            padding: Math.max(spacing.lg, s(20)),
          },
        ]}>
        <View style={[styles.headingRow, { gap: spacing.md }]}>
          <GlassIconWell size={iconWell} borderRadius={radii.pill} variant="mist">
            <Symbol name="journal" size={Math.max(26, s(28))} color={brand} />
          </GlassIconWell>
          <View style={styles.titleWrap}>
            <AppText
              numberOfLines={2}
              adjustsFontSizeToFit
              style={{
                fontFamily: journalLandingFontFamily,
                fontSize: titleSize,
                lineHeight: Math.round(titleSize * 1.2),
                fontWeight: '600',
                color: titleColor,
              }}>
              Your first page starts here.
            </AppText>
          </View>
        </View>

        <AppText
          numberOfLines={4}
          style={{
            fontFamily: journalLandingFontFamily,
            fontSize: messageSize,
            lineHeight: Math.round(messageSize * 1.42),
            color: messageColor,
          }}>
          Write a thought, dictate a note, or drop a voice memo. Private to this
          device — one page for each day.
        </AppText>

        <Pressable
          ref={agent.ref}
          testID={AgentUiIds.journal.openToday}
          onLayout={agent.onLayout}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={handleAction}
          hitSlop={8}
          style={({ pressed }) => [styles.actionHit, { opacity: pressed ? 0.84 : 1 }]}>
          <GlassPlate
            inverted
            intensity={dark ? 48 : 58}
            style={[
              styles.action,
              {
                minHeight: actionHeight,
                borderRadius: Math.max(16, s(16)),
                gap: spacing.sm,
                paddingHorizontal: spacing.lg,
              },
            ]}>
            <Symbol name="journal" size={Math.max(22, s(24))} color="#FFFFFF" />
            <View style={styles.actionLabelWrap}>
              <AppText
                fit
                align="center"
                numberOfLines={1}
                style={{
                  fontFamily: journalLandingFontFamily,
                  fontSize: actionSize,
                  lineHeight: Math.round(actionSize * 1.25),
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}>
                {actionLabel}
              </AppText>
            </View>
          </GlassPlate>
        </Pressable>
      </GlassPlate>
    </View>
  );

  return (
    <AgentTestId testID={AgentUiIds.journal.hubEmpty} style={styles.fill}>
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
