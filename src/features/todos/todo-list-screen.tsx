import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import Animated, {
    FadeInDown,
    FadeOutLeft,
    LinearTransition,
} from 'react-native-reanimated';

import {
    AppText,
    Screen,
    Symbol,
} from '@/components/primitives';
import {
    layout,
    motion,
    spacing,
} from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import { TodoListHeader } from '@/features/todos/todo-list-header';
import { sortCategoriesForList } from '@/features/todos/checklist-category-helpers';
import { ALL_CATEGORIES } from '@/features/todos/checklist-category-tabs';
import { ChecklistCategorySheet } from '@/features/todos/checklist-category-sheet';
import {
  ChecklistTaskDetailsSheetHost,
  type ChecklistTaskDetailsSheetHandle,
} from '@/features/todos/checklist-task-details-sheet';
import { TodoEmptyState } from '@/features/todos/todo-empty-state';
import { ChecklistItemSeparator, TodoRow } from '@/features/todos/todo-row';
import { sortTodoTasks, type TodoFilter, type TodoSort } from '@/features/todos/todo-sort';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import {
    canCompleteTodo,
    canEditTodoContent,
    useTodos,
} from '@/store/todos';
import { useUI } from '@/store/ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { haptics } from '@/utils/haptics';
import { getDateTimeFormatter } from '@/utils/intl-cache';
import { listReferenceEquality } from '@/utils/list-equality';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function TodoListScreen({ listId }: { listId: string }) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshControl } = usePullToRefresh();
  const measuredTabBarHeight = useUI((state) => state.tabBarHeight);
  const tabBarHeight =
    measuredTabBarHeight ||
    layout.bottomNavBarBaseHeight + insets.bottom;
  const { user } = useAuthSession();
  const dateLocale = usePreferences((state) => state.dateLocale);
  const list = useTodos((state) => state.lists.find((item) => item.id === listId));
  const tasks = useTodos(
    (state) => state.tasks.filter((task) => task.listId === listId),
    listReferenceEquality,
  );
  const categories = useTodos(
    (state) => sortCategoriesForList(state.categories, listId),
    listReferenceEquality,
  );
  const members = useTodos(
    (state) => state.members.filter((member) => member.listId === listId),
    listReferenceEquality,
  );
  const addTask = useTodos((state) => state.addTask);
  const toggleTask = useTodos((state) => state.toggleTask);
  const toggleImportant = useTodos((state) => state.toggleImportant);
  const updateTask = useTodos((state) => state.updateTask);
  const deleteTask = useTodos((state) => state.deleteTask);
  const reorderTasks = useTodos((state) => state.reorderTasks);
  const clearCompleted = useTodos((state) => state.clearCompleted);
  const addCategory = useTodos((state) => state.addCategory);
  const deleteCategory = useTodos((state) => state.deleteCategory);
  const syncError = useTodos((state) => state.syncError);
  const clearSyncError = useTodos((state) => state.clearSyncError);
  const inputRef = useRef<TextInput>(null);
  const detailsSheetRef = useRef<ChecklistTaskDetailsSheetHandle>(null);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<TodoFilter>('open');
  const [sort, setSort] = useState<TodoSort>('smart');
  const [selectedCategoryId, setSelectedCategoryId] = useState(ALL_CATEGORIES);
  const [categoriesVisible, setCategoriesVisible] = useState(false);
  const [editingTaskIds, setEditingTaskIds] =
    useState<ReadonlySet<string> | null>(null);
  const [inlineEditingTaskId, setInlineEditingTaskId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (
      selectedCategoryId !== ALL_CATEGORIES &&
      !categories.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId(ALL_CATEGORIES);
    }
  }, [categories, selectedCategoryId]);

  const dismissChrome = () => {
    Keyboard.dismiss();
  };

  const openTasks = useMemo(
    () => sortTodoTasks(tasks.filter((task) => !task.completed), sort, 'open'),
    [sort, tasks],
  );
  const completedTasks = useMemo(
    () => sortTodoTasks(tasks.filter((task) => task.completed), sort, 'completed'),
    [sort, tasks],
  );
  const statusTasks = filter === 'open' ? openTasks : completedTasks;
  const categoryOpenTasks = selectedCategoryId === ALL_CATEGORIES
    ? openTasks
    : openTasks.filter((task) => task.categoryId === selectedCategoryId);
  const categoryCompletedTasks = selectedCategoryId === ALL_CATEGORIES
    ? completedTasks
    : completedTasks.filter((task) => task.categoryId === selectedCategoryId);
  const visibleTasks = selectedCategoryId === ALL_CATEGORIES
    ? statusTasks
    : statusTasks.filter((task) => task.categoryId === selectedCategoryId);
  const editMode =
    editingTaskIds !== null &&
    visibleTasks.some((task) => editingTaskIds.has(task.id));
  const completedCount = completedTasks.length;
  const progress = tasks.length === 0 ? 0 : completedCount / tasks.length;

  const dateLabel = useMemo(
    () =>
      getDateTimeFormatter(dateLocale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    [dateLocale],
  );

  const add = (title = draft) => {
    const task = addTask(
      listId,
      title,
      selectedCategoryId === ALL_CATEGORIES ? undefined : selectedCategoryId,
    );
    if (!task) return;
    setEditingTaskIds(null);
    setInlineEditingTaskId(null);
    setDraft('');
    setFilter('open');
    haptics.success();
  };

  const addTaskAgent = useAgentUiTarget(AgentUiIds.checklists.detail.addTask, {
    label: 'Add task',
    onPress: () => add(),
  });
  const newTaskAgent = useAgentUiTarget(AgentUiIds.checklists.detail.newTask, {
    label: 'New task',
    onPress: () => inputRef.current?.focus(),
  });
  const editModeAgent = useAgentUiTarget(AgentUiIds.checklists.detail.editMode, {
    label: editMode ? 'Finish editing checklist' : 'Edit checklist',
    onPress: () => {
      dismissChrome();
      setInlineEditingTaskId(null);
      if (editMode) {
        setEditingTaskIds(null);
      } else {
        setSort('manual');
        setEditingTaskIds(new Set(visibleTasks.map((task) => task.id)));
      }
      haptics.select();
    },
  });

  const clearDone = () => {
    confirmDestructiveAction({
      title: 'Clear Completed Tasks?',
      message: 'This removes every completed task from your list.',
      actionLabel: 'Clear',
      onConfirm: () => {
        clearCompleted(listId);
        haptics.warning();
      },
    });
  };

  const heroCopy =
    tasks.length === 0
      ? 'A clear page is a fresh start.'
      : openTasks.length === 0
        ? 'Everything is handled.'
        : completedCount === 0
          ? `${openTasks.length} ${openTasks.length === 1 ? 'task is' : 'tasks are'} ready for your attention.`
          : `${completedCount} down. Keep the rhythm going.`;

  if (!list) {
    return (
      <Screen contentStyle={styles.missingList}>
        <Symbol name="tasks" size={40} color={theme.textTertiary} />
        <AppText variant="heading">List Unavailable</AppText>
        <AppText variant="body" color="secondary" align="center">
          It may have been deleted, or you may no longer have access.
        </AppText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(tabs)/to-do' as never)}>
          <AppText variant="callout" color="accent">Back to Lists</AppText>
        </Pressable>
      </Screen>
    );
  }

  const owner = list.role === 'owner';
  const canEdit = canEditTodoContent(list);

  return (
    <Screen
      scroll={false}
      bottomInset={false}
      contentStyle={styles.screenContent}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <DraggableFlatList
            activationDistance={8}
            autoscrollSpeed={180}
            autoscrollThreshold={80}
            containerStyle={styles.list}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: tabBarHeight + spacing.lg },
              visibleTasks.length === 0 && styles.listEmptyContent,
            ]}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustKeyboardInsets
            data={visibleTasks}
            refreshControl={refreshControl}
            dragItemOverflow={false}
            keyboardDismissMode={
              Platform.OS === 'ios' ? 'interactive' : 'on-drag'
            }
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={dismissChrome}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => (
              <ChecklistItemSeparator onPress={dismissChrome} />
            )}
            ListFooterComponent={
              <Pressable
                accessible={!!inlineEditingTaskId}
                accessibilityRole={inlineEditingTaskId ? 'button' : undefined}
                accessibilityLabel={
                  inlineEditingTaskId ? 'Finish editing' : undefined
                }
                onPress={dismissChrome}
                style={styles.listDismissFooter}
              />
            }
            ListHeaderComponent={
              <TodoListHeader
                list={list}
                tasks={tasks}
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                members={members}
                owner={owner}
                canEdit={canEdit}
                dateLabel={dateLabel}
                heroCopy={heroCopy}
                completedCount={completedCount}
                progress={progress}
                draft={draft}
                filter={filter}
                sort={sort}
                editMode={editMode}
                openTasksCount={categoryOpenTasks.length}
                closedTasksCount={categoryCompletedTasks.length}
                syncError={syncError}
                inputRef={inputRef}
                newTaskAgent={newTaskAgent}
                addTaskAgent={addTaskAgent}
                editModeAgent={editModeAgent}
                onDismissChrome={dismissChrome}
                onDraftChange={setDraft}
                onAdd={() => add()}
                onClearSyncError={clearSyncError}
                onFilterToggle={() => {
                  dismissChrome();
                  setEditingTaskIds(null);
                  setInlineEditingTaskId(null);
                  setFilter(filter === 'open' ? 'completed' : 'open');
                  haptics.select();
                }}
                onToggleEditMode={() => {
                  dismissChrome();
                  setInlineEditingTaskId(null);
                  if (editMode) {
                    setEditingTaskIds(null);
                  } else {
                    setSort('manual');
                    setEditingTaskIds(new Set(visibleTasks.map((task) => task.id)));
                  }
                  haptics.select();
                }}
                onSortChange={setSort}
                onClearDone={clearDone}
                onCategorySelect={(categoryId) => {
                  dismissChrome();
                  setEditingTaskIds(null);
                  setSelectedCategoryId(categoryId);
                  haptics.select();
                }}
                onManageCategories={() => setCategoriesVisible(true)}
              />
            }
            ListEmptyComponent={
              <TodoEmptyState
                filter={filter}
                hasTasks={tasks.length > 0}
                onAddSuggestion={add}
                onFocusComposer={() => inputRef.current?.focus()}
                onShowCompleted={() => {
                  setEditingTaskIds(null);
                  setFilter('completed');
                }}
              />
            }
            onDragBegin={() => haptics.heavy()}
            onDragEnd={({ data, from, to }) => {
              if (!editMode || from < 0 || to < 0 || from === to) return;
              reorderTasks(list.id, data.map((task) => task.id));
              haptics.select();
            }}
            renderItem={({ item, drag, getIndex, isActive }) => (
              <Animated.View
                entering={FadeInDown.delay(Math.min(getIndex() ?? 0, 5) * 36).duration(
                  motion.layout,
                )}
                exiting={FadeOutLeft.duration(motion.fade)}
                layout={LinearTransition.duration(motion.layout)}
                style={isActive ? styles.activeTaskRow : undefined}
              >
                <TodoRow
                  task={item}
                  canComplete={canCompleteTodo(list, item, user?.id)}
                  editMode={editMode}
                  editing={inlineEditingTaskId === item.id}
                  isActive={isActive}
                  listOwner={canEdit}
                  members={members}
                  showCategory={categories.length > 0}
                  categoryName={categories.find((category) => category.id === item.categoryId)?.name}
                  testID={AgentUiIds.checklists.detail.task(item.id)}
                  onDragStart={drag}
                  onDelete={() => {
                    deleteTask(item.id);
                    haptics.warning();
                  }}
                  onToggle={() => {
                    toggleTask(item.id, user?.id);
                    if (item.completed) haptics.select();
                    else haptics.success();
                  }}
                  onToggleImportant={() => {
                    toggleImportant(item.id);
                    haptics.select();
                  }}
                  onOpenDetails={() => detailsSheetRef.current?.open(item.id)}
                  onStartEdit={() => {
                    setInlineEditingTaskId(item.id);
                  }}
                  onEndEdit={() =>
                    setInlineEditingTaskId((id) =>
                      id === item.id ? null : id,
                    )
                  }
                  onUpdate={(title) => updateTask(item.id, title)}
                />
              </Animated.View>
            )}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
          <ChecklistCategorySheet
            visible={categoriesVisible}
            categories={categories}
            onAdd={(name) => Boolean(addCategory(listId, name))}
            onDelete={(category) => {
              deleteCategory(category.id);
              if (selectedCategoryId === category.id) {
                setSelectedCategoryId(ALL_CATEGORIES);
              }
            }}
            onClose={() => setCategoriesVisible(false)}
          />
          <ChecklistTaskDetailsSheetHost ref={detailsSheetRef} listId={listId} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  activeTaskRow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  content: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    flex: 1,
    alignSelf: 'center',
  },
  flex: { flex: 1 },
  list: { flex: 1 },
  listContent: { flexGrow: 1 },
  listDismissFooter: { minHeight: spacing.xxl * 3, flexGrow: 1 },
  listEmptyContent: { flexGrow: 1 },
  missingList: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  screenContent: {
    paddingTop: Platform.select({ web: 76, default: spacing.sm }),
  },
});
