import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionChip,
  AppText,
  appPrompt,
  Button,
  Card,
  EmptyState,
  SectionHeader,
} from '@/components/primitives';
import { AvatarStack } from '@/features/food/components/avatar-stack';
import { GroceryItemEditorSheet } from '@/features/food/grocery-item-editor-sheet';
import {
  buildMealPlanGroceryRecipes,
  describeMealPlanGeneration,
} from '@/features/food/plan-generate';
import { Checkbox, CombinedRow } from '@/features/todos/grocery-rows';
import { buildCombinedIngredients } from '@/features/todos/grocery-utils';
import { useAuthSession } from '@/features/auth/auth-provider';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useMealPlan } from '@/store/food-meal-plan';
import { useRecipes } from '@/store/food-recipes';
import {
  canCompleteTodo,
  canEditTodoContent,
  useTodos,
  type TodoTask,
} from '@/store/todos';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { addDays, todayKey } from '@/utils/date';
import { haptics } from '@/utils/haptics';
import { listReferenceEquality } from '@/utils/list-equality';

/**
 * Shopping list panel — a Food-flavored window onto the EXISTING todos
 * grocery list (SCREENS.md §10). All reads/writes go through `useTodos`;
 * combined rows reuse `grocery-rows` + `buildCombinedIngredients`.
 */
export function PlanShoppingPanel() {
  const router = useRouter();
  const theme = useTheme();
  const { spacing } = useResponsive();
  const { user } = useAuthSession();

  const groceryLists = useTodos(
    (state) => state.lists.filter((list) => list.kind === 'grocery'),
    listReferenceEquality,
  );
  const createList = useTodos((state) => state.createList);
  const addRecipe = useTodos((state) => state.addRecipe);
  const setTasksCompletion = useTodos((state) => state.setTasksCompletion);
  const setTaskCompletion = useTodos((state) => state.setTaskCompletion);

  const [selectedListId, setSelectedListId] = useState<string | undefined>();
  const list =
    groceryLists.find((item) => item.id === selectedListId) ?? groceryLists[0];

  const tasks = useTodos(
    (state) => state.tasks.filter((task) => task.listId === list?.id),
    listReferenceEquality,
  );
  const todoRecipes = useTodos(
    (state) => state.recipes.filter((recipe) => recipe.listId === list?.id),
    listReferenceEquality,
  );
  const members = useTodos(
    (state) => state.members.filter((member) => member.listId === list?.id),
    listReferenceEquality,
  );

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<TodoTask | undefined>();

  const combined = useMemo(() => buildCombinedIngredients(tasks), [tasks]);
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const standalone = useMemo(
    () => tasks.filter((task) => !task.recipeId),
    [tasks],
  );

  const canEdit = list ? canEditTodoContent(list) : false;

  const openEditor = (task?: TodoTask) => {
    setEditingTask(task);
    setEditorVisible(true);
  };

  const generate = () => {
    if (!list) return;
    const today = todayKey();
    const entries = useMealPlan
      .getState()
      .entriesForRange(today, addDays(today, 6));
    const savedRecipes = useRecipes.getState().recipes;
    const result = buildMealPlanGroceryRecipes(
      entries,
      savedRecipes,
      todoRecipes.map((recipe) => recipe.name),
    );
    for (const input of result.recipes) {
      addRecipe(list.id, input);
    }
    if (result.recipes.length > 0) haptics.success();
    appPrompt.alert('Generate from Meal Plan', describeMealPlanGeneration(result));
  };

  if (!list) {
    return (
      <AgentTestId
        testID={AgentUiIds.food.plan.shoppingSection}
        label="Shopping list"
        style={{ gap: spacing.sm }}>
        <SectionHeader flush title="Shopping List" />
        <EmptyState
          icon="groceries"
          title="No grocery list yet"
          message="Create one to collect ingredients from your meal plan."
          actionLabel="Create Grocery List"
          actionTestID={AgentUiIds.food.plan.createList}
          onAction={() => {
            const created = createList('Groceries', 'grocery');
            if (created) setSelectedListId(created.id);
          }}
        />
      </AgentTestId>
    );
  }

  return (
    <AgentTestId
      testID={AgentUiIds.food.plan.shoppingSection}
      label="Shopping list"
      style={{ gap: spacing.sm }}>
      <SectionHeader
        flush
        title="Shopping List"
        actionLabel="Open Full List"
        actionTestID={AgentUiIds.food.plan.openList}
        onAction={() => router.push(`/todos/${list.id}` as never)}
      />

      {groceryLists.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}>
          {groceryLists.map((item) => (
            <ActionChip
              key={item.id}
              label={item.name}
              selected={item.id === list.id}
              testID={AgentUiIds.food.plan.list(item.id)}
              onPress={() => setSelectedListId(item.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {list.mode === 'shared' && members.length > 0 ? (
        <View style={[styles.sharedRow, { gap: spacing.sm }]}>
          <AvatarStack
            people={members.map((member) => ({
              id: member.userId,
              displayName: member.displayName,
              userId: member.userId,
            }))}
          />
          <AppText variant="caption" color="secondary" fit style={styles.shrink}>
            Shared list — checks sync for everyone
          </AppText>
        </View>
      ) : null}

      <View style={[styles.actionsRow, { gap: spacing.sm }]}>
        {canEdit ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              icon="meal-plan"
              testID={AgentUiIds.food.plan.generate}
              onPress={generate}>
              Generate from Meal Plan
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon="add"
              testID={AgentUiIds.food.plan.addItem}
              onPress={() => openEditor(undefined)}>
              Add Item
            </Button>
          </>
        ) : (
          <AppText variant="caption" color="secondary">
            You can check items off, but only editors can add to this list.
          </AppText>
        )}
      </View>

      {tasks.length === 0 ? (
        <EmptyState
          icon="groceries"
          title="Nothing to shop for"
          message="Generate from your meal plan or add items by hand."
        />
      ) : (
        <>
          {combined.length > 0 ? (
            <Card padded={false}>
              {combined.map((group, index) => {
                const groupTasks = group.taskIds
                  .map((id) => tasksById.get(id))
                  .filter((task): task is TodoTask => Boolean(task));
                const canToggle =
                  groupTasks.length > 0 &&
                  groupTasks.every((task) =>
                    canCompleteTodo(list, task, user?.id),
                  );
                return (
                  <CombinedRow
                    key={group.id}
                    completion={group.completion}
                    disabled={!canToggle}
                    first={index === 0}
                    name={group.name}
                    amounts={group.amountFragments}
                    occurrences={group.totalCount}
                    testID={AgentUiIds.food.plan.item(group.canonicalKey)}
                    onToggle={() => {
                      haptics.select();
                      setTasksCompletion(
                        group.taskIds,
                        group.completion !== 'checked',
                        user?.id,
                      );
                    }}
                  />
                );
              })}
            </Card>
          ) : null}

          {standalone.length > 0 ? (
            <Card padded={false}>
              {standalone.map((task, index) => (
                <StandaloneItemRow
                  key={task.id}
                  task={task}
                  first={index === 0}
                  separatorColor={theme.separator}
                  canComplete={canCompleteTodo(list, task, user?.id)}
                  canEdit={canEdit}
                  onToggle={() => {
                    haptics.select();
                    setTaskCompletion(task.id, !task.completed, user?.id);
                  }}
                  onEdit={() => openEditor(task)}
                />
              ))}
            </Card>
          ) : null}
        </>
      )}

      <GroceryItemEditorSheet
        visible={editorVisible}
        listId={list.id}
        task={editingTask}
        onClose={() => setEditorVisible(false)}
      />
    </AgentTestId>
  );
}

/**
 * Standalone (non-recipe) item: checkbox toggles, the copy opens the editor.
 * Two outcomes → two controls, mirroring the grocery screen's Other Items.
 */
function StandaloneItemRow({
  task,
  first,
  separatorColor,
  canComplete,
  canEdit,
  onToggle,
  onEdit,
}: {
  task: TodoTask;
  first: boolean;
  separatorColor: string;
  canComplete: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { spacing, layout } = useResponsive();
  const toggleAgent = useAgentUiTarget(AgentUiIds.food.plan.other(task.id), {
    label: task.title,
    onPress: canComplete ? onToggle : undefined,
  });
  const editAgent = useAgentUiTarget(AgentUiIds.food.plan.otherEdit(task.id), {
    label: `Edit ${task.title}`,
    onPress: canEdit ? onEdit : undefined,
  });

  return (
    <View
      style={[
        styles.itemRow,
        { minHeight: layout.minTapTarget, paddingHorizontal: spacing.md },
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: separatorColor,
        },
      ]}>
      <Pressable
        ref={toggleAgent.ref}
        testID={toggleAgent.testID}
        onLayout={toggleAgent.onLayout}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed, disabled: !canComplete }}
        disabled={!canComplete}
        onPress={onToggle}
        hitSlop={6}
        style={[styles.checkboxHit, { paddingVertical: spacing.sm }]}>
        <Checkbox
          completion={task.completed ? 'checked' : 'unchecked'}
          disabled={!canComplete}
        />
      </Pressable>
      <Pressable
        ref={editAgent.ref}
        testID={editAgent.testID}
        onLayout={editAgent.onLayout}
        accessibilityRole="button"
        accessibilityLabel={canEdit ? `Edit ${task.title}` : task.title}
        disabled={!canEdit}
        onPress={onEdit}
        style={({ pressed }) => [
          styles.itemCopy,
          {
            paddingVertical: spacing.sm,
            marginLeft: spacing.md,
            opacity: pressed ? 0.72 : 1,
          },
        ]}>
        <AppText
          variant="body"
          color={task.completed ? 'tertiary' : 'primary'}
          numberOfLines={1}
          style={[styles.shrink, task.completed && styles.struck]}>
          {task.title}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sharedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxHit: {
    justifyContent: 'center',
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  shrink: {
    flexShrink: 1,
    minWidth: 0,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
});
