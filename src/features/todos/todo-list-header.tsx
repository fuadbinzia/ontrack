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
import { ChecklistPopoverMenu } from '@/features/todos/checklist-popover-menu';
import { copyTodoListText, shareTodoListText } from '@/features/todos/share';
import type { TodoFilter, TodoSort } from '@/features/todos/todo-sort';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { TodoList, TodoMember, TodoTask } from '@/store/todos';
import { haptics } from '@/utils/haptics';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

type AgentUiTargetApi = ReturnType<typeof useAgentUiTarget>;

export function TodoListHeader({
  list,
  tasks,
  members,
  owner,
  canEdit,
  dateLabel,
  heroCopy,
  completedCount,
  progress,
  draft,
  filter,
  sort,
  editMode,
  openTasksCount,
  syncError,
  inputRef,
  newTaskAgent,
  addTaskAgent,
  editModeAgent,
  onDismissChrome,
  onDraftChange,
  onAdd,
  onClearSyncError,
  onFilterToggle,
  onToggleEditMode,
  onSortChange,
  onClearDone,
}: {
  list: TodoList;
  tasks: TodoTask[];
  members: TodoMember[];
  owner: boolean;
  canEdit: boolean;
  dateLabel: string;
  heroCopy: string;
  completedCount: number;
  progress: number;
  draft: string;
  filter: TodoFilter;
  sort: TodoSort;
  editMode: boolean;
  openTasksCount: number;
  syncError?: string;
  inputRef: RefObject<TextInput | null>;
  newTaskAgent: AgentUiTargetApi;
  addTaskAgent: AgentUiTargetApi;
  editModeAgent: AgentUiTargetApi;
  onDismissChrome: () => void;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onClearSyncError: () => void;
  onFilterToggle: () => void;
  onToggleEditMode: () => void;
  onSortChange: (sort: TodoSort) => void;
  onClearDone: () => void;
}) {
  const router = useRouter();
  const theme = useTheme();
  const { s } = useResponsive();

  return (
              <Pressable
                accessible={false}
                onPress={onDismissChrome}
                style={styles.listHeader}
              >
                <View style={styles.heading}>
                  <View style={styles.headingCopy}>
                    <HeaderBackButton
                      compact
                      label={dateLabel}
                      accessibilityLabel="Back to checklists"
                      testID={AgentUiIds.checklists.detail.back}
                      onPress={() => {
                        if (router.canGoBack()) router.back();
                        else router.replace('/(tabs)/to-do' as never);
                      }}
                    />
                    <AppText
                      style={[
                        styles.title,
                        { fontSize: s(34), lineHeight: s(41) },
                      ]}>
                      {list.name}
                    </AppText>
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
                  ]}
                >
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

                {canEdit ? <GlassPlate
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
                  ]}
                >
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
                    ]}
                  >
                    <Symbol
                      name="arrow-up"
                      size={18}
                      color={theme.textOnAccent}
                    />
                  </Pressable>
                </GlassPlate> : (
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

                <View style={styles.controls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      filter === 'open'
                        ? `Showing ${openTasksCount} open tasks. Show closed tasks`
                        : `Showing ${completedCount} closed tasks. Show open tasks`
                    }
                    accessibilityHint="Toggles between open and closed tasks"
                    hitSlop={4}
                    onPress={onFilterToggle}
                    style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}>
                    <GlassPlate airy style={styles.taskStatus}>
                      <View
                        style={[
                          styles.taskStatusDot,
                          {
                            backgroundColor:
                              filter === 'open'
                                ? theme.accentPrimary
                                : theme.success,
                          },
                        ]}
                      />
                      <AppText
                        variant="overline"
                        color="secondary"
                        style={styles.taskStatusLabel}>
                        {filter === 'open' ? 'Open' : 'Closed'}
                      </AppText>
                      <View
                        style={[
                          styles.taskStatusDivider,
                          { backgroundColor: theme.separator },
                        ]}
                      />
                      <AppText
                        variant="subheading"
                        style={[
                          styles.taskStatusCount,
                          {
                            fontSize: s(17),
                            lineHeight: s(18),
                            color:
                              filter === 'open'
                                ? theme.accentPrimary
                                : theme.success,
                          },
                        ]}>
                        {filter === 'open' ? openTasksCount : completedCount}
                      </AppText>
                    </GlassPlate>
                  </Pressable>
                  <View style={styles.toolbarMenus}>
                    {canEdit && tasks.length > 0 ? (
                      <Pressable
                        ref={editModeAgent.ref}
                        accessibilityRole="button"
                        accessibilityLabel={
                          editMode ? 'Finish editing checklist' : 'Edit checklist'
                        }
                        testID={editModeAgent.testID}
                        onLayout={editModeAgent.onLayout}
                        onPress={onToggleEditMode}
                        style={({ pressed }) => [
                          { opacity: pressed ? 0.72 : 1 },
                        ]}>
                        <GlassPlate
                          inverted={editMode}
                          style={[
                            styles.editModeButton,
                            editMode
                              ? {
                                  borderColor: theme.accentPrimary,
                                  backgroundColor: `${theme.accentPrimary}B8`,
                                }
                              : null,
                          ]}>
                          <AppText
                            variant="caption"
                            color={editMode ? 'onAccent' : 'accent'}
                            style={editMode ? { color: '#FFFFFF' } : undefined}>
                            {editMode ? 'Done' : 'Edit'}
                          </AppText>
                        </GlassPlate>
                      </Pressable>
                    ) : null}
                    <ChecklistPopoverMenu
                      accessibilityLabel="Sort checklist"
                      title="Sort Items"
                      triggerIcon="sort"
                      testID={AgentUiIds.checklists.detail.sort}
                      items={[
                        {
                          id: 'manual',
                          title: 'Manual',
                          description: 'Your drag-and-drop order',
                          icon: 'list',
                          selected: sort === 'manual',
                        },
                        {
                          id: 'smart',
                          title: 'Smart',
                          description: 'Important first, then recent',
                          icon: 'smart',
                          selected: sort === 'smart',
                        },
                        {
                          id: 'newest',
                          title: 'Newest First',
                          description: 'Most recently added at the top',
                          icon: 'arrow-down',
                          selected: sort === 'newest',
                        },
                        {
                          id: 'oldest',
                          title: 'Oldest First',
                          description: 'Longest-standing items at the top',
                          icon: 'arrow-up',
                          selected: sort === 'oldest',
                        },
                        {
                          id: 'alphabetical',
                          title: 'A–Z',
                          description: 'Arrange items alphabetically',
                          icon: 'alphabetical',
                          selected: sort === 'alphabetical',
                        },
                      ]}
                      onSelect={(action) => {
                        if (
                          action === 'manual' ||
                          action === 'smart' ||
                          action === 'newest' ||
                          action === 'oldest' ||
                          action === 'alphabetical'
                        ) {
                          onSortChange(action);
                          haptics.select();
                        }
                      }}
                    />
                    <ChecklistPopoverMenu
                      accessibilityLabel={`${list.name} actions`}
                      title="List Actions"
                      triggerIcon="more"
                      testID={AgentUiIds.checklists.detail.actions}
                      items={[
                        {
                          id: 'copy',
                          title: 'Copy',
                          description: 'Copy a polished text checklist',
                          icon: 'copy',
                        },
                        {
                          id: 'share',
                          title: 'Share',
                          description: 'Send open items to another app',
                          icon: 'share',
                        },
                        {
                          id: 'manage',
                          title: owner ? 'Manage' : 'Members',
                          description: owner
                            ? 'Sharing, members, and list settings'
                            : 'View people with access',
                          icon: 'settings',
                        },
                        ...(canEdit && completedCount > 0
                          ? [
                              {
                                id: 'clear',
                                title: 'Clear Completed',
                                description: 'Remove every completed item',
                                icon: 'delete',
                                destructive: true,
                                dividerBefore: true,
                              } as const,
                            ]
                          : []),
                      ]}
                      onSelect={(action) => {
                        if (action === 'copy') {
                          void copyTodoListText(list, tasks, members).then((copied) => {
                            if (copied) haptics.success();
                          });
                        }
                        if (action === 'share') {
                          void shareTodoListText(list, tasks, members);
                        }
                        if (action === 'manage') {
                          router.push(`/todos/${list.id}/settings` as never);
                        }
                        if (action === 'clear') onClearDone();
                      }}
                    />
                  </View>
                </View>
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
  controls: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  editModeButton: {
    minWidth: 58,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    zIndex: 1,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headingCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
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
  taskStatus: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    zIndex: 1,
  },
  taskStatusCount: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  taskStatusDivider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
  },
  taskStatusDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
  },
  taskStatusLabel: {
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  title: {
    fontFamily: fontFamilies.serif,
    fontWeight: '400',
    letterSpacing: -0.65,
  },
  toolbarMenus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});

