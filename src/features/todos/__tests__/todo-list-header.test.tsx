import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import type { TextInput } from 'react-native';

import { TodoListHeader } from '@/features/todos/todo-list-header';
import type { TodoList } from '@/store/todos';
import { AgentUiIds } from '@/utils/agent-ui';

jest.mock('@/features/todos/todo-list-header-toolbar', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    TodoListHeaderToolbar: () => React.createElement(View),
  };
});

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
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

  it('uses a tappable open count instead of a progress ring', () => {
    renderHeader({
      openTasksCount: 48,
      closedTasksCount: 17,
      filter: 'open',
    });

    expect(screen.getByText('48 Open')).toBeTruthy();
    expect(screen.getByLabelText('Showing 48 open tasks. Show closed tasks')).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.checklists.detail.filter)).toBeTruthy();
    expect(screen.queryByText('50% done')).toBeNull();
    expect(screen.queryByText('Momentum')).toBeNull();
  });

  it('keeps the open-count chip left of edit without a chevron', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/todos/todo-list-header.tsx'),
      'utf8',
    );

    expect(source).not.toContain('DisclosureChevron');
    expect(source).toContain('titleActions');
    expect(source.indexOf('filterChip')).toBeLessThan(
      source.indexOf('<TodoListHeaderToolbar'),
    );
  });

  it('toggles the closed count chip and keeps the same control', () => {
    const onFilterToggle = jest.fn();
    renderHeader({
      openTasksCount: 48,
      closedTasksCount: 17,
      filter: 'completed',
      onFilterToggle,
    });

    const chip = screen.getByLabelText(
      'Showing 17 closed tasks. Show open tasks',
    );
    expect(screen.getByText('17 Closed')).toBeTruthy();
    expect(screen.queryByText('48 Open')).toBeNull();
    fireEvent.press(chip);
    expect(onFilterToggle).toHaveBeenCalledTimes(1);
  });

  it('asks for a new item in plain language', () => {
    renderHeader();

    expect(screen.getByPlaceholderText('Add an item')).toBeTruthy();
    expect(screen.queryByPlaceholderText('What needs your attention?')).toBeNull();
  });

  it('keeps add-task on a glass send control', () => {
    renderHeader({ draft: 'Pack bags' });

    expect(screen.getByLabelText('Add task')).toBeTruthy();
    expect(screen.getByLabelText('New task')).toBeTruthy();
  });
});

describe('TodoListHeader layout', () => {
  it('pins list actions to the top-right nav row', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/todos/todo-list-header.tsx'),
      'utf8',
    );

    expect(source).toContain('navRow');
    expect(source).toContain('titleActions');
    expect(source.indexOf('titleActions')).toBeLessThan(
      source.indexOf('headingCopy'),
    );
    expect(source.indexOf('<TodoListHeaderToolbar')).toBeLessThan(
      source.indexOf('list.name'),
    );
    expect(source.indexOf('<TodoListHeaderToolbar')).toBeLessThan(
      source.indexOf('Add an item'),
    );
    expect(source).toContain('testID={AgentUiIds.checklists.detail.title}');
    expect(source).toContain('label={list.name}');
  });
});
