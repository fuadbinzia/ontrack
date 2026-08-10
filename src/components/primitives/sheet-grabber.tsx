import { Pressable, StyleSheet, View } from 'react-native';

import { colorWithAlpha, radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, useAgentUiTarget } from '@/utils/agent-ui';

export type SheetGrabberProps = {
  testID?: string;
  /** When set, tap dismisses (agent-ui + a11y). Visual stays a swipe cue. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * Centered top-of-sheet swipe affordance. Replaces header back / X on bottom sheets.
 * Pass `onPress` so agent-ui `.close` ids and VoiceOver still dismiss.
 */
export function SheetGrabber({
  testID,
  onPress,
  accessibilityLabel = 'Dismiss',
}: SheetGrabberProps) {
  const theme = useTheme();
  const { s, spacing, layout } = useResponsive();
  const agent = useAgentUiTarget(testID, { label: accessibilityLabel, onPress });

  const pill = (
    <View
      style={[
        styles.pill,
        {
          width: s(36),
          height: s(5),
          backgroundColor: colorWithAlpha(theme.textSecondary, 0.55),
        },
      ]}
    />
  );

  if (onPress) {
    return (
      <Pressable
        ref={agent.ref}
        testID={testID}
        onLayout={agent.onLayout}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Swipe down or tap to dismiss"
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [
          styles.slot,
          {
            paddingTop: spacing.xs,
            paddingBottom: spacing.xxs,
            minHeight: layout.minTapTarget,
            opacity: pressed ? 0.7 : 1,
          },
        ]}>
        {pill}
      </Pressable>
    );
  }

  return (
    <AgentTestId testID={testID} label={accessibilityLabel} style={styles.slot}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.slot,
          { paddingTop: spacing.xs, paddingBottom: spacing.xxs },
        ]}>
        {pill}
      </View>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    borderRadius: radii.pill,
  },
});
