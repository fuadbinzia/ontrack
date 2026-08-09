import type { PropsWithChildren, ReactNode, Ref } from 'react';
import { Pressable, StyleSheet, type LayoutChangeEvent, type View } from 'react-native';

import { AppText } from '@/components/primitives';
import { radii, spacing } from '@/design-system';

export function ProviderButton({
  children,
  icon,
  onPress,
  disabled,
  backgroundColor,
  borderColor,
  textColor,
  accessibilityLabel,
  testID,
  buttonRef,
  onLayout,
}: PropsWithChildren<{
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  accessibilityLabel: string;
  testID?: string;
  /** Agent-ui registration (`useAgentUiTarget`) so taps/asserts resolve. */
  buttonRef?: Ref<View>;
  onLayout?: (event: LayoutChangeEvent) => void;
}>) {
  return (
    <Pressable
      ref={buttonRef}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      accessibilityState={{ disabled, busy: disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.55 : pressed ? 0.82 : 1,
        },
      ]}>
      {icon}
      <AppText variant="bodyMedium" style={{ color: textColor }}>
        {children}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    width: '100%',
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
