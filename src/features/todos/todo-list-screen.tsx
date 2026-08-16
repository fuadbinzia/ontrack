import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import Animated from 'react-native-reanimated';

import {
    AppText,
    Screen,
    Symbol,
    useListEnterIds,
    useSettledListLayout,
} from '@/components/primitives';
import {
    layout,
    listEntering,
    listExiting,
    spacing,
} from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import { TodoListHeader } from '@/features/todos/todo-list-header';
import {
  ALL_ASSIGNEES,
  ANYONE_ASSIGNEE,
  filterChecklistTasksByAssignee,
} from '@/features/todos/checklist-assignee-filter';
import {
  partitionChecklistCategories,
  sortCategoriesForList,
} from '@/features/todos/checklist-category-helpers';
import { ALL_CATEGORIES } from '@/features/todos/checklist-category-tabs';
import {
  ChecklistTaskDetailsSheetHost,
  type ChecklistTaskDetailsSheetHandle,
} from '@/features/todos/checklist-task-details-sheet';
import { createChecklistTaskAndOpenDetails } from '@/features/todos/checklist-task-creation';
import { TodoEmptyState } from '@/features/todos/todo-empty-state';
import { openTodoLists } from '@/features/todos/todo-list-href';
import { confirmRemoveTodoList } from '@/features/todos/todo-list-remove';
import { useVisibleTodoList } from '@/features/todos/todo-list-visible';
import { TodoListSettingsSheet } from '@/features/todos/todo-list-settings-screen';
import { ChecklistItemSeparator, TodoRow } from '@/features/todos/todo-row';
import { sortTodoTasks, type TodoFilter, type TodoSort } from '@/features/todos/todo-sort';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useTheme } from '@/hooks/use-theme';
import {
    canCompleteTodo,
    canEditTodoContent,
    useTodos,
} from '@/store/todos';
import { useTravel } from '@/store/travel';
import { useUI } from '@/store/ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { haptics } from '@/utils/haptics';
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
  const list = useVisibleTodoList(listId);
  const linkedTrip = useTravel((state) =>
    state.plans.find((plan) => plan.packingListId === listId),
  );
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
  const deleteCategory = useTodos((state) => state.deleteCategory);
  const reorderTasks = useTodos((state) => state.reorderTasks);
  const clearCompleted = useTodos((state) => state.clearCompleted);
  const renameList = useTodos((state) => state.renameList);
  const syncError = useTodos((state) => state.syncError);
  const clearSyncError = useTodos((state) => state.clearSyncError);
  const inputRef = useRef<TextInput>(null);
  const detailsSheetRef = useRef<ChecklistTaskDetailsSheetHandle>(null);
  const [draft, setDraft] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [filter, setFilter] = useState<TodoFilter>('open');
  const [sort, setSort] = useState<TodoSort>('smart');
  const [selectedCategoryId, setSelectedCategoryId] = useState(ALL_CATEGORIES);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(ALL_ASSIGNEES);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [editingTaskIds, setEditingTaskIds] =
    useState<ReadonlySet<string> | null>(null);
  const [inlineEditingTaskId, setInlineEditingTaskId] = useState<string | null>(
    null,
  );
  const categoryPartition = useMemo(
    () => partitionChecklistCategories(categories, tasks),
    [categories, tasks],
  );
  const populatedCategories = categoryPartition.populated;

  useEffect(() => {
    if (
      selectedCategoryId !== ALL_CATEGORIES &&
      !populatedCategories.some(
        (category) => category.id === selectedCategoryId,
      )
    ) {
      setSelectedCategoryId(ALL_CATEGORIES);
    }
  }, [populatedCategories, selectedCategoryId]);

  useEffect(() => {
    for (const categoryId of categoryPartition.emptyIds) {
      deleteCategory(categoryId);
    }
  }, [categoryPartition.emptyIds, deleteCategory]);

  useEffect(() => {
    if (
      selectedAssigneeId !== ALL_ASSIGNEES &&
      selectedAssigneeId !== ANYONE_ASSIGNEE &&
      !members.some((member) => member.userId === selectedAssigneeId)
    ) {
      setSelectedAssigneeId(ALL_ASSIGNEES);
    }
  }, [members, selectedAssigneeId]);

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
  const assigneeOpenTasks = filterChecklistTasksByAssignee(
    openTasks,
    selectedAssigneeId,
  );
  const assigneeCompletedTasks = filterChecklistTasksByAssignee(
    completedTasks,
    selectedAssigneeId,
  );
  const statusTasks = filter === 'open'
    ? assigneeOpenTasks
    : assigneeCompletedTasks;
  const categoryOpenTasks = selectedCategoryId === ALL_CATEGORIES
    ? assigneeOpenTasks
    : assigneeOpenTasks.filter(
        (task) => task.categoryId === selectedCategoryId,
      );
  const categoryCompletedTasks = selectedCategoryId === ALL_CATEGORIES
    ? assigneeCompletedTasks
    : assigneeCompletedTasks.filter(
        (task) => task.categoryId === selectedCategoryId,
      );
  const visibleTasks = selectedCategoryId === ALL_CATEGORIES
    ? statusTasks
    : statusTasks.filter((task) => task.categoryId === selectedCategoryId);
  const taskEnterIds = useListEnterIds(
    `todo:${listId}:${filter}:${selectedCategoryId}:${selectedAssigneeId}`,
    visibleTasks.map((task) => task.id),
  );
  // Null set = browsing; empty set still counts as edit mode (title-only / empty list).
  const editMode = editingTaskIds !== null;
  const completedCount = completedTasks.length;
  const progress = tasks.length === 0 ? 0 : completedCount / tasks.length;

  useEffect(() => {
    if (!editMode) setNameDraft(list?.name ?? '');
  }, [editMode, list?.name]);

  const commitListName = () => {
    if (!list || list.role !== 'owner') return false;
    const next = nameDraft.trim();
    if (!next || next === list.name) {
      setNameDraft(list.name);
      return false;
    }
    renameList(list.id, next);
    setNameDraft(next);
    return true;
  };

  const exitEditMode = () => {
    const renamed = commitListName();
    setEditingTaskIds(null);
    setInlineEditingTaskId(null);
    if (renamed) haptics.success();
    else haptics.select();
  };

  const enterEditMode = () => {
    setSort('manual');
    setSelectedAssigneeId(ALL_ASSIGNEES);
    setNameDraft(list?.name ?? '');
    setInlineEditingTaskId(null);
    setEditingTaskIds(new Set(visibleTasks.map((task) => task.id)));
    haptics.select();
  };

  const toggleEditMode = () => {
    dismissChrome();
    if (editMode) exitEditMode();
    else enterEditMode();
  };

  const add = (title = draft) => {
    const task = createChecklistTaskAndOpenDetails({
      addTask,
      categoryId:
        selectedCategoryId === ALL_CATEGORIES ? undefined : selectedCategoryId,
      listId,
      openDetails: (taskId) => detailsSheetRef.current?.open(taskId),
      title,
    });
    if (!task) return;
    if (editMode) commitListName();
    setEditingTaskIds(null);
    setInlineEditingTaskId(null);
    setDraft('');
    setFilter('open');
    setSelectedAssigneeId(ALL_ASSIGNEES);
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
    onPress: toggleEditMode,
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

  const removeList = () => {
    if (!list) return;
    confirmRemoveTodoList(list, {
      afterRemoved: () => openTodoLists(),
    });
  };

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
          onPress={openTodoLists}>
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
                categories={populatedCategories}
                selectedCategoryId={selectedCategoryId}
                selectedAssigneeId={selectedAssigneeId}
                members={members}
                owner={owner}
                canEdit={canEdit}
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
                onDraftChange={setDraft}
                onAdd={() => add()}
                onClearSyncError={clearSyncError}
                nameDraft={nameDraft}
                onNameChange={setNameDraft}
                onNameSubmit={() => {
                  if (commitListName()) haptics.success();
                  Keyboard.dismiss();
                }}
                onFilterToggle={() => {
                  dismissChrome();
                  if (editMode) {
                    commitListName();
                    setEditingTaskIds(null);
                    setInlineEditingTaskId(null);
                  }
                  setFilter(filter === 'open' ? 'completed' : 'open');
                  haptics.select();
                }}
                onToggleEditMode={toggleEditMode}
                onSortChange={setSort}
                onClearDone={clearDone}
                onCategorySelect={(categoryId) => {
                  dismissChrome();
                  if (editMode) {
                    commitListName();
                    setEditingTaskIds(null);
                    setInlineEditingTaskId(null);
                  }
                  setSelectedCategoryId(categoryId);
                  haptics.select();
                }}
                onAssigneeSelect={(assigneeId) => {
                  dismissChrome();
                  if (editMode) {
                    commitListName();
                    setEditingTaskIds(null);
                    setInlineEditingTaskId(null);
                  }
                  setSelectedAssigneeId(assigneeId);
                }}
                onManageSettings={() => setSettingsVisible(true)}
                onRemoveList={removeList}
                linkedTripTitle={linkedTrip?.title}
                onOpenLinkedTrip={linkedTrip
                  ? () => {
                      router.push({
                        pathname: '/(tabs)/travel/[id]',
                        params: { id: linkedTrip.id },
                      } as never);
                    }
                  : undefined}
              />
            }
            ListEmptyComponent={
              <TodoEmptyState
                filter={filter}
                hasTasks={tasks.length > 0}
                assigneeFilterLabel={
                  selectedAssigneeId === ALL_ASSIGNEES
                    ? undefined
                    : selectedAssigneeId === ANYONE_ASSIGNEE
                      ? 'Anyone'
                      : members.find(
                          (member) => member.userId === selectedAssigneeId,
                        )?.displayName
                }
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
              <TodoTaskMotion
                enter={taskEnterIds.has(item.id)}
                index={getIndex() ?? 0}
                isActive={isActive}
              >
                <TodoRow
                  task={item}
                  canComplete={canCompleteTodo(list, item, user?.id)}
                  editMode={editMode}
                  editing={inlineEditingTaskId === item.id}
                  isActive={isActive}
                  listOwner={canEdit}
                  members={members}
                  showCategory={populatedCategories.length > 0}
                  categoryName={populatedCategories.find(
                    (category) => category.id === item.categoryId,
                  )?.name}
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
              </TodoTaskMotion>
            )}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
          <TodoListSettingsSheet
            listId={listId}
            visible={settingsVisible}
            onClose={() => setSettingsVisible(false)}
          />
          <ChecklistTaskDetailsSheetHost ref={detailsSheetRef} listId={listId} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function TodoTaskMotion({
  enter,
  index,
  isActive,
  children,
}: {
  enter: boolean;
  index: number;
  isActive: boolean;
  children: ReactNode;
}) {
  const { layout, onLayout } = useSettledListLayout();
  return (
    <Animated.View
      entering={enter ? listEntering(index) : undefined}
      exiting={listExiting()}
      layout={layout}
      onLayout={onLayout}
      style={isActive ? styles.activeTaskRow : undefined}
    >
      {children}
    </Animated.View>
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
