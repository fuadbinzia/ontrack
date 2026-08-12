import { render, screen } from '@testing-library/react-native';

import { TodoListCard } from '@/features/todos/todo-list-card';
import type { TodoList } from '@/store/todos';

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

describe('TodoListCard', () => {
  it('shows collaborator avatars without rendering their names as tile text', () => {
    render(
      <TodoListCard
        editMode={false}
        list={list}
        nameDraft={list.name}
        collaborators={[
          { userId: 'alex', displayName: 'Alex Rivera' },
          { userId: 'jordan', displayName: 'Jordan Lee' },
        ]}
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
      />,
    );

    expect(screen.queryByText('Alex Rivera')).toBeNull();
    expect(screen.queryByText('Jordan Lee')).toBeNull();
    expect(screen.getByLabelText('Shared with Alex Rivera, Jordan Lee')).toBeTruthy();
  });
});
