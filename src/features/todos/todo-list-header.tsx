import { useRef, type RefObject } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  AppText,
  ErrorMessage,
  GlassPlate,
  HeaderBackButton,
  IconButton,
  Symbol,
} from '@/components/primitives';
import { fontFamilies, glassMaterials, radii, spacing, typography } from '@/design-system';
import { ChecklistCategoryTabs } from '@/features/todos/checklist-category-tabs';
import { TodoLinkedTripAction } from '@/features/todos/todo-linked-trip-action';
import { openTodoLists } from '@/features/todos/todo-list-href';
import { TodoListHeaderToolbar } from '@/features/todos/todo-list-header-toolbar';
import type { TodoFilter, TodoSort } from '@/features/todos/todo-sort';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { TodoCategory, TodoList, TodoMember, TodoTask } from '@/store/todos';
import { AgentTestId, AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

type AgentUiTargetApi = ReturnType<typeof useAgentUiTarget>;

export function TodoListHeader({
  list,
  tasks,
  categories,
  selectedCategoryId,
  selectedAssigneeId,
  members,
  owner,
  canEdit,
  completedCount,
  progress: _progress,
  draft,
  filter,
  sort,
  editMode,
  nameDraft,
  openTasksCount,
  closedTasksCount,
  syncError,
  inputRef,
  newTaskAgent,
  addTaskAgent,
  editModeAgent,
  onDraftChange,
  onNameChange,
  onNameSubmit,
  onAdd,
  onClearSyncError,
  onFilterToggle,
  onToggleEditMode,
  onSortChange,
  onClearDone,
  onCategorySelect,
  onAssigneeSelect,
  onManageSettings,
  onRemoveList,
  linkedTripTitle,
  onOpenLinkedTrip,
}: {
  list: TodoList;
  tasks: TodoTask[];
  categories: TodoCategory[];
  selectedCategoryId: string;
  selectedAssigneeId: string;
  members: TodoMember[];
  owner: boolean;
  canEdit: boolean;
  completedCount: number;
  progress: number;
  draft: string;
  filter: TodoFilter;
  sort: TodoSort;
  editMode: boolean;
  nameDraft: string;
  openTasksCount: number;
  closedTasksCount: number;
  syncError?: string;
  inputRef: RefObject<TextInput | null>;
  newTaskAgent: AgentUiTargetApi;
  addTaskAgent: AgentUiTargetApi;
  editModeAgent: AgentUiTargetApi;
  onDraftChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onNameSubmit: () => void;
  onAdd: () => void;
  onClearSyncError: () => void;
  onFilterToggle: () => void;
  onToggleEditMode: () => void;
  onSortChange: (sort: TodoSort) => void;
  onClearDone: () => void;
  onCategorySelect: (id: string) => void;
  onAssigneeSelect: (id: string) => void;
  onManageSettings: () => void;
  onRemoveList: () => void;
  linkedTripTitle?: string;
  onOpenLinkedTrip?: () => void;
}) {
  const theme = useTheme();
  const { s } = useResponsive();
  const showingOpen = filter === 'open';
  const filterLabel = showingOpen
    ? `${openTasksCount} Open`
    : `${closedTasksCount} Closed`;
  const titleInputRef = useRef<TextInput>(null);
  const titleEditing = editMode && owner;
  const titleStyle = [
    styles.title,
    { fontSize: s(34), lineHeight: s(41), color: theme.textPrimary },
  ];
  const focusTitle = () => titleInputRef.current?.focus();
  const filterAgent = useAgentUiTarget(AgentUiIds.checklists.detail.filter, {
    label: showingOpen
      ? `Showing ${openTasksCount} open tasks. Show closed tasks`
      : `Showing ${closedTasksCount} closed tasks. Show open tasks`,
    onPress: onFilterToggle,
  });

  return (
    <View style={styles.listHeader}>
      <View style={styles.heading}>
        <View style={styles.navRow}>
          <HeaderBackButton
            compact
            label="Checklists"
            accessibilityLabel="Back to checklists"
            testID={AgentUiIds.checklists.detail.back}
            onPress={openTodoLists}
          />
          <View style={styles.titleActions}>
            <Pressable
              ref={filterAgent.ref}
              onLayout={filterAgent.onLayout}
              accessibilityRole="button"
              accessibilityLabel={
                showingOpen
                  ? `Showing ${openTasksCount} open tasks. Show closed tasks`
                  : `Showing ${closedTasksCount} closed tasks. Show open tasks`
              }
              accessibilityHint="Toggles between open and closed tasks"
              testID={filterAgent.testID}
              hitSlop={4}
              onPress={onFilterToggle}
              style={({ pressed }) => [{ opacity: pressed ? 0.86 : 1 }]}>
              <GlassPlate
                style={[
                  styles.filterChip,
                  {
                    minHeight: 36,
                    paddingHorizontal: spacing.md,
                    borderColor: theme.accentPrimary,
                  },
                ]}>
                <AppText variant="callout" color="accent" fit numberOfLines={1}>
                  {filterLabel}
                </AppText>
              </GlassPlate>
            </Pressable>
            <TodoListHeaderToolbar
              list={list}
              tasks={tasks}
              members={members}
              owner={owner}
              canEdit={canEdit}
              filter={filter}
              selectedAssigneeId={selectedAssigneeId}
              sort={sort}
              editMode={editMode}
              openTasksCount={openTasksCount}
              closedTasksCount={closedTasksCount}
              completedCount={completedCount}
              editModeAgent={editModeAgent}
              onFilterToggle={onFilterToggle}
              onAssigneeSelect={onAssigneeSelect}
              onToggleEditMode={onToggleEditMode}
              onSortChange={onSortChange}
              onClearDone={onClearDone}
              onManageSettings={onManageSettings}
              onRemoveList={onRemoveList}
            />
          </View>
        </View>
        <View style={styles.headingCopy}>
          {titleEditing ? (
            <AgentTestId
              testID={AgentUiIds.checklists.detail.title}
              label="Edit checklist title"
              onPress={focusTitle}
              style={styles.titleEditor}>
              <TextInput
                ref={titleInputRef}
                accessibilityLabel="Checklist title"
                maxLength={80}
                onChangeText={onNameChange}
                onSubmitEditing={onNameSubmit}
                placeholder="Checklist name"
                placeholderTextColor={theme.textTertiary}
                returnKeyType="done"
                selectTextOnFocus
                selectionColor={theme.accentPrimary}
                underlineColorAndroid="transparent"
                style={titleStyle}
                value={nameDraft}
              />
            </AgentTestId>
          ) : (
            <AgentTestId
              testID={AgentUiIds.checklists.detail.title}
              label={list.name}
            >
              <AppText style={titleStyle} numberOfLines={1}>
                {list.name}
              </AppText>
            </AgentTestId>
          )}
        </View>
      </View>

      {linkedTripTitle && onOpenLinkedTrip ? (
        <TodoLinkedTripAction
          tripTitle={linkedTripTitle}
          onPress={onOpenLinkedTrip}
        />
      ) : null}

      {canEdit ? (
        <GlassPlate
          style={[
            styles.composer,
            {
              borderColor: draft.trim()
                ? theme.accentPrimary
                : theme.name === 'dark'
                  ? glassMaterials.border.dark
                  : glassMaterials.border.light,
              borderWidth: draft.trim() ? 1 : StyleSheet.hairlineWidth,
            },
          ]}>
          <Symbol name="add" size={21} color={theme.accentPrimary} />
          <View
            ref={newTaskAgent.ref}
            testID={newTaskAgent.testID}
            onLayout={newTaskAgent.onLayout}
            collapsable={false}
            style={styles.composerInputWrap}>
            <TextInput
              ref={inputRef}
              accessibilityLabel="New task"
              blurOnSubmit={false}
              maxLength={160}
              onChangeText={onDraftChange}
              onSubmitEditing={() => onAdd()}
              placeholder="Add an item"
              placeholderTextColor={theme.textTertiary}
              returnKeyType="done"
              underlineColorAndroid="transparent"
              style={[styles.composerInput, { color: theme.textPrimary }]}
              value={draft}
            />
          </View>
          <IconButton
            testID={addTaskAgent.testID}
            accessibilityLabel="Add task"
            icon="arrow-up"
            iconSize={18}
            appearance={draft.trim() ? 'solid' : 'glass'}
            color={
              draft.trim() ? theme.textOnAccent : theme.textSecondary
            }
            background={draft.trim() ? theme.accentPrimary : undefined}
            disabled={!draft.trim()}
            onPress={() => onAdd()}
          />
        </GlassPlate>
      ) : (
        <GlassPlate airy style={styles.memberNotice}>
          <AppText variant="caption" color="secondary">
            You can complete items assigned to you or Anyone.
          </AppText>
        </GlassPlate>
      )}

      {syncError ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss list sync message"
          onPress={onClearSyncError}>
          <ErrorMessage message={syncError} />
        </Pressable>
      ) : null}

      {categories.length ? (
        <ChecklistCategoryTabs
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={onCategorySelect}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    zIndex: 1,
  },
  composerInput: {
    ...typography.body,
    flex: 1,
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  composerInputWrap: {
    flex: 1,
    minWidth: 0,
  },
  heading: { gap: spacing.xs },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headingCopy: { minWidth: 0 },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 4,
  },
  filterChip: {
    justifyContent: 'center',
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 140,
    borderRadius: radii.pill,
    borderCurve: 'continuous',
  },
  titleEditor: {
    minHeight: 44,
    justifyContent: 'center',
  },
  listHeader: { gap: spacing.md, paddingBottom: spacing.md },
  memberNotice: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  title: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
    letterSpacing: -0.65,
  },
});
