import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TodoListHeaderToolbar } from '@/features/todos/todo-list-header-toolbar';
import type { TodoList, TodoMember } from '@/store/todos';
import { AgentUiIds } from '@/utils/agent-ui';

jest.mock('@/features/todos/checklist-popover-menu', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    ChecklistPopoverMenu: ({
      accessibilityLabel,
      testID,
    }: {
      accessibilityLabel: string;
      testID?: string;
    }) =>
      React.createElement(View, {
        accessibilityLabel,
        testID,
        accessibilityRole: 'button',
      }),
  };
});

const createdAt = '2026-08-12T00:00:00.000Z';
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};
const list: TodoList = {
  id: 'list-packing',
  name: 'Packing',
  kind: 'checklist',
  mode: 'shared',
  role: 'owner',
  createdAt,
  updatedAt: createdAt,
};
const member: TodoMember = {
  listId: list.id,
  userId: 'user-alex',
  displayName: 'Alex Rivera',
  role: 'editor',
  joinedAt: createdAt,
};
const editModeAgent = {
  ref: jest.fn(),
  testID: AgentUiIds.checklists.detail.editMode,
  onLayout: undefined,
};

function renderToolbar(
  members: TodoMember[],
  overrides: Partial<Parameters<typeof TodoListHeaderToolbar>[0]> = {},
) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <TodoListHeaderToolbar
        list={list}
        tasks={[]}
        members={members}
        owner
        canEdit
        filter="open"
        selectedAssigneeId="all"
        sort="smart"
        editMode={false}
        openTasksCount={2}
        closedTasksCount={0}
        completedCount={0}
        editModeAgent={editModeAgent}
        onFilterToggle={jest.fn()}
        onAssigneeSelect={jest.fn()}
        onToggleEditMode={jest.fn()}
        onSortChange={jest.fn()}
        onClearDone={jest.fn()}
        onManageSettings={jest.fn()}
        onRemoveList={jest.fn()}
        {...overrides}
      />
    </SafeAreaProvider>,
  );
}

describe('TodoListHeaderToolbar', () => {
  it('keeps only edit and list-action icons on the bar', () => {
    renderToolbar([member]);

    expect(screen.getByLabelText('Edit checklist')).toBeTruthy();
    expect(screen.getByLabelText('Packing actions')).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.checklists.detail.actions)).toBeTruthy();
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Done')).toBeNull();
    expect(screen.queryByLabelText(/Filter by assignee:/)).toBeNull();
    expect(screen.queryByLabelText('Sort checklist')).toBeNull();
  });

  it('swaps the edit icon for a check while editing', () => {
    renderToolbar([], { editMode: true });

    expect(screen.getByLabelText('Finish editing checklist')).toBeTruthy();
    expect(screen.queryByText('Done')).toBeNull();
  });
});
