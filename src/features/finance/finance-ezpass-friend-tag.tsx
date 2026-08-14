import { Pressable, StyleSheet } from 'react-native';

import { GlassIconWell, Symbol } from '@/components/primitives';
import { ProfileAvatar } from '@/features/account/profile-avatar';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

import { ezPassFirstName } from './ezpass-model';
import type { FinanceTransaction } from './types';

export function FinanceEzPassFriendTag({
  transaction,
  onPress,
}: {
  transaction: FinanceTransaction;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { layout, s } = useResponsive();
  const displayName = transaction.ezPassFriendName?.trim();
  const firstName = ezPassFirstName(transaction.ezPassFriendName);
  const assigned = Boolean(transaction.ezPassFriendId && displayName);
  const label = assigned
    ? `Assigned to ${firstName}. Change driver`
    : 'Assign this E-ZPass activity to a friend';
  const handlePress = () => {
    haptics.select();
    onPress();
  };
  const agent = useAgentUiTarget(AgentUiIds.finance.ezpass.friendTag(transaction.id), {
    label,
    onPress: handlePress,
  });
  const iconSize = Math.max(28, s(30));

  return (
    <Pressable
      ref={agent.ref}
      onLayout={agent.onLayout}
      testID={agent.testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={handlePress}
      hitSlop={4}
      style={[styles.control, { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget }]}>
      {assigned ? (
        <ProfileAvatar
          displayName={displayName!}
          userId={transaction.ezPassFriendId}
          size={iconSize}
          accessibilityLabel={firstName}
        />
      ) : (
        <GlassIconWell size={iconSize} borderRadius={iconSize / 2}>
          <Symbol name="people" size="sm" color={theme.textSecondary} />
        </GlassIconWell>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
