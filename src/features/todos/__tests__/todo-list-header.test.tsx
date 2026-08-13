import { render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import type { TextInput } from 'react-native';

import { TodoListHeader } from '@/features/todos/todo-list-header';
import type { TodoList } from '@/store/todos';
import { AgentUiIds } from '@/utils/agent-ui';

jest.mock('@/components/primitives/progress-ring', () => {
  const React = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  return {
    ProgressRing: ({ label, sublabel }: { label: string; sublabel: string }) =>
      React.createElement(
        View,
        { testID: 'progress-ring' },
        React.createElement(Text, null, `${label} ${sublabel}`),
      ),
  };
});

jest.mock('@/features/todos/todo-list-header-toolbar', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    TodoListHeaderToolbar: () => React.createElement(View),
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: () => true,
    back: jest.fn(),
    replace: jest.fn(),
  }),
}));

const createdAt = '2026-08-12T00:00:00.000Z';
const list: TodoList = {
  id: 'list-todo',
  name: 'To Do',
  kind: 'checklist',
  mode: 'private',
  role: 'owner',
  createdAt,
  updatedAt: createdAt,
};
const agent = {
  ref: jest.fn(),
  testID: AgentUiIds.checklists.detail.editMode,
  onLayout: undefined,
};

function renderHeader(
  overrides: Partial<Parameters<typeof TodoListHeader>[0]> = {},
) {
  return render(
    <TodoListHeader
      list={list}
      tasks={[]}
      categories={[]}
      selectedCategoryId="all"
      selectedAssigneeId="all"
      members={[]}
      owner
      canEdit
      completedCount={0}
      progress={0}
      draft=""
      filter="open"
      sort="smart"
      editMode={false}
      nameDraft={list.name}
      openTasksCount={0}
      closedTasksCount={0}
      inputRef={createRef<TextInput>()}
      newTaskAgent={agent}
      addTaskAgent={agent}
      editModeAgent={agent}
      onDraftChange={jest.fn()}
      onNameChange={jest.fn()}
      onNameSubmit={jest.fn()}
      onAdd={jest.fn()}
      onClearSyncError={jest.fn()}
      onFilterToggle={jest.fn()}
      onToggleEditMode={jest.fn()}
      onSortChange={jest.fn()}
      onClearDone={jest.fn()}
      onCategorySelect={jest.fn()}
      onAssigneeSelect={jest.fn()}
      onManageSettings={jest.fn()}
      onRemoveList={jest.fn()}
      {...overrides}
    />,
  );
}

describe('TodoListHeader', () => {
  it('makes the list title tappable in owner edit mode without auto-focusing', () => {
    renderHeader({ editMode: true, nameDraft: 'To Do' });

    const title = screen.getByLabelText('Checklist title');
    expect(title).toHaveProp('value', 'To Do');
    expect(title).not.toHaveProp('autoFocus', true);
  });

  it('keeps the title read-only outside edit mode', () => {
    renderHeader({ editMode: false });

    expect(screen.queryByLabelText('Checklist title')).toBeNull();
    expect(screen.getByText('To Do')).toBeTruthy();
  });

  it('shows completion beside the title without the momentum card copy', () => {
    renderHeader({
      tasks: [
        {
          id: 'task-open',
          listId: list.id,
          title: 'Open task',
          completed: false,
          important: false,
          createdAt,
          updatedAt: createdAt,
          version: 1,
        },
        {
          id: 'task-done',
          listId: list.id,
          title: 'Done task',
          completed: true,
          important: false,
          createdAt,
          updatedAt: createdAt,
          version: 1,
        },
      ],
      completedCount: 1,
      progress: 0.5,
    });

    expect(screen.getByText('50% done')).toBeTruthy();
    expect(screen.queryByText('Momentum')).toBeNull();
    expect(screen.queryByText(/complete$/)).toBeNull();
  });
});
