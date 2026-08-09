import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { spacing as tokenSpacing } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { goBackOrReplace } from '@/utils/navigation';

import { AppText } from './app-text';
import { IconButton } from './button';
import { Symbol } from './symbol';

export function BackButton({
  accessibilityLabel = 'Go Back',
  fallback = '/',
  testID = AgentUiIds.chrome.back,
}: {
  accessibilityLabel?: string;
  fallback?: Href;
  testID?: string;
}) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <IconButton
        icon="chevron-left"
        accessibilityLabel={accessibilityLabel}
        background="transparent"
        testID={testID}
        onPress={() => goBackOrReplace(router, fallback)}
      />
    </View>
  );
}

/** Back control used by the shared native stack header on every non-root route. */
export function HeaderBackButton({
  accessibilityLabel = 'Go Back',
  fallback = '/',
  alwaysNavigateTo,
  onPress,
  testID = AgentUiIds.chrome.headerBack,
  /** Match `ScreenHeader` eyebrow / overline chrome (hit target stays ≥44 via hitSlop). */
  compact = false,
  /** Overline label beside the chevron — whole row is the back hit target. */
  label,
}: {
  accessibilityLabel?: string;
  fallback?: Href;
  /** When set, always navigate here instead of popping the stack. */
  alwaysNavigateTo?: Href;
  /** Embedded flows can provide their own back/cancel transition. */
  onPress?: () => void;
  testID?: string;
  compact?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const theme = useTheme();
  const { typography, layout, spacing } = useResponsive();

  const handlePress = () => {
    try {
      haptics.tap();
    } catch {
      // Best-effort haptics should never block the button action.
    }
    if (onPress) {
      onPress();
      return;
    }
    if (alwaysNavigateTo) {
      router.replace(alwaysNavigateTo);
      return;
    }
    goBackOrReplace(router, fallback);
  };

  const agent = useAgentUiTarget(testID, {
    label: accessibilityLabel,
    onPress: handlePress,
  });

  if (!compact) {
    return (
      <IconButton
        icon="back"
        accessibilityLabel={accessibilityLabel}
        background="transparent"
        testID={testID}
        onPress={handlePress}
      />
    );
  }

  // Overline-matched chrome: glyph ≈ eyebrow cap height; ≥44pt via minHeight (not only hitSlop).
  // `Symbol` scales numeric sizes — pass the design-token base, not the already-scaled type size.
  const line = Math.round(typography.overline.lineHeight);
  const tap = layout.minTapTarget;
  const labeled = Boolean(label);

  return (
    <Pressable
      ref={agent.ref}
      testID={testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.compact,
        labeled ? styles.compactLabeled : null,
        {
          width: labeled ? undefined : tap,
          minWidth: labeled ? undefined : tap,
          minHeight: tap,
          // Keep the glyph/label optically on the overline; pad the tap shell.
          paddingVertical: Math.max(0, (tap - line) / 2),
          gap: labeled ? spacing.xs : undefined,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <Symbol name="back" size={11} color={theme.accentPrimary} />
      {labeled ? (
        <AppText variant="overline" color="accent" fit style={styles.compactLabel}>
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'flex-start', marginBottom: tokenSpacing.sm },
  compact: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fill the ScreenHeader eyebrow leading slot — label stays left-aligned.
  compactLabeled: {
    flexDirection: 'row',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  compactLabel: {
    flexShrink: 1,
    minWidth: 0,
  },
});