import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassPlate, Symbol } from '@/components/primitives';
import { glassMaterials, layout, radii, spacing } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { ChecklistFilter } from './todo-sort';

const QUICK_START_TASKS = [
  'Plan tomorrow',
  'Take a movement break',
  'Call someone I care about',
] as const;

export function ChecklistEmptyState({
  filter,
  hasTasks,
  assigneeFilterLabel,
  onAddSuggestion,
  onFocusComposer,
  onShowCompleted,
}: {
  filter: ChecklistFilter;
  hasTasks: boolean;
  assigneeFilterLabel?: string;
  onAddSuggestion: (title: string) => void;
  onFocusComposer: () => void;
  onShowCompleted: () => void;
}) {
  const theme = useTheme();
  const { s } = useResponsive();
  const dark = theme.name === 'dark';
  const plateBorder = dark
    ? glassMaterials.border.dark
    : glassMaterials.border.light;

  if (assigneeFilterLabel) {
    return (
      <View style={styles.empty}>
        <GlassPlate
          airy
          style={[styles.emptyIcon, { borderColor: plateBorder }]}>
          <Symbol name="filter" size={24} color={theme.accentPrimary} />
        </GlassPlate>
        <AppText
          variant="heading"
          style={{ fontSize: s(21), lineHeight: s(26) }}>
          No matching items
        </AppText>
        <AppText
          variant="body"
          color="secondary"
          align="center"
          style={[
            styles.emptyBody,
            { fontSize: s(14), lineHeight: s(20) },
          ]}>
          No {filter === 'completed' ? 'closed' : 'open'} items are assigned to{' '}
          {assigneeFilterLabel}.
        </AppText>
      </View>
    );
  }

  if (filter === 'completed') {
    return (
      <View style={styles.empty}>
        <GlassPlate
          airy
          style={[styles.emptyIcon, { borderColor: plateBorder }]}>
          <Symbol
            name="status-completed"
            size={24}
            color={theme.textTertiary}
          />
        </GlassPlate>
        <AppText
          variant="heading"
          style={{ fontSize: s(21), lineHeight: s(26) }}>
          A clean slate
        </AppText>
        <AppText
          variant="body"
          color="secondary"
          align="center"
          style={[
            styles.emptyBody,
            { fontSize: s(14), lineHeight: s(20) },
          ]}>
          Completed tasks will collect here when you’re ready to look back.
        </AppText>
      </View>
    );
  }

  if (hasTasks) {
    return (
      <View style={styles.empty}>
        <GlassPlate
          airy
          style={[
            styles.emptyIcon,
            { borderColor: `${theme.accentPrimary}55` },
          ]}>
          <Symbol name="status-completed" size={24} color={theme.success} />
        </GlassPlate>
        <AppText
          variant="heading"
          style={{ fontSize: s(21), lineHeight: s(26) }}>
          All caught up
        </AppText>
        <AppText
          variant="body"
          color="secondary"
          align="center"
          style={[
            styles.emptyBody,
            { fontSize: s(14), lineHeight: s(20) },
          ]}>
          Enjoy the space you made—or add the next small thing.
        </AppText>
        <View style={styles.emptyActions}>
          <Pressable
            accessibilityRole="button"
            hitSlop={2}
            onPress={onShowCompleted}
            style={({ pressed }) => [pressed && styles.pressed]}>
            <GlassPlate
              airy
              style={[styles.emptyAction, { borderColor: plateBorder }]}>
              <AppText variant="callout" style={styles.plateContent}>
                View completed
              </AppText>
            </GlassPlate>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            hitSlop={2}
            onPress={onFocusComposer}
            style={({ pressed }) => [
              styles.emptyAction,
              { backgroundColor: theme.accentPrimary },
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="callout" color="onAccent">
              Add another
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.empty}>
      <GlassPlate
        airy
        style={[
          styles.emptyIcon,
          { borderColor: `${theme.accentPrimary}55` },
        ]}>
        <Symbol name="tasks" size={24} color={theme.accentPrimary} />
      </GlassPlate>
      <AppText
        variant="heading"
        style={{ fontSize: s(21), lineHeight: s(26) }}>
        Your list is wide open
      </AppText>
      <AppText
        variant="body"
        color="secondary"
        align="center"
        style={[
          styles.emptyBody,
          { fontSize: s(14), lineHeight: s(20) },
        ]}>
        Start with one clear, kind commitment to yourself.
      </AppText>
      <View style={styles.suggestions}>
        {QUICK_START_TASKS.map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            accessibilityLabel={`Add ${suggestion}`}
            onPress={() => onAddSuggestion(suggestion)}
            style={({ pressed }) => [pressed && styles.pressed]}>
            <GlassPlate
              airy
              style={[styles.suggestion, { borderColor: plateBorder }]}>
              <Symbol
                name="add"
                size={15}
                color={theme.accentPrimary}
              />
              <AppText variant="caption" style={styles.plateContent}>
                {suggestion}
              </AppText>
            </GlassPlate>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.xl,
    borderCurve: 'continuous',
  },
  emptyBody: {
    maxWidth: 340,
  },
  emptyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  emptyAction: {
    minHeight: layout.minTapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: radii.pill,
  },
  suggestions: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  suggestion: {
    minHeight: layout.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  plateContent: { zIndex: 1 },
  pressed: { opacity: 0.62 },
});
