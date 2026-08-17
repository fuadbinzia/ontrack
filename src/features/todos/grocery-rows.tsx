import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  AppText,
  Card,
  CollapsibleBody,
  DisclosureChevron,
  GlassPlate,
  Symbol,
} from '@/components/primitives';
import { glassMaterials, layout, radii, spacing, typography } from '@/design-system';
import type { CombinedCompletion } from '@/features/todos/grocery-utils';
import { useTheme } from '@/hooks/use-theme';
import type { ChecklistRecipe, ChecklistTask } from '@/store/todos';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { formatCount } from '@/utils/grammar';
import { openHttpsUrl, safeHttpsUrl } from '@/utils/safe-url';

export function Checkbox({
  completion,
  disabled,
}: {
  completion: CombinedCompletion;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.checkbox,
        {
          backgroundColor:
            completion === 'unchecked' ? 'transparent' : theme.accentPrimary,
          borderColor:
            completion === 'unchecked' ? theme.separator : theme.accentPrimary,
          opacity: disabled ? 0.45 : 1,
        },
      ]}>
      {completion === 'checked' ? (
        <Symbol name="check" size={13} color={theme.textOnAccent} />
      ) : completion === 'mixed' ? (
        <View
          style={[styles.mixedMark, { backgroundColor: theme.textOnAccent }]}
        />
      ) : null}
    </View>
  );
}

export const GroceryTaskRow = memo(function GroceryTaskRow({
  task,
  canComplete,
  onToggle,
  onDelete,
}: {
  task: ChecklistTask;
  canComplete: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const toggleAgent = useAgentUiTarget(AgentUiIds.grocery.task(task.id), {
    label: task.ingredientName || task.title,
    onPress: canComplete ? onToggle : undefined,
  });
  return (
    <View style={[styles.taskRow, { borderTopColor: theme.separator }]}>
      <Pressable
        ref={toggleAgent.ref}
        testID={toggleAgent.testID}
        onLayout={toggleAgent.onLayout}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed, disabled: !canComplete }}
        disabled={!canComplete}
        onPress={onToggle}
        hitSlop={4}>
        <Checkbox
          completion={task.completed ? 'checked' : 'unchecked'}
          disabled={!canComplete}
        />
      </Pressable>
      <View style={styles.taskCopy}>
        <AppText
          variant="body"
          style={task.completed ? styles.completedText : undefined}>
          {task.ingredientName || task.title}
        </AppText>
        {task.recipeId ? (
          <AppText variant="caption" color="secondary">
            {[task.quantityText, task.unit, task.preparation]
              .filter(Boolean)
              .join(' · ') || 'Amount not specified'}
          </AppText>
        ) : null}
      </View>
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${task.title}`}
          onPress={onDelete}
          hitSlop={8}>
          <Symbol name="delete" size={17} color={theme.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
});

export const MealCard = memo(function MealCard({
  recipe,
  tasks,
  collapsed,
  listOwner,
  canComplete,
  onToggleTask,
  onToggleCollapsed,
  onDelete,
}: {
  recipe: ChecklistRecipe;
  tasks: ChecklistTask[];
  collapsed: boolean;
  listOwner: boolean;
  canComplete: (task: ChecklistTask) => boolean;
  onToggleTask: (task: ChecklistTask) => void;
  onToggleCollapsed: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const done = tasks.filter((task) => task.completed).length;
  const recipeAgent = useAgentUiTarget(AgentUiIds.grocery.recipe(recipe.id), {
    label: recipe.name,
    onPress: onToggleCollapsed,
  });
  return (
    <Card padded={false}>
      {recipe.sourceImageUri ? (
        <Image
          source={{ uri: recipe.sourceImageUri }}
          cachePolicy="memory-disk"
          recyclingKey={recipe.id}
          contentFit="cover"
          style={styles.recipeImage}
          transition={160}
        />
      ) : null}
      <Pressable
        ref={recipeAgent.ref}
        testID={recipeAgent.testID}
        onLayout={recipeAgent.onLayout}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        onPress={onToggleCollapsed}
        style={styles.mealHeader}>
        <View style={styles.mealHeaderCopy}>
          <AppText variant="heading">{recipe.name}</AppText>
          <AppText variant="caption" color="secondary">
            {recipe.targetServings
              ? `${formatCount(recipe.targetServings, 'serving')} · `
              : ''}
            {done} of {tasks.length} checked
          </AppText>
        </View>
        <DisclosureChevron
          expanded={!collapsed}
          size={19}
          color={theme.textSecondary}
        />
      </Pressable>
      <CollapsibleBody expanded={!collapsed}>
        <View>
          {(safeHttpsUrl(recipe.sourceUrl) || listOwner) ? (
            <View style={styles.mealActions}>
              {safeHttpsUrl(recipe.sourceUrl) ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void openHttpsUrl(recipe.sourceUrl)}
                  style={styles.sourceLink}>
                  <Symbol
                    name="open-external"
                    size={14}
                    color={theme.accentPrimary}
                  />
                  <AppText variant="caption" color="accent">
                    Open source
                  </AppText>
                </Pressable>
              ) : (
                <View />
              )}
              {listOwner ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onDelete}
                  hitSlop={8}>
                  <AppText variant="caption" color="danger">
                    Delete meal
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {tasks.map((task) => (
            <GroceryTaskRow
              key={task.id}
              task={task}
              canComplete={canComplete(task)}
              onToggle={() => onToggleTask(task)}
            />
          ))}
        </View>
      </CollapsibleBody>
    </Card>
  );
});

export const CombinedRow = memo(function CombinedRow({
  completion,
  disabled,
  first,
  name,
  amounts,
  occurrences,
  onToggle,
  testID,
}: {
  completion: CombinedCompletion;
  disabled: boolean;
  first: boolean;
  name: string;
  amounts: string[];
  occurrences: number;
  onToggle: () => void;
  testID?: string;
}) {
  const theme = useTheme();
  const agent = useAgentUiTarget(testID, {
    label: name,
    onPress: disabled ? undefined : onToggle,
  });
  return (
    <Pressable
      ref={agent.ref}
      testID={agent.testID}
      onLayout={agent.onLayout}
      accessibilityRole="checkbox"
      accessibilityState={{
        checked: completion === 'mixed' ? 'mixed' : completion === 'checked',
        disabled,
      }}
      disabled={disabled}
      onPress={onToggle}
      style={[
        styles.combinedRow,
        !first && { borderTopColor: theme.separator, borderTopWidth: 1 },
      ]}>
      <Checkbox completion={completion} disabled={disabled} />
      <View style={styles.taskCopy}>
        <AppText variant="body">{name}</AppText>
        <AppText variant="caption" color="secondary">
          {amounts.join(' + ')}
          {occurrences > 1 ? ` · ${occurrences} meals` : ''}
        </AppText>
      </View>
    </Pressable>
  );
});

export function OtherItems({
  tasks,
  owner,
  draft,
  onDraftChange,
  onAdd,
  onDelete,
  onToggle,
  canComplete,
}: {
  tasks: ChecklistTask[];
  owner: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onToggle: (task: ChecklistTask) => void;
  canComplete: (task: ChecklistTask) => boolean;
}) {
  const theme = useTheme();
  const dark = theme.name === 'dark';
  const plateBorder = dark
    ? glassMaterials.border.dark
    : glassMaterials.border.light;
  return (
    <View style={styles.otherSection}>
      <AppText variant="heading">Other items</AppText>
      {owner ? (
        <GlassPlate
          style={[
            styles.composer,
            {
              borderColor: draft.trim() ? theme.accentPrimary : plateBorder,
              borderWidth: draft.trim() ? 1 : StyleSheet.hairlineWidth,
            },
          ]}>
          <TextInput
            accessibilityLabel="New grocery item"
            maxLength={160}
            onChangeText={onDraftChange}
            onSubmitEditing={onAdd}
            placeholder="Milk, paper towels…"
            placeholderTextColor={theme.textTertiary}
            returnKeyType="done"
            underlineColorAndroid="transparent"
            style={[styles.composerInput, { color: theme.textPrimary }]}
            value={draft}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add grocery item"
            disabled={!draft.trim()}
            onPress={onAdd}
            style={[
              styles.addButton,
              {
                backgroundColor: draft.trim()
                  ? theme.accentPrimary
                  : theme.separator,
              },
            ]}>
            <Symbol name="add" size={18} color={theme.textOnAccent} />
          </Pressable>
        </GlassPlate>
      ) : null}
      {tasks.length ? (
        <Card padded={false}>
          {tasks.map((task) => (
            <GroceryTaskRow
              key={task.id}
              task={task}
              canComplete={canComplete(task)}
              onToggle={() => onToggle(task)}
              onDelete={owner ? () => onDelete(task.id) : undefined}
            />
          ))}
        </Card>
      ) : (
        <AppText variant="caption" color="tertiary">
          No standalone items.
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixedMark: {
    width: 11,
    height: 2,
    borderRadius: radii.pill,
  },
  taskRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  taskCopy: { flex: 1, gap: spacing.xxs },
  completedText: { textDecorationLine: 'line-through', opacity: 0.55 },
  recipeImage: { width: '100%', height: 160 },
  mealHeader: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  mealHeaderCopy: { flex: 1, gap: spacing.xs },
  mealActions: {
    minHeight: layout.minTapTarget,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  combinedRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  otherSection: { gap: spacing.md },
  composer: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radii.lg,
  },
  composerInput: {
    ...typography.body,
    flex: 1,
    minHeight: 52,
    paddingVertical: spacing.md,
    zIndex: 1,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
