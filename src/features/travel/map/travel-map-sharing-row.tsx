import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassPlate, GlassSwitch } from '@/components/primitives';
import { radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

export function TravelMapSharingRow({
  enabled,
  disabled,
  onPress,
}: {
  enabled: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { spacing } = useResponsive();
  const agent = useAgentUiTarget(AgentUiIds.travel.map.shareToggle, {
    label: 'Share my map with friends',
    onPress,
  });

  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="switch"
      accessibilityLabel="Share my map with friends"
      accessibilityState={{ checked: enabled, disabled }}
      onPress={onPress}>
      <GlassPlate
        airy
        style={[
          styles.plate,
          { gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
        ]}>
        <View style={styles.copy}>
          <AppText variant="callout" fit>Share my map</AppText>
          <AppText variant="caption" color="secondary">
            Accepted friends can see your pins and trip summaries.
          </AppText>
        </View>
        <GlassSwitch value={enabled} disabled={disabled} />
      </GlassPlate>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plate: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
