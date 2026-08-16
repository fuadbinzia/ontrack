import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react-native';

import { TodoListCard } from '@/features/todos/todo-list-card';
import type { TodoList } from '@/store/todos';

jest.mock('@/components/primitives/symbol', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    Symbol: ({ name }: { name: string }) =>
      React.createElement(View, { accessibilityLabel: `symbol:${name}` }),
  };
});

jest.mock('@/features/account/profile-avatar', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    ProfileAvatar: ({ displayName }: { displayName: string }) =>
      React.createElement(View, {
        accessibilityRole: 'image',
        accessibilityLabel: displayName,
      }),
  };
});

const createdAt = '2026-08-12T00:00:00.000Z';
const list: TodoList = {
  id: 'list-features',
  name: 'Features',
  kind: 'checklist',
  mode: 'shared',
  role: 'owner',
  createdAt,
  updatedAt: createdAt,
};

function renderCard(
  overrides: Partial<ComponentProps<typeof TodoListCard>> = {},
) {
  return render(
    <TodoListCard
      editMode={false}
      list={list}
      nameDraft={list.name}
      open={2}
      total={3}
      onPress={jest.fn()}
      onDragStart={jest.fn()}
      onNameChange={jest.fn()}
      onNameSubmit={jest.fn()}
      onMoveDown={jest.fn()}
      onMoveUp={jest.fn()}
      onRemove={jest.fn()}
      canMoveDown={false}
      canMoveUp={false}
      isActive={false}
      {...overrides}
    />,
  );
}

describe('TodoListCard', () => {
  it('shows collaborator avatars without rendering their names as tile text', () => {
    renderCard({
      collaborators: [
        { userId: 'alex', displayName: 'Alex Rivera' },
        { userId: 'jordan', displayName: 'Jordan Lee' },
      ],
    });

    expect(screen.queryByText('Alex Rivera')).toBeNull();
    expect(screen.queryByText('Jordan Lee')).toBeNull();
    expect(screen.getByLabelText('Shared with Alex Rivera, Jordan Lee')).toBeTruthy();
  });

  it('title-cases the open-count metadata label', () => {
    renderCard();

    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.queryByText('open')).toBeNull();
  });

  it('does not render a leading checklist icon beside the title', () => {
    renderCard();

    expect(screen.getByText('Features')).toBeTruthy();
    expect(screen.queryByLabelText('symbol:tasks')).toBeNull();
  });

  it('does not render a leading grocery icon beside the title', () => {
    renderCard({
      list: { ...list, id: 'list-groceries', name: 'Groceries', kind: 'grocery' },
      nameDraft: 'Groceries',
    });

    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.queryByLabelText('symbol:groceries')).toBeNull();
  });

  it('still shows delete and drag symbols in edit mode', () => {
    renderCard({ editMode: true });

    expect(screen.getByLabelText('Delete Features')).toBeTruthy();
    expect(screen.getByLabelText('symbol:delete')).toBeTruthy();
  });

  it('puts delete on the far left in edit mode, before drag', () => {
    renderCard({ editMode: true });

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveProp('accessibilityLabel', 'Delete Features');
    expect(buttons[buttons.length - 1]).toHaveProp(
      'accessibilityLabel',
      'Drag to reorder Features',
    );
  });

  it('centers the edit-row trash icon with the list name inside the card', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/todos/todo-list-card.tsx'),
      'utf8',
    );
    expect(source).toContain("alignItems: 'center'");
    expect(source).toContain("textAlignVertical: 'center'");
    expect(source).toContain('includeFontPadding: false');
    expect(source).not.toContain('fieldLeadingIconRowStyle');
    expect(source).not.toContain("alignItems: 'flex-start'");
  });

  it('hides open counts and collaborator chips while editing', () => {
    renderCard({
      editMode: true,
      collaborators: [
        { userId: 'alex', displayName: 'Alex Rivera' },
        { userId: 'jordan', displayName: 'Jordan Lee' },
      ],
    });

    expect(screen.queryByText('Open')).toBeNull();
    expect(screen.queryByText('2')).toBeNull();
    expect(screen.queryByLabelText('Shared with Alex Rivera, Jordan Lee')).toBeNull();
  });

  it('does not show a completion rail on open, finished, or empty lists', () => {
    const { rerender } = renderCard({ open: 2, total: 3 });
    expect(screen.queryByRole('progressbar')).toBeNull();

    rerender(
      <TodoListCard
        editMode={false}
        list={list}
        nameDraft={list.name}
        open={0}
        total={4}
        onPress={jest.fn()}
        onDragStart={jest.fn()}
        onNameChange={jest.fn()}
        onNameSubmit={jest.fn()}
        onMoveDown={jest.fn()}
        onMoveUp={jest.fn()}
        onRemove={jest.fn()}
        canMoveDown={false}
        canMoveUp={false}
        isActive={false}
      />,
    );
    expect(screen.getByText('Clear')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();

    rerender(
      <TodoListCard
        editMode={false}
        list={list}
        nameDraft={list.name}
        open={0}
        total={0}
        onPress={jest.fn()}
        onDragStart={jest.fn()}
        onNameChange={jest.fn()}
        onNameSubmit={jest.fn()}
        onMoveDown={jest.fn()}
        onMoveUp={jest.fn()}
        onRemove={jest.fn()}
        canMoveDown={false}
        canMoveUp={false}
        isActive={false}
      />,
    );
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('labels a finished list Clear instead of Open', () => {
    renderCard({ open: 0, total: 4 });

    expect(screen.getByText('Clear')).toBeTruthy();
    expect(screen.queryByText('Open')).toBeNull();
  });
});
