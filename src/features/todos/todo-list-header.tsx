import { useRouter } from 'expo-router';
import type { RefObject } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  AppText,
  ErrorMessage,
  GlassPlate,
  HeaderBackButton,
  ProgressRing,
  Symbol,
} from '@/components/primitives';
import { fontFamilies, glassMaterials, radii, spacing, typography } from '@/design-system';
import { ChecklistCategoryTabs } from '@/features/todos/checklist-category-tabs';
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
  members,
  owner,
  canEdit,
  heroCopy,
  completedCount,
  progress,
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
  onDismissChrome,
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
  onManageSettings,
  onRemoveList,
}: {
  list: TodoList;
  tasks: TodoTask[];
  categories: TodoCategory[];
  selectedCategoryId: string;
  members: TodoMember[];
  owner: boolean;
  canEdit: boolean;
  heroCopy: string;
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
  onDismissChrome: () => void;
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
  onManageSettings: () => void;
  onRemoveList: () => void;
}) {
  const router = useRouter();
  const theme = useTheme();
  const { s } = useResponsive();
  const titleEditing = editMode && owner;
  const titleStyle = [
    styles.title,
    { fontSize: s(34), lineHeight: s(41), color: theme.textPrimary },
  ];

  return (
    <Pressable
      accessible={false}
      onPress={onDismissChrome}
      style={styles.listHeader}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <HeaderBackButton
            compact
            label="Checklists"
            accessibilityLabel="Back to checklists"
            testID={AgentUiIds.checklists.detail.back}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)/to-do' as never);
            }}
          />
          {titleEditing ? (
            <AgentTestId
              testID={AgentUiIds.checklists.detail.title}
              label="Edit checklist title"
              style={styles.titleEditor}>
              <TextInput
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
            <AppText style={titleStyle}>{list.name}</AppText>
          )}
        </View>
      </View>

      <GlassPlate
        style={[
          styles.hero,
          {
            borderColor:
              theme.name === 'dark'
                ? glassMaterials.border.dark
                : glassMaterials.border.light,
            boxShadow:
              theme.name === 'light'
                ? '0 10px 30px rgba(61, 50, 32, 0.09)'
                : '0 10px 30px rgba(0, 0, 0, 0.26)',
          },
        ]}>
        <View style={styles.heroCopy}>
          <AppText
            variant="overline"
            color="tertiary"
            style={[
              styles.heroOverline,
              { fontSize: s(10), lineHeight: s(12) },
            ]}>
            Momentum
          </AppText>
          <AppText
            variant="heading"
            style={{ fontSize: s(16), lineHeight: s(21) }}>
            {heroCopy}
          </AppText>
          <AppText
            variant="caption"
            color="secondary"
            style={{ fontSize: s(11), lineHeight: s(14) }}>
            {tasks.length === 0
              ? 'Capture the next thing. The rest can wait.'
              : `${completedCount} of ${tasks.length} complete`}
          </AppText>
        </View>
        <View style={{ zIndex: 1 }}>
          <ProgressRing
            progress={progress}
            size={48}
            strokeWidth={4}
            label={`${Math.round(progress * 100)}%`}
            sublabel="done"
            trackColor={
              theme.name === 'dark'
                ? glassMaterials.field.dark
                : glassMaterials.field.light
            }
          />
        </View>
      </GlassPlate>

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
              placeholder="What needs your attention?"
              placeholderTextColor={theme.textTertiary}
              returnKeyType="done"
              underlineColorAndroid="transparent"
              style={[styles.composerInput, { color: theme.textPrimary }]}
              value={draft}
            />
          </View>
          <Pressable
            ref={addTaskAgent.ref}
            accessibilityRole="button"
            accessibilityLabel="Add task"
            testID={addTaskAgent.testID}
            onLayout={addTaskAgent.onLayout}
            disabled={!draft.trim()}
            hitSlop={4}
            onPress={() => onAdd()}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: draft.trim()
                  ? theme.accentPrimary
                  : theme.separator,
                opacity: pressed ? 0.72 : 1,
              },
            ]}>
            <Symbol name="arrow-up" size={18} color={theme.textOnAccent} />
          </Pressable>
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

      <TodoListHeaderToolbar
        list={list}
        tasks={tasks}
        members={members}
        owner={owner}
        canEdit={canEdit}
        filter={filter}
        sort={sort}
        editMode={editMode}
        openTasksCount={openTasksCount}
        closedTasksCount={closedTasksCount}
        completedCount={completedCount}
        editModeAgent={editModeAgent}
        onFilterToggle={onFilterToggle}
        onToggleEditMode={onToggleEditMode}
        onSortChange={onSortChange}
        onClearDone={onClearDone}
        onManageSettings={onManageSettings}
        onRemoveList={onRemoveList}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
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
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headingCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  titleEditor: {
    minHeight: 44,
    justifyContent: 'center',
  },
  hero: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  heroCopy: { flex: 1, gap: spacing.xs, zIndex: 1 },
  heroOverline: {
    letterSpacing: 1.1,
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
