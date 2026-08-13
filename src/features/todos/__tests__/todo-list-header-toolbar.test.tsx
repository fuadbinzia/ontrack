import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TodoListHeaderToolbar } from '@/features/todos/todo-list-header-toolbar';
import type { TodoList, TodoMember } from '@/store/todos';

jest.mock('@/features/todos/checklist-popover-menu', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    ChecklistPopoverMenu: () => React.createElement(View),
  };
});

jest.mock('@/features/account/profile-avatar', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    ProfileAvatar: ({ displayName }: { displayName: string }) =>
      React.createElement(View, { accessibilityLabel: displayName }),
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
  testID: 'ontrack.checklists.detail.editMode',
  onLayout: undefined,
};

function renderToolbar(
  members: TodoMember[],
  selectedAssigneeId = 'all',
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
        selectedAssigneeId={selectedAssigneeId}
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
      />
    </SafeAreaProvider>,
  );
}

describe('TodoListHeaderToolbar assignee filter', () => {
  it('shows an assignee filter for collaborative checklists', () => {
    renderToolbar([member]);

    expect(screen.getByLabelText('Filter by assignee: All Assignees')).toBeTruthy();
  });

  it('reflects the selected collaborator in the filter label', () => {
    renderToolbar([member], member.userId);

    expect(
      screen.getByLabelText('Filter by assignee: Alex Rivera'),
    ).toBeTruthy();
  });

  it('hides the assignee filter when the checklist has no members', () => {
    renderToolbar([]);

    expect(screen.queryByLabelText(/Filter by assignee:/)).toBeNull();
  });
});
