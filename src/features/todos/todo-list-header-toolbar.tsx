import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/primitives';
import { ChecklistPopoverMenu } from '@/features/todos/checklist-popover-menu';
import { copyTodoListText } from '@/features/todos/share';
import {
  parseTodoListToolbarAction,
  todoListToolbarActionItems,
  todoListToolbarActionTestID,
} from '@/features/todos/todo-list-toolbar-actions';
import type { TodoFilter, TodoSort } from '@/features/todos/todo-sort';
import { useTheme } from '@/hooks/use-theme';
import type { TodoList, TodoMember, TodoTask } from '@/store/todos';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

type AgentUiTargetApi = ReturnType<typeof useAgentUiTarget>;

export function TodoListHeaderToolbar({
  list,
  tasks,
  members,
  owner,
  canEdit,
  selectedAssigneeId,
  sort,
  editMode,
  completedCount,
  editModeAgent,
  onAssigneeSelect,
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
  selectedAssigneeId: string;
  sort: TodoSort;
  editMode: boolean;
  openTasksCount: number;
  closedTasksCount: number;
  completedCount: number;
  editModeAgent: AgentUiTargetApi;
  onFilterToggle: () => void;
  onAssigneeSelect: (id: string) => void;
  onToggleEditMode: () => void;
  onSortChange: (sort: TodoSort) => void;
  onClearDone: () => void;
  onManageSettings: () => void;
  onRemoveList: () => void;
}) {
  const theme = useTheme();
  const showEdit = owner || (canEdit && tasks.length > 0);

  return (
    <View style={styles.toolbarMenus}>
      {showEdit ? (
        <IconButton
          testID={editModeAgent.testID}
          accessibilityLabel={
            editMode ? 'Finish editing checklist' : 'Edit checklist'
          }
          icon={editMode ? 'check' : 'edit'}
          iconSize={16}
          size={36}
          appearance={editMode ? 'solid' : 'glass'}
          color={editMode ? theme.textOnAccent : theme.accentPrimary}
          background={editMode ? theme.accentPrimary : undefined}
          onPress={onToggleEditMode}
        />
      ) : null}
      <ChecklistPopoverMenu
        accessibilityLabel={`${list.name} actions`}
        title="List Actions"
        triggerIcon="more"
        testID={AgentUiIds.checklists.detail.actions}
        presentation="sheet"
        sheetSubtitle={list.name}
        closeTestID={AgentUiIds.checklists.detail.actionsClose}
        itemTestID={todoListToolbarActionTestID}
        items={todoListToolbarActionItems({
          sort,
          members,
          selectedAssigneeId,
          owner,
          canEdit,
          completedCount,
        })}
        onSelect={(action) => {
          const parsed = parseTodoListToolbarAction(action);
          if (parsed.kind === 'sort') {
            onSortChange(parsed.value as TodoSort);
            haptics.select();
            return;
          }
          if (parsed.kind === 'assignee') {
            onAssigneeSelect(parsed.value);
            haptics.select();
            return;
          }
          if (parsed.value === 'copy') {
            void copyTodoListText(list, tasks, members).then((copied) => {
              if (copied) haptics.success();
            });
          }
          if (parsed.value === 'share') onManageSettings();
          if (parsed.value === 'clear') onClearDone();
          if (parsed.value === 'remove') onRemoveList();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbarMenus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    gap: 4,
  },
});
