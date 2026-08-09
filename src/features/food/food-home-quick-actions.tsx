import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassIconWell, GlassPlate, Symbol } from '@/components/primitives';
import { radii, type AppIconName } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

type QuickAction = {
  id: string;
  label: string;
  icon: AppIconName;
  route: string;
};

const ACTIONS: readonly QuickAction[] = [
  { id: 'scan', label: 'Scan', icon: 'scan', route: '/(tabs)/food/scan' },
  { id: 'askAi', label: 'Ask AI', icon: 'ai-chef', route: '/(tabs)/food/ai-ideas' },
  { id: 'recipes', label: 'Recipes', icon: 'recipe', route: '/(tabs)/food/recipes' },
  { id: 'track', label: 'Track', icon: 'nutrition', route: '/(tabs)/food/tracker' },
  { id: 'plan', label: 'Plan', icon: 'meal-plan', route: '/(tabs)/food/plan' },
  { id: 'community', label: 'Community', icon: 'people', route: '/(tabs)/food/community' },
];

/** Scan / Ask AI / Recipes / Track / Plan / Community — 3×2, compact 2×3. */
export function FoodHomeQuickActions() {
  const { spacing, widthClass } = useResponsive();
  // Compact phones can't hold three labeled tiles on one line — wrap 2×3.
  const columns = widthClass === 'compact' ? 2 : 3;

  return (
    <View style={[styles.grid, { gap: spacing.sm }]}>
      {ACTIONS.map((action) => (
        <QuickActionTile key={action.id} action={action} columns={columns} />
      ))}
    </View>
  );
}

function QuickActionTile({
  action,
  columns,
}: {
  action: QuickAction;
  columns: 2 | 3;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { spacing, s, layout } = useResponsive();
  const handlePress = () => {
    haptics.select();
    router.push(action.route as never);
  };
  const agent = useAgentUiTarget(AgentUiIds.food.home.quickAction(action.id), {
    label: action.label,
    onPress: handlePress,
  });

  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.tileHit,
        {
          flexBasis: columns === 3 ? '30%' : '46%',
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      <GlassPlate
        style={[
          styles.tile,
          {
            minHeight: Math.max(layout.minTapTarget, s(72)),
            borderRadius: radii.lg,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.sm,
            gap: spacing.sm,
          },
        ]}>
        <GlassIconWell size={Math.max(36, s(38))}>
          <Symbol name={action.icon} size="sm" color={theme.accentPrimary} />
        </GlassIconWell>
        <AppText variant="callout" fit numberOfLines={1}>
          {action.label}
        </AppText>
      </GlassPlate>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tileHit: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
});
