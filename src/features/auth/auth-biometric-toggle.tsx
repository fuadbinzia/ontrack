import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassIconWell, GlassSwitch, Symbol } from '@/components/primitives';
import { radii } from '@/design-system';
import type { AppIconName } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

export function AuthBiometricToggle({
  label,
  icon,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  icon: Extract<AppIconName, 'faceid' | 'fingerprint'>;
  value: boolean;
  disabled?: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const theme = useTheme();
  const { layout, s, spacing } = useResponsive();
  const handlePress = disabled
    ? undefined
    : () => {
        haptics.select();
        onValueChange(!value);
      };
  const agent = useAgentUiTarget(AgentUiIds.auth.unlockBiometric, {
    label,
    onPress: handlePress,
  });

  return (
    <Pressable
      ref={agent.ref}
      testID={AgentUiIds.auth.unlockBiometric}
      onLayout={agent.onLayout}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: layout.minTapTarget,
          gap: spacing.sm,
          opacity: disabled ? 0.55 : pressed ? 0.78 : 1,
        },
      ]}>
      <GlassIconWell size={s(34)} borderRadius={radii.sm}>
        <Symbol name={icon} size="sm" color={theme.accentPrimary} />
      </GlassIconWell>
      <View style={styles.label}>
        <AppText variant="callout" fit titleCase>
          {label}
        </AppText>
      </View>
      <View pointerEvents="none" accessible={false}>
        <GlassSwitch accessibilityLabel={label} disabled={disabled} value={value} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  label: { flex: 1, minWidth: 0 },
});
