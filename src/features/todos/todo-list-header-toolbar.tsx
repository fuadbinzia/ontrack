import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassPlate } from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import { ChecklistPopoverMenu } from '@/features/todos/checklist-popover-menu';
import { copyTodoListText } from '@/features/todos/share';
import type { TodoFilter, TodoSort } from '@/features/todos/todo-sort';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import type { TodoList, TodoMember, TodoTask } from '@/store/todos';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

type AgentUiTargetApi = ReturnType<typeof useAgentUiTarget>;

const SORT_OPTIONS: {
  id: TodoSort;
  title: string;
  description: string;
  icon: 'list' | 'smart' | 'arrow-down' | 'arrow-up' | 'alphabetical';
}[] = [
  {
    id: 'manual',
    title: 'Manual',
    description: 'Your drag-and-drop order',
    icon: 'list',
  },
  {
    id: 'smart',
    title: 'Smart',
    description: 'Important first, then recent',
    icon: 'smart',
  },
  {
    id: 'newest',
    title: 'Newest First',
    description: 'Most recently added at the top',
    icon: 'arrow-down',
  },
  {
    id: 'oldest',
    title: 'Oldest First',
    description: 'Longest-standing items at the top',
    icon: 'arrow-up',
  },
  {
    id: 'alphabetical',
    title: 'A–Z',
    description: 'Arrange items alphabetically',
    icon: 'alphabetical',
  },
];

export function TodoListHeaderToolbar({
  list,
  tasks,
  members,
  owner,
  canEdit,
  filter,
  sort,
  editMode,
  openTasksCount,
  closedTasksCount,
  completedCount,
  editModeAgent,
  onFilterToggle,
  onToggleEditMode,
  onSortChange,
  onClearDone,
  onManageSettings,
  onRemoveList,
}: {
  list: TodoList;
  tasks: TodoTask[];
  members: TodoMember[];
  owner: boolean;
  canEdit: boolean;
  filter: TodoFilter;
  sort: TodoSort;
  editMode: boolean;
  openTasksCount: number;
  closedTasksCount: number;
  completedCount: number;
  editModeAgent: AgentUiTargetApi;
  onFilterToggle: () => void;
  onToggleEditMode: () => void;
  onSortChange: (sort: TodoSort) => void;
  onClearDone: () => void;
  onManageSettings: () => void;
  onRemoveList: () => void;
}) {
  const theme = useTheme();
  const { s } = useResponsive();

  return (
    <View style={styles.controls}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          filter === 'open'
            ? `Showing ${openTasksCount} open tasks. Show closed tasks`
            : `Showing ${closedTasksCount} closed tasks. Show open tasks`
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
                  filter === 'open' ? theme.accentPrimary : theme.success,
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
                color: filter === 'open' ? theme.accentPrimary : theme.success,
              },
            ]}>
            {filter === 'open' ? openTasksCount : closedTasksCount}
          </AppText>
        </GlassPlate>
      </Pressable>
      <View style={styles.toolbarMenus}>
        {owner || (canEdit && tasks.length > 0) ? (
          <Pressable
            ref={editModeAgent.ref}
            accessibilityRole="button"
            accessibilityLabel={
              editMode ? 'Finish editing checklist' : 'Edit checklist'
            }
            testID={editModeAgent.testID}
            onLayout={editModeAgent.onLayout}
            onPress={onToggleEditMode}
            style={({ pressed }) => [{ opacity: pressed ? 0.72 : 1 }]}>
            <GlassPlate
              inverted={editMode}
              style={[
                styles.editModeButton,
                editMode ? { borderColor: theme.accentPrimary } : null,
              ]}>
              <AppText
                variant="caption"
                color={editMode ? 'onAccent' : 'accent'}>
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
          items={SORT_OPTIONS.map((option) => ({
            ...option,
            selected: sort === option.id,
          }))}
          onSelect={(action) => {
            if (SORT_OPTIONS.some((option) => option.id === action)) {
              onSortChange(action as TodoSort);
              haptics.select();
            }
          }}
        />
        <ChecklistPopoverMenu
          accessibilityLabel={`${list.name} actions`}
          title="List Actions"
          triggerIcon="more"
          testID={AgentUiIds.checklists.detail.actions}
          presentation="sheet"
          sheetSubtitle={list.name}
          closeTestID={AgentUiIds.checklists.detail.actionsClose}
          itemTestID={AgentUiIds.checklists.detail.action}
          items={[
            {
              id: 'copy',
              title: 'Copy',
              description: 'Copy a polished text checklist',
              icon: 'copy',
            },
            {
              id: 'share',
              title: owner ? 'Share' : 'Members',
              description: owner
                ? 'Invite friends, join links, and list settings'
                : 'View people with access',
              icon: owner ? 'share' : 'people',
            },
            ...(canEdit && completedCount > 0
              ? [
                  {
                    id: 'clear',
                    title: 'Clear Completed',
                    description: 'Remove every completed item',
                    icon: 'delete' as const,
                    destructive: true,
                    dividerBefore: true,
                  },
                ]
              : []),
            {
              id: 'remove',
              title: owner ? 'Delete List' : 'Leave List',
              description: owner
                ? 'Permanently delete this list for everyone'
                : 'Remove this list from your account',
              icon: 'delete' as const,
              destructive: true,
              dividerBefore: !(canEdit && completedCount > 0),
            },
          ]}
          onSelect={(action) => {
            if (action === 'copy') {
              void copyTodoListText(list, tasks, members).then((copied) => {
                if (copied) haptics.success();
              });
            }
            if (action === 'share') {
              onManageSettings();
            }
            if (action === 'clear') onClearDone();
            if (action === 'remove') onRemoveList();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  toolbarMenus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
