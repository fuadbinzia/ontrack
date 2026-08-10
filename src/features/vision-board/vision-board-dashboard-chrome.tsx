import { Pressable, StyleSheet } from 'react-native';

import { AppText, GlassPlate, Symbol } from '@/components/primitives';
import { fontFamilies, radii, spacing, type AppIconName } from '@/design-system';
import { useAgentUiTarget } from '@/utils/agent-ui';

import { countVisionBoardItems } from './selectors';

export function countLabel(counts: ReturnType<typeof countVisionBoardItems>) {
  if (counts.total === 0) return 'No items yet';
  const parts = [
    counts.image ? `${counts.image} ${counts.image === 1 ? 'photo' : 'photos'}` : '',
    counts.affirmation
      ? `${counts.affirmation} ${counts.affirmation === 1 ? 'quote' : 'quotes'}`
      : '',
    counts.goal ? `${counts.goal} ${counts.goal === 1 ? 'goal' : 'goals'}` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

export function boardFillPercent(counts: ReturnType<typeof countVisionBoardItems>) {
  return Math.min(100, Math.round((counts.total / 8) * 100));
}

export function VisionSectionChip({
  label,
  icon,
  color,
  onPress,
  accessibilityLabel,
  testID,
}: {
  label: string;
  icon: AppIconName;
  color: string;
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
}) {
  const agent = useAgentUiTarget(testID, {
    label: accessibilityLabel,
    onPress,
  });
  return (
    <Pressable
      ref={agent.ref}
      testID={testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.78 : 1 }]}>
      <GlassPlate airy style={styles.sectionChip}>
        <Symbol name={icon} size={16} color={color} />
        <AppText fit style={[styles.sectionButtonText, { color }]}>
          {label}
        </AppText>
      </GlassPlate>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionChip: {
    zIndex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  sectionButtonText: {
    fontFamily: fontFamilies.serif,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    flexShrink: 1,
    minWidth: 0,
  }
});
