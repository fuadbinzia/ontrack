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
  /**
   * `false` when a parent header gesture owns pan/tap dismiss — keeps agent-ui
   * + VoiceOver without a Pressable that steals the swipe.
   */
  interactive?: boolean;
};

/**
 * Centered top-of-sheet swipe affordance. Replaces header back / X on bottom sheets.
 * Pass `onPress` so agent-ui `.close` ids and VoiceOver still dismiss.
 */
export function SheetGrabber({
  testID,
  onPress,
  accessibilityLabel = 'Dismiss',
  interactive = true,
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

  // Compact lip inset; hitSlop + parent header pan keep dismiss easy.
  const slotPad = {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  };
  const dismissHitSlop = Math.max(
    8,
    Math.ceil((layout.minTapTarget - s(5) - spacing.xs - spacing.xs) / 2),
  );

  if (onPress && interactive) {
    return (
      <Pressable
        ref={agent.ref}
        testID={testID}
        onLayout={agent.onLayout}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Swipe down or tap to dismiss"
        onPress={onPress}
        hitSlop={dismissHitSlop}
        style={({ pressed }) => [
          styles.slot,
          slotPad,
          { opacity: pressed ? 0.7 : 1 },
        ]}>
        {pill}
      </Pressable>
    );
  }

  if (onPress && !interactive) {
    return (
      <View
        ref={agent.ref}
        testID={testID}
        onLayout={agent.onLayout}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Swipe down or tap to dismiss"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') onPress();
        }}
        // RNTL `fireEvent.press`; parent header gesture handles finger tap/pan.
        {...({ onPress } as object)}
        style={[styles.slot, slotPad]}>
        {pill}
      </View>
    );
  }

  return (
    <AgentTestId testID={testID} label={accessibilityLabel} style={styles.slot}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.slot, slotPad]}>
        {pill}
      </View>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pill: {
    borderRadius: radii.pill,
  },
});