import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';

import { groceryListScreenStyles as styles } from './grocery-list-screen-styles';
import { GroceryListHeader } from './grocery-list-header';

import {
    AppText,
    Button,
    Card,
    ErrorMessage,
    GestureScrollView,
    GlassPlate,
    HeaderBackButton,
    IconButton,
    ProgressRing,
    Screen,
    Symbol,
} from '@/components/primitives';
import { fontFamilies, glassMaterials, layout, radii, spacing } from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import {
    buildCombinedIngredients,
    type CombinedCompletion,
    type CombinedIngredient,
} from '@/features/todos/grocery-utils';
import {
    CombinedRow,
    MealCard,
    OtherItems,
} from '@/features/todos/grocery-rows';
import { copyChecklistText, shareChecklistText } from '@/features/todos/share';
import { openChecklists } from '@/features/todos/todo-list-href';
import { ChecklistSettingsSheet } from '@/features/todos/todo-list-settings-screen';
import { useVisibleChecklist } from '@/features/todos/todo-list-visible';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { deletePersistedRecipeImage } from '@/services/recipes';
import {
    canCompleteChecklistTask,
    canEditChecklistContent,
    useChecklists,
    type ChecklistRecipe,
    type ChecklistTask,
} from '@/store/todos';
import { useUI } from '@/store/ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { listReferenceEquality } from '@/utils/list-equality';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type GroceryView = 'meal' | 'combined';

type GroceryListRow =
  | { type: 'meal'; key: string; recipe: ChecklistRecipe; tasks: ChecklistTask[] }
  | { type: 'empty-recipes'; key: 'empty-recipes' }
  | { type: 'combined-heading'; key: 'combined-heading' }
  | { type: 'combined-card'; key: 'combined-card'; groups: CombinedIngredient[] }
  | { type: 'empty-combined'; key: 'empty-combined' }
  | { type: 'other-items'; key: 'other-items' }
  | { type: 'clear'; key: 'clear' };

export function GroceryListScreen({ listId }: { listId: string }) {
  const router = useRouter();
  const theme = useTheme();
  const { s } = useResponsive();
  const dark = theme.name === 'dark';
  const plateBorder = dark
    ? glassMaterials.border.dark
    : glassMaterials.border.light;
  const insets = useSafeAreaInsets();
  const { refreshControl } = usePullToRefresh();
  const measuredTabBarHeight = useUI((state) => state.tabBarHeight);
  const tabBarHeight =
    measuredTabBarHeight ||
    layout.bottomNavBarBaseHeight + insets.bottom;
  const { user } = useAuthSession();
  const list = useVisibleChecklist(listId);
  const tasks = useChecklists(
    (state) => state.tasks.filter((task) => task.listId === listId),
    listReferenceEquality,
  );
  const recipes = useChecklists(
    (state) =>
      state.recipes
        .filter((recipe) => recipe.listId === listId)
        .sort(
          (a, b) =>
            (a.position ?? Number.MAX_SAFE_INTEGER) -
              (b.position ?? Number.MAX_SAFE_INTEGER) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    listReferenceEquality,
  );
  const members = useChecklists(
    (state) => state.members.filter((member) => member.listId === listId),
    listReferenceEquality,
  );
  const addTask = useChecklists((state) => state.addTask);
  const setTasksCompletion = useChecklists((state) => state.setTasksCompletion);
  const deleteTask = useChecklists((state) => state.deleteTask);
  const deleteRecipe = useChecklists((state) => state.deleteRecipe);
  const clearCompleted = useChecklists((state) => state.clearCompleted);
  const syncError = useChecklists((state) => state.syncError);
  const clearSyncError = useChecklists((state) => state.clearSyncError);
  const [view, setView] = useState<GroceryView>('meal');
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [draft, setDraft] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const settingsAgent = useAgentUiTarget(AgentUiIds.grocery.settings, {
    label: 'Grocery list settings',
    onPress: () => setSettingsVisible(true),
  });
  const shareAgent = useAgentUiTarget(AgentUiIds.grocery.share, {
    label: 'Share grocery list',
  });
  const copyAgent = useAgentUiTarget(AgentUiIds.grocery.copy, {
    label: 'Copy grocery list',
  });
  const mealViewAgent = useAgentUiTarget(AgentUiIds.grocery.view('meal'), {
    label: 'By meal',
    onPress: () => {
      setView('meal');
      haptics.select();
    },
  });
  const combinedViewAgent = useAgentUiTarget(
    AgentUiIds.grocery.view('combined'),
    {
      label: 'Combined',
      onPress: () => {
        setView('combined');
        haptics.select();
      },
    },
  );

  const standalone = useMemo(
    () =>
      tasks
        .filter((task) => !task.recipeId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [tasks],
  );
  const ingredients = useMemo(
    () => tasks.filter((task) => task.recipeId),
    [tasks],
  );
  const combined = useMemo(
    () => buildCombinedIngredients(ingredients),
    [ingredients],
  );

  const owner = list?.role === 'owner';
  const canEdit = list ? canEditChecklistContent(list) : false;
  const completedCount = tasks.filter((task) => task.completed).length;
  const progress = tasks.length ? completedCount / tasks.length : 0;

  const addOther = useCallback(() => {
    if (!addTask(listId, draft)) return;
    setDraft('');
    haptics.success();
  }, [addTask, draft, listId]);

  const toggleIds = useCallback(
    (ids: string[], completion: CombinedCompletion) => {
      setTasksCompletion(ids, completion === 'checked' ? false : true, user?.id);
      haptics.select();
    },
    [setTasksCompletion, user?.id],
  );

  const mealRows = useMemo(() => {
    const rows: GroceryListRow[] = recipes.map((recipe) => ({
      type: 'meal',
      key: recipe.id,
      recipe,
      tasks: ingredients
        .filter((task) => task.recipeId === recipe.id)
        .sort(
          (a, b) =>
            (a.ingredientPosition ?? Number.MAX_SAFE_INTEGER) -
            (b.ingredientPosition ?? Number.MAX_SAFE_INTEGER),
        ),
    }));
    if (recipes.length === 0) {
      rows.push({ type: 'empty-recipes', key: 'empty-recipes' });
    }
    rows.push({ type: 'other-items', key: 'other-items' });
    if (canEdit && completedCount > 0) {
      rows.push({ type: 'clear', key: 'clear' });
    }
    return rows;
  }, [canEdit, completedCount, ingredients, recipes]);

  const combinedRows = useMemo(() => {
    const rows: GroceryListRow[] = [{ type: 'combined-heading', key: 'combined-heading' }];
    if (combined.length) {
      rows.push({ type: 'combined-card', key: 'combined-card', groups: combined });
    } else {
      rows.push({ type: 'empty-combined', key: 'empty-combined' });
    }
    rows.push({ type: 'other-items', key: 'other-items' });
    if (canEdit && completedCount > 0) {
      rows.push({ type: 'clear', key: 'clear' });
    }
    return rows;
  }, [canEdit, combined, completedCount]);

  const listData = view === 'meal' ? mealRows : combinedRows;

  const renderItem = useCallback(
    ({ item }: { item: GroceryListRow }) => {
      if (!list) return null;

      switch (item.type) {
        case 'meal':
          return (
            <View style={styles.row}>
              <MealCard
                collapsed={collapsedIds.has(item.recipe.id)}
                listOwner={owner}
                recipe={item.recipe}
                tasks={item.tasks}
                onDelete={() =>
                  confirmDestructiveAction({
                    title: `Delete “${item.recipe.name}”?`,
                    message:
                      'The meal and all of its ingredient items will be removed.',
                    onConfirm: () => {
                      deletePersistedRecipeImage(item.recipe.sourceImageUri);
                      deleteRecipe(item.recipe.id);
                    },
                  })
                }
                onToggleCollapsed={() =>
                  setCollapsedIds((current) => {
                    const next = new Set(current);
                    if (next.has(item.recipe.id)) next.delete(item.recipe.id);
                    else next.add(item.recipe.id);
                    return next;
                  })
                }
                onToggleTask={(task) =>
                  setTasksCompletion([task.id], !task.completed, user?.id)
                }
                canComplete={(task) => canCompleteChecklistTask(list, task, user?.id)}
              />
            </View>
          );
        case 'empty-recipes':
          return (
            <View style={styles.row}>
              <Card variant="sunken" style={styles.emptyRecipe}>
                <Symbol name="groceries" size={30} color={theme.accentPrimary} />
                <AppText variant="heading">Bring a Meal into Your List</AppText>
                <AppText variant="body" color="secondary" align="center">
                  Import a recipe link, camera photo, or screenshot. You’ll review
                  every ingredient before it is saved.
                </AppText>
              </Card>
            </View>
          );
        case 'combined-heading':
          return (
            <View style={[styles.row, styles.sectionHeading]}>
              <View>
                <AppText variant="overline" color="accent">
                  Shopping view
                </AppText>
                <AppText variant="heading">Combined Ingredients</AppText>
              </View>
              <Pressable
                ref={copyAgent.ref}
                testID={copyAgent.testID}
                onLayout={copyAgent.onLayout}
                accessibilityRole="button"
                accessibilityLabel="Copy grocery list"
                onPress={() => void copyChecklistText(list, tasks, members, recipes)}>
                <AppText variant="caption" color="accent">
                  Copy
                </AppText>
              </Pressable>
            </View>
          );
        case 'combined-card':
          return (
            <View style={styles.row}>
              <Card padded={false}>
                {item.groups.map((group, index) => (
                  <CombinedRow
                    key={group.id}
                    testID={AgentUiIds.grocery.combinedItem(group.id)}
                    completion={group.completion}
                    disabled={!group.taskIds.some((id) => {
                      const task = tasks.find((entry) => entry.id === id);
                      return task
                        ? canCompleteChecklistTask(list, task, user?.id)
                        : false;
                    })}
                    first={index === 0}
                    name={group.name}
                    amounts={group.amountFragments}
                    occurrences={group.totalCount}
                    onToggle={() => toggleIds(group.taskIds, group.completion)}
                  />
                ))}
              </Card>
            </View>
          );
        case 'empty-combined':
          return (
            <View style={styles.row}>
              <Card padded={false}>
                <View style={styles.emptyCombined}>
                  <AppText variant="body" color="secondary" align="center">
                    Recipe ingredients will be grouped here.
                  </AppText>
                </View>
              </Card>
            </View>
          );
        case 'other-items':
          return (
            <View style={styles.row}>
              <OtherItems
                tasks={standalone}
                owner={canEdit}
                draft={draft}
                onDraftChange={setDraft}
                onAdd={addOther}
                onDelete={deleteTask}
                onToggle={(task) =>
                  setTasksCompletion([task.id], !task.completed, user?.id)
                }
                canComplete={(task) => canCompleteChecklistTask(list, task, user?.id)}
              />
            </View>
          );
        case 'clear':
          return (
            <View style={styles.row}>
              <Button
                variant="ghost"
                onPress={() => {
                  const clear = () => {
                    for (const recipe of recipes) {
                      const recipeTasks = ingredients.filter(
                        (task) => task.recipeId === recipe.id,
                      );
                      if (
                        recipeTasks.length > 0 &&
                        recipeTasks.every((task) => task.completed)
                      ) {
                        deletePersistedRecipeImage(recipe.sourceImageUri);
                      }
                    }
                    clearCompleted(listId);
                  };
                  confirmDestructiveAction({
                    title: 'Clear Checked Items?',
                    message: `This removes ${completedCount} underlying ${completedCount === 1 ? 'item' : 'items'}.`,
                    actionLabel: 'Clear',
                    onConfirm: clear,
                  });
                }}>
                Clear {completedCount} checked
              </Button>
            </View>
          );
        default:
          return null;
      }
    },
    [
      addOther,
      collapsedIds,
      completedCount,
      copyAgent,
      deleteRecipe,
      deleteTask,
      draft,
      ingredients,
      canEdit,
      list,
      listId,
      members,
      owner,
      recipes,
      setTasksCompletion,
      standalone,
      tasks,
      theme.accentPrimary,
      toggleIds,
      user?.id,
    ],
  );

  if (!list) {
    return (
      <Screen contentStyle={styles.center}>
        <Symbol name="groceries" size={42} color={theme.textTertiary} />
        <AppText variant="heading">Grocery List Unavailable</AppText>
        <Button onPress={openChecklists}>
          Back to Lists
        </Button>
      </Screen>
    );
  }

  return (
    <Screen
      scroll={false}
      bottomInset={false}
      contentStyle={styles.screenContent}>
      <FlashList
        data={listData}
        keyExtractor={(item) => item.key}
        renderScrollComponent={GestureScrollView}
        refreshControl={refreshControl}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        extraData={[collapsedIds, draft, view]}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + spacing.lg },
        ]}
        ListHeaderComponent={
          <GroceryListHeader
            list={list}
            listId={listId}
            tasks={tasks}
            members={members}
            recipes={recipes}
            completedCount={completedCount}
            progress={progress}
            owner={owner}
            canEdit={canEdit}
            view={view}
            setView={setView}
            plateBorder={plateBorder}
            syncError={syncError}
            clearSyncError={clearSyncError}
            theme={theme}
            s={s}
            router={router}
            settingsAgent={settingsAgent}
            shareAgent={shareAgent}
            mealViewAgent={mealViewAgent}
            combinedViewAgent={combinedViewAgent}
            onOpenSettings={() => setSettingsVisible(true)}
          />
        }
        renderItem={renderItem}
      />
      <ChecklistSettingsSheet
        listId={listId}
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </Screen>
  );
}
