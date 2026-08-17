import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/primitives';
import { ChecklistPopoverMenu } from '@/features/todos/checklist-popover-menu';
import { copyChecklistText } from '@/features/todos/share';
import {
  parseChecklistToolbarAction,
  checklistToolbarActionItems,
  checklistToolbarActionTestID,
} from '@/features/todos/todo-list-toolbar-actions';
import type { ChecklistFilter, ChecklistSort } from '@/features/todos/todo-sort';
import { useTheme } from '@/hooks/use-theme';
import type { Checklist, ChecklistMember, ChecklistTask } from '@/store/todos';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

type AgentUiTargetApi = ReturnType<typeof useAgentUiTarget>;

export function ChecklistHeaderToolbar({
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
  list: Checklist;
  tasks: ChecklistTask[];
  members: ChecklistMember[];
  owner: boolean;
  canEdit: boolean;
  filter: ChecklistFilter;
  selectedAssigneeId: string;
  sort: ChecklistSort;
  editMode: boolean;
  openTasksCount: number;
  closedTasksCount: number;
  completedCount: number;
  editModeAgent: AgentUiTargetApi;
  onFilterToggle: () => void;
  onAssigneeSelect: (id: string) => void;
  onToggleEditMode: () => void;
  onSortChange: (sort: ChecklistSort) => void;
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
        itemTestID={checklistToolbarActionTestID}
        items={checklistToolbarActionItems({
          sort,
          members,
          selectedAssigneeId,
          owner,
          canEdit,
          completedCount,
        })}
        onSelect={(action) => {
          const parsed = parseChecklistToolbarAction(action);
          if (parsed.kind === 'sort') {
            onSortChange(parsed.value as ChecklistSort);
            haptics.select();
            return;
          }
          if (parsed.kind === 'assignee') {
            onAssigneeSelect(parsed.value);
            haptics.select();
            return;
          }
          if (parsed.value === 'copy') {
            void copyChecklistText(list, tasks, members).then((copied) => {
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
