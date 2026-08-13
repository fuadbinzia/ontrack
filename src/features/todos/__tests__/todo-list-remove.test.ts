const mockDeletePersistedRecipeImage = jest.fn();
const mockDeleteSharedTodoList = jest.fn();
const mockLeaveTodoList = jest.fn();
const mockDeleteList = jest.fn();
const mockTodosState = { members: [] as unknown[], recipes: [] as unknown[], deleteList: mockDeleteList };

jest.mock('@/services/recipes', () => ({
  deletePersistedRecipeImage: (...args: unknown[]) => mockDeletePersistedRecipeImage(...args),
}));
jest.mock('@/services/todos/collaboration', () => ({
  deleteSharedTodoList: (...args: unknown[]) => mockDeleteSharedTodoList(...args),
  leaveTodoList: (...args: unknown[]) => mockLeaveTodoList(...args),
}));
jest.mock('@/store/todos', () => ({ useTodos: { getState: () => mockTodosState } }));

import { performTodoListRemoval } from '../todo-list-remove';

const list = (overrides: Record<string, unknown> = {}) => ({
  id: 'list-1', name: 'Weekend', kind: 'checklist', mode: 'private', role: 'owner',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
}) as never;

describe('todo list removal boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTodosState.members = [];
    mockTodosState.recipes = [];
  });

  it('deletes only recipe media belonging to a removed private list', async () => {
    mockTodosState.recipes = [
      { listId: 'list-1', sourceImageUri: 'file://owned.jpg' },
      { listId: 'list-2', sourceImageUri: 'file://other.jpg' },
    ];

    await performTodoListRemoval(list(), false);

    expect(mockDeletePersistedRecipeImage).toHaveBeenCalledTimes(1);
    expect(mockDeletePersistedRecipeImage).toHaveBeenCalledWith('file://owned.jpg');
    expect(mockDeleteList).toHaveBeenCalledWith('list-1');
    expect(mockDeleteSharedTodoList).not.toHaveBeenCalled();
  });

  it('leaves a shared list without deleting it for collaborators', async () => {
    await performTodoListRemoval(list({ mode: 'shared', role: 'member' }), true);
    expect(mockLeaveTodoList).toHaveBeenCalledWith('list-1');
    expect(mockDeleteSharedTodoList).not.toHaveBeenCalled();
    expect(mockDeleteList).not.toHaveBeenCalled();
  });

  it('uses the shared deletion boundary for an owner removal', async () => {
    await performTodoListRemoval(list({ mode: 'shared' }), false);
    expect(mockDeleteSharedTodoList).toHaveBeenCalledWith('list-1');
    expect(mockLeaveTodoList).not.toHaveBeenCalled();
    expect(mockDeleteList).not.toHaveBeenCalled();
  });
});
