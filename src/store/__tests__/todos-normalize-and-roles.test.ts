import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import {
    canCompleteChecklistTask,
    canDeleteChecklist,
    canEditChecklistContent,
    canLeaveChecklist,
    normalizeChecklistState,
    privateChecklistPayload,
    useChecklists,
} from '@/store/todos';
import { useAuthAccess } from '@/store/auth-access';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('checklist store normalize, roles, and grocery', () => {
  beforeEach(() => {
    useChecklists.getState().reset();
    useAuthAccess.getState().resetAccess();
  });

  it('migrates the legacy flat checklist into a default list with new task ids', () => {
    const migrated = normalizeChecklistState({
      tasks: [{
        id: 'legacy-task',
        title: 'Keep me',
        completed: true,
        important: true,
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-02T10:00:00.000Z',
        completedAt: '2026-07-02T10:00:00.000Z',
      }],
    });

    expect(migrated.lists).toHaveLength(1);
    expect(migrated.lists[0].name).toBe('To Do');
    expect(migrated.tasks[0]).toMatchObject({
      listId: migrated.lists[0].id,
      title: 'Keep me',
      completed: true,
      important: true,
    });
    expect(migrated.tasks[0].id).not.toBe('legacy-task');
  });

  it('applies server task positions from shared snapshots', () => {
    const shared = {
      ...useChecklists.getState().lists[0],
      id: '9a21f566-3bc6-43df-a125-03e4c4541963',
      name: 'Shared order',
      mode: 'shared' as const,
    };
    const base = {
      listId: shared.id,
      completed: false,
      important: false,
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
      version: 0,
    };
    useChecklists.getState().replaceSharedSnapshot({
      list: shared,
      tasks: [
        { ...base, id: 'task-a', title: 'A', position: 0 },
        { ...base, id: 'task-b', title: 'B', position: 1 },
      ],
      members: [],
    });
    useChecklists.setState((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === 'task-a'
          ? { ...task, position: 1 }
          : task.id === 'task-b'
            ? { ...task, position: 0 }
            : task,
      ),
    }));
    useChecklists.getState().replaceSharedSnapshot({
      list: { ...shared, updatedAt: '2026-07-28T12:00:00.000Z' },
      tasks: [
        { ...base, id: 'task-a', title: 'A', position: 0 },
        { ...base, id: 'task-b', title: 'B', position: 1 },
      ],
      members: [],
    });
    const ordered = useChecklists
      .getState()
      .tasks.filter((task) => task.listId === shared.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    expect(ordered.map((task) => task.id)).toEqual(['task-a', 'task-b']);
  });

  it('excludes shared caches and mutations from the private account payload', () => {
    const state = useChecklists.getState();
    const privateList = state.lists[0];
    const sharedList = {
      ...privateList,
      id: '6af777b8-a5d6-4bb3-a117-484918e333b9',
      name: 'Shared',
      mode: 'shared' as const,
    };
    const sharedTask = {
      ...state.addTask(privateList.id, 'Private')!,
      id: 'abed5890-e04b-47ea-89cc-08d3f3d9837f',
      listId: sharedList.id,
      title: 'Shared task',
    };
    useChecklists.getState().replaceSharedSnapshot({
      list: sharedList,
      tasks: [sharedTask],
      members: [],
    });

    const payload = privateChecklistPayload(useChecklists.getState());
    expect(payload.lists.map((list) => list.name)).not.toContain('Shared');
    expect(payload.tasks.map((task) => task.title)).not.toContain('Shared task');
  });

  it('allows members to complete only assigned or anyone items', () => {
    const state = normalizeChecklistState(undefined);
    const list = { ...state.lists[0], mode: 'shared' as const, role: 'member' as const };
    const baseTask = {
      id: 'task',
      listId: list.id,
      title: 'Task',
      completed: false,
      important: false,
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
      version: 0,
    };

    expect(canCompleteChecklistTask(list, baseTask, 'member-a')).toBe(true);
    expect(
      canCompleteChecklistTask(list, { ...baseTask, assigneeUserIds: ['member-a'] }, 'member-a'),
    ).toBe(true);
    expect(
      canCompleteChecklistTask(
        list,
        { ...baseTask, assigneeUserIds: ['member-a', 'member-c'] },
        'member-a',
      ),
    ).toBe(true);
    expect(
      canCompleteChecklistTask(list, { ...baseTask, assigneeUserIds: ['member-b'] }, 'member-a'),
    ).toBe(false);
  });

  it('lets editors complete any item and edit content', () => {
    const state = normalizeChecklistState(undefined);
    const editorList = {
      ...state.lists[0],
      mode: 'shared' as const,
      role: 'editor' as const,
    };
    const memberList = { ...editorList, role: 'member' as const };
    const baseTask = {
      id: 'task',
      listId: editorList.id,
      title: 'Task',
      completed: false,
      important: false,
      assigneeUserIds: ['someone-else'],
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
      version: 0,
    };

    expect(canEditChecklistContent(editorList)).toBe(true);
    expect(canEditChecklistContent(memberList)).toBe(false);
    expect(canCompleteChecklistTask(editorList, baseTask, 'editor-a')).toBe(true);
    expect(canCompleteChecklistTask(memberList, baseTask, 'member-a')).toBe(false);
    expect(canDeleteChecklist(editorList)).toBe(false);
    expect(canDeleteChecklist(memberList)).toBe(false);
    expect(canDeleteChecklist({ ...editorList, kind: 'grocery', role: 'editor' })).toBe(false);
    expect(canDeleteChecklist({ ...editorList, role: 'owner' })).toBe(true);
    expect(canLeaveChecklist(editorList)).toBe(true);
    expect(canLeaveChecklist(memberList)).toBe(true);
    expect(canLeaveChecklist({ ...editorList, role: 'owner' })).toBe(false);
    expect(canLeaveChecklist({ ...editorList, mode: 'private', role: 'editor' })).toBe(false);
  });

  it('migrates recognized grocery names but preserves explicit checklist kinds', () => {
    const migrated = normalizeChecklistState({
      groceryMigrationVersion: 1,
      lists: [
        {
          id: 'list-grocery',
          name: 'Weekly Groceries',
          mode: 'private',
          role: 'owner',
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
        {
          id: 'list-explicit',
          name: 'Supermarket planning',
          kind: 'checklist',
          mode: 'private',
          role: 'owner',
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    });

    expect(migrated.lists.find((list) => list.id === 'list-grocery')?.kind)
      .toBe('grocery');
    expect(migrated.lists.find((list) => list.id === 'list-explicit')?.kind)
      .toBe('checklist');
  });

  it('repairs grocery lists from the pre-feature in-memory schema once', () => {
    const legacy = {
      lists: [{
        id: 'legacy-groceries',
        name: 'Groceries',
        kind: 'checklist',
        mode: 'private',
        role: 'owner',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      }],
    };
    expect(normalizeChecklistState(legacy).lists[0].kind).toBe('grocery');
    expect(
      normalizeChecklistState({
        ...legacy,
        groceryMigrationVersion: 1,
      }).lists[0].kind,
    ).toBe('checklist');
  });

  it('adds a recipe and prevents converting back while its group exists', () => {
    const list = useChecklists.getState().createList('Meal shop', 'grocery')!;
    const recipe = useChecklists.getState().addRecipe(list.id, {
      name: 'Pasta',
      sourceKind: 'url',
      sourceUrl: 'https://example.com/pasta',
      originalServings: 2,
      targetServings: 4,
      ingredients: [
        {
          name: 'Tomato',
          canonicalKey: 'tomato',
          quantityValue: 4,
          quantityText: '4',
          unit: 'count',
        },
        { name: 'Salt', quantityText: 'to taste' },
      ],
    });

    expect(recipe).toBeDefined();
    expect(
      useChecklists.getState().tasks.filter((task) => task.recipeId === recipe?.id),
    ).toHaveLength(2);
    expect(useChecklists.getState().setListKind(list.id, 'checklist')).toBe(false);

    useChecklists.getState().deleteRecipe(recipe!.id);
    expect(useChecklists.getState().setListKind(list.id, 'checklist')).toBe(true);
  });

  it('batch completion updates every permitted occurrence only', () => {
    const list = useChecklists.getState().createList('Shop', 'grocery')!;
    const recipe = useChecklists.getState().addRecipe(list.id, {
      name: 'Dinner',
      sourceKind: 'url',
      ingredients: [{ name: 'Onion' }, { name: 'Garlic' }],
    })!;
    const tasks = useChecklists
      .getState()
      .tasks.filter((task) => task.recipeId === recipe.id);
    useChecklists.setState((state) => ({
      lists: state.lists.map((item) =>
        item.id === list.id
          ? { ...item, mode: 'shared', role: 'member' }
          : item,
      ),
      tasks: state.tasks.map((task) =>
        task.id === tasks[1].id
          ? { ...task, assigneeUserIds: ['someone-else'] }
          : task,
      ),
    }));

    useChecklists
      .getState()
      .setTasksCompletion(tasks.map((task) => task.id), true, 'member-a');

    expect(
      useChecklists.getState().tasks.find((task) => task.id === tasks[0].id)?.completed,
    ).toBe(true);
    expect(
      useChecklists.getState().tasks.find((task) => task.id === tasks[1].id)?.completed,
    ).toBe(false);
  });
});
