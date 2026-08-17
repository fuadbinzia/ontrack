const mockDeletePersistedRecipeImage = jest.fn();
const mockDeleteSharedChecklist = jest.fn();
const mockLeaveChecklist = jest.fn();
const mockDeleteList = jest.fn();
const mockTodosState = { members: [] as unknown[], recipes: [] as unknown[], deleteList: mockDeleteList };

jest.mock('@/services/recipes', () => ({
  deletePersistedRecipeImage: (...args: unknown[]) => mockDeletePersistedRecipeImage(...args),
}));
jest.mock('@/services/todos/collaboration', () => ({
  deleteSharedChecklist: (...args: unknown[]) => mockDeleteSharedChecklist(...args),
  leaveChecklist: (...args: unknown[]) => mockLeaveChecklist(...args),
}));
jest.mock('@/store/todos', () => ({ useChecklists: { getState: () => mockTodosState } }));
jest.mock('@/utils/confirm-destructive', () => ({
  confirmDestructiveAction: ({ onConfirm }: { onConfirm: () => void }) => onConfirm(),
}));
jest.mock('@/utils/haptics', () => ({ haptics: { warning: jest.fn() } }));

import { confirmRemoveChecklist, performChecklistRemoval } from '../todo-list-remove';

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

    await performChecklistRemoval(list());

    expect(mockDeletePersistedRecipeImage).toHaveBeenCalledTimes(1);
    expect(mockDeletePersistedRecipeImage).toHaveBeenCalledWith('file://owned.jpg');
    expect(mockDeleteList).toHaveBeenCalledWith('list-1');
    expect(mockDeleteSharedChecklist).not.toHaveBeenCalled();
  });

  it('leaves a shared list without deleting it for collaborators', async () => {
    await performChecklistRemoval(list({ mode: 'shared', role: 'member' }));
    expect(mockLeaveChecklist).toHaveBeenCalledWith('list-1');
    expect(mockDeleteSharedChecklist).not.toHaveBeenCalled();
    expect(mockDeleteList).not.toHaveBeenCalled();
  });

  it('does not delete a shared checklist when an editor tries to remove it', async () => {
    await performChecklistRemoval(list({ mode: 'shared', role: 'editor' }));
    expect(mockLeaveChecklist).toHaveBeenCalledWith('list-1');
    expect(mockDeleteSharedChecklist).not.toHaveBeenCalled();
    expect(mockDeleteList).not.toHaveBeenCalled();
  });

  it('does not delete a private checklist for a non-owner', async () => {
    await performChecklistRemoval(list({ role: 'editor' }));
    expect(mockDeleteList).not.toHaveBeenCalled();
    expect(mockDeleteSharedChecklist).not.toHaveBeenCalled();
    expect(mockLeaveChecklist).not.toHaveBeenCalled();
  });

  it('uses the shared deletion boundary for an owner removal', async () => {
    await performChecklistRemoval(list({ mode: 'shared' }));
    expect(mockDeleteSharedChecklist).toHaveBeenCalledWith('list-1');
    expect(mockLeaveChecklist).not.toHaveBeenCalled();
    expect(mockDeleteList).not.toHaveBeenCalled();
  });

  it('leaves for the checklists hub before the store drops the open list', () => {
    const order: string[] = [];
    mockDeleteList.mockImplementation(() => {
      order.push('delete');
    });

    confirmRemoveChecklist(list(), {
      afterRemoved: () => {
        order.push('leave');
      },
    });

    expect(order).toEqual(['leave', 'delete']);
  });

  it('does not confirm deletion when a collaborator cannot delete the checklist', () => {
    confirmRemoveChecklist(list({ role: 'editor' }));
    expect(mockDeleteList).not.toHaveBeenCalled();
    expect(mockDeleteSharedChecklist).not.toHaveBeenCalled();
  });

  it('confirms leave instead of delete for a shared collaborator', () => {
    confirmRemoveChecklist(list({ mode: 'shared', role: 'editor' }));
    expect(mockLeaveChecklist).toHaveBeenCalledWith('list-1');
    expect(mockDeleteSharedChecklist).not.toHaveBeenCalled();
    expect(mockDeleteList).not.toHaveBeenCalled();
  });
});
