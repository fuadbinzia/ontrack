import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  GlassIconWell,
  GlassPlate,
  Symbol,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

export function TodoLinkedTripAction({
  tripTitle,
  onPress,
}: {
  tripTitle: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { s, spacing } = useResponsive();

  return (
    <AgentTestId
      testID={AgentUiIds.checklists.detail.linkedTrip}
      label={`Open ${tripTitle} in Travel`}
      onPress={onPress}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${tripTitle} in Travel`}
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
        <GlassPlate
          airy
          style={[
            styles.plate,
            {
              minHeight: Math.max(48, s(48)),
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
            },
          ]}>
          <GlassIconWell size={Math.max(32, s(32))}>
            <Symbol name="backpack" size={17} color={theme.accentPrimary} />
          </GlassIconWell>
          <View style={styles.copy}>
            <AppText variant="caption" color="secondary" fit>
              Linked trip
            </AppText>
            <AppText variant="callout" numberOfLines={1} fit>
              {tripTitle}
            </AppText>
          </View>
          <Symbol name="chevron-right" size={17} color={theme.textTertiary} />
        </GlassPlate>
      </Pressable>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    minWidth: 0,
  },
  plate: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
  },
});
