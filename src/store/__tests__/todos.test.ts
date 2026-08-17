import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { normalizeChecklistState, useChecklists } from '@/store/todos';
import { useAuthAccess } from '@/store/auth-access';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('checklist store', () => {
  beforeEach(() => {
    useChecklists.getState().reset();
    useAuthAccess.getState().resetAccess();
  });

  it('captures, edits, prioritizes, and completes a task', () => {
    const task = useChecklists.getState().addTask('  Make a thoughtful plan  ');
    expect(task?.title).toBe('Make a thoughtful plan');

    useChecklists.getState().toggleImportant(task!.id);
    useChecklists.getState().updateTask(task!.id, 'Make a simple plan');
    useChecklists.getState().toggleTask(task!.id);

    expect(useChecklists.getState().tasks[0]).toMatchObject({
      title: 'Make a simple plan',
      important: true,
      completed: true,
    });
    expect(useChecklists.getState().tasks[0].completedAt).toBeDefined();
  });

  it('ignores empty tasks and clears only completed work', () => {
    expect(useChecklists.getState().addTask('   ')).toBeUndefined();
    const done = useChecklists.getState().addTask('Done');
    useChecklists.getState().addTask('Still open');
    useChecklists.getState().toggleTask(done!.id);
    useChecklists.getState().clearCompleted();

    expect(useChecklists.getState().tasks.map((task) => task.title)).toEqual(['Still open']);
  });

  it('keeps tasks isolated inside multiple named lists', () => {
    const groceries = useChecklists.getState().createList('  Groceries  ');
    const maintenance = useChecklists.getState().createList('Maintenance');
    useChecklists.getState().addTask(groceries!.id, 'Milk');
    useChecklists.getState().addTask(maintenance!.id, 'Replace air filter');

    expect(
      useChecklists.getState().tasks
        .filter((task) => task.listId === groceries!.id)
        .map((task) => task.title),
    ).toEqual(['Milk']);
    expect(
      useChecklists.getState().tasks
        .filter((task) => task.listId === maintenance!.id)
        .map((task) => task.title),
    ).toEqual(['Replace air filter']);
  });

  it('creates categories, assigns items, and uncategorizes on removal', () => {
    const list = useChecklists.getState().createList('Projects');
    const category = useChecklists.getState().addCategory(list!.id, 'Finance');
    const task = useChecklists.getState().addTask(list!.id, 'Review budget', category!.id);

    expect(task?.categoryId).toBe(category?.id);
    expect(useChecklists.getState().categories).toEqual([category]);

    useChecklists.getState().deleteCategory(category!.id);

    expect(useChecklists.getState().categories).toEqual([]);
    expect(useChecklists.getState().tasks.find((item) => item.id === task?.id)?.categoryId)
      .toBeUndefined();
  });

  it('normalizes category assignments only within known categories', () => {
    const normalized = normalizeChecklistState({
      groceryMigrationVersion: 1,
      lists: [{
        id: 'list-1',
        name: 'Projects',
        kind: 'checklist',
        mode: 'private',
        role: 'owner',
        createdAt: '2026-08-12T00:00:00.000Z',
        updatedAt: '2026-08-12T00:00:00.000Z',
      }],
      categories: [{
        id: 'category-1',
        listId: 'list-1',
        name: 'Finance',
        position: 0,
        createdAt: '2026-08-12T00:00:00.000Z',
        updatedAt: '2026-08-12T00:00:00.000Z',
      }],
      tasks: [
        { id: 'task-1', listId: 'list-1', title: 'Budget', categoryId: 'category-1' },
        { id: 'task-2', listId: 'list-1', title: 'Orphan', categoryId: 'missing' },
      ],
    });

    expect(normalized.tasks.find((task) => task.id === 'task-1')?.categoryId)
      .toBe('category-1');
    expect(normalized.tasks.find((task) => task.id === 'task-2')?.categoryId)
      .toBeUndefined();
  });

  it('drops category assignments that belong to another checklist', () => {
    const normalized = normalizeChecklistState({
      groceryMigrationVersion: 1,
      lists: [
        {
          id: 'list-1',
          name: 'Projects',
          kind: 'checklist',
          mode: 'private',
          role: 'owner',
          createdAt: '2026-08-12T00:00:00.000Z',
          updatedAt: '2026-08-12T00:00:00.000Z',
        },
        {
          id: 'list-2',
          name: 'Home',
          kind: 'checklist',
          mode: 'private',
          role: 'owner',
          createdAt: '2026-08-12T00:00:00.000Z',
          updatedAt: '2026-08-12T00:00:00.000Z',
        },
      ],
      categories: [{
        id: 'category-home',
        listId: 'list-2',
        name: 'Repairs',
        position: 0,
        createdAt: '2026-08-12T00:00:00.000Z',
        updatedAt: '2026-08-12T00:00:00.000Z',
      }],
      tasks: [{
        id: 'task-project',
        listId: 'list-1',
        title: 'Review proposal',
        categoryId: 'category-home',
      }],
    });

    expect(normalized.tasks[0].categoryId).toBeUndefined();
  });

  it('queues shared task creation before its category assignment', () => {
    const list = useChecklists.getState().lists[0];
    useChecklists.setState((state) => ({
      lists: state.lists.map((item) =>
        item.id === list.id ? { ...item, mode: 'shared', role: 'owner' } : item,
      ),
    }));
    const category = useChecklists.getState().addCategory(list.id, 'Finance')!;
    useChecklists.getState().addTask(list.id, 'Review budget', category.id);

    expect(useChecklists.getState().pendingMutations.map((mutation) => mutation.operation))
      .toEqual(['add_category', 'add_task', 'set_task_category']);
  });

  it('preserves shared categories when a legacy snapshot omits the field', () => {
    const initial = useChecklists.getState();
    const list = {
      ...initial.lists[0],
      mode: 'shared' as const,
      role: 'owner' as const,
    };
    const category = {
      id: 'category-finance',
      listId: list.id,
      name: 'Finance',
      position: 0,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    };
    const task = {
      ...initial.addTask(list.id, 'Review budget')!,
      categoryId: category.id,
    };
    useChecklists.getState().replaceSharedSnapshot({
      list,
      categories: [category],
      tasks: [task],
      members: [],
    });

    useChecklists.getState().replaceSharedSnapshot({
      list: { ...list, updatedAt: '2026-08-12T12:00:00.000Z' },
      tasks: [{ ...task, title: 'Review updated budget' }],
      members: [],
    });

    expect(useChecklists.getState().categories).toEqual([category]);
  });

  it('keeps shared snapshot tasks and members inside their checklist', () => {
    const state = useChecklists.getState();
    const privateList = state.lists[0];
    const sharedList = {
      ...privateList,
      id: '9a21f566-3bc6-43df-a125-03e4c4541963',
      name: 'Shared projects',
      mode: 'shared' as const,
    };
    const privateCategory = state.addCategory(privateList.id, 'Private')!;

    useChecklists.getState().replaceSharedSnapshot({
      list: sharedList,
      tasks: [{
        id: 'task-shared',
        listId: privateList.id,
        title: 'Review shared plan',
        categoryId: privateCategory.id,
        completed: false,
        important: false,
        createdAt: '2026-08-12T00:00:00.000Z',
        updatedAt: '2026-08-12T00:00:00.000Z',
        version: 0,
      }],
      members: [{
        listId: privateList.id,
        userId: 'member-a',
        displayName: 'Alex Rivera',
        role: 'member',
        joinedAt: '2026-08-12T00:00:00.000Z',
      }],
    });

    expect(useChecklists.getState().tasks.find((task) => task.id === 'task-shared'))
      .toMatchObject({ listId: sharedList.id, categoryId: undefined });
    expect(useChecklists.getState().members.find((member) => member.userId === 'member-a'))
      .toMatchObject({ listId: sharedList.id });
    expect(
      useChecklists.getState().categories.find((category) => category.id === privateCategory.id),
    ).toMatchObject({ listId: privateList.id });
  });

  it('renames a checklist and normalizes its name', () => {
    const list = useChecklists.getState().lists[0];

    useChecklists.getState().renameList(list.id, '  Weekend   errands  ');

    expect(useChecklists.getState().lists[0].name).toBe('Weekend errands');
  });

  it('lets only the owner delete a private checklist', () => {
    const owned = useChecklists.getState().createList('Weekend')!;
    useChecklists.getState().addTask(owned.id, 'Pack bags');

    useChecklists.getState().deleteList(owned.id);

    expect(useChecklists.getState().lists.find((list) => list.id === owned.id)).toBeUndefined();
    expect(useChecklists.getState().tasks.some((task) => task.listId === owned.id)).toBe(false);
  });

  it('does not let an editor or member delete a shared checklist from local store', () => {
    for (const role of ['editor', 'member'] as const) {
      const seed = useChecklists.getState().createList(`Trip ${role}`)!;
      useChecklists.getState().replaceSharedSnapshot({
        list: { ...seed, mode: 'shared', role },
        tasks: [],
        members: [],
      });

      useChecklists.getState().deleteList(seed.id);

      expect(useChecklists.getState().lists.some((list) => list.id === seed.id)).toBe(true);
    }
  });

  it('persists a manual task order inside its checklist', () => {
    const list = useChecklists.getState().lists[0];
    const first = useChecklists.getState().addTask(list.id, 'First')!;
    const second = useChecklists.getState().addTask(list.id, 'Second')!;
    const third = useChecklists.getState().addTask(list.id, 'Third')!;

    useChecklists.getState().reorderTasks(list.id, [
      first.id,
      third.id,
      second.id,
    ]);

    expect(
      [...useChecklists.getState().tasks]
        .filter((task) => task.listId === list.id)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((task) => task.title),
    ).toEqual(['First', 'Third', 'Second']);
  });

  it('preserves hidden task slots when reordering a filtered checklist', () => {
    const list = useChecklists.getState().lists[0];
    const first = useChecklists.getState().addTask(list.id, 'First')!;
    const hidden = useChecklists.getState().addTask(list.id, 'Hidden')!;
    const third = useChecklists.getState().addTask(list.id, 'Third')!;
    useChecklists.getState().reorderTasks(list.id, [first.id, hidden.id, third.id]);
    useChecklists.setState((state) => ({
      lists: state.lists.map((item) =>
        item.id === list.id ? { ...item, mode: 'shared' } : item,
      ),
      pendingMutations: [],
    }));

    useChecklists.getState().reorderTasks(list.id, [third.id, first.id]);

    const ordered = [...useChecklists.getState().tasks]
      .filter((task) => task.listId === list.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    expect(ordered.map((task) => task.title)).toEqual(['Third', 'Hidden', 'First']);
    expect(ordered.map((task) => task.position)).toEqual([0, 1, 2]);
    expect(useChecklists.getState().pendingMutations).toHaveLength(1);
    expect(useChecklists.getState().pendingMutations[0]).toMatchObject({
      operation: 'reorder_tasks',
      payload: { orderedIds: [third.id, hidden.id, first.id] },
    });
  });

  it('marks guest checklist data dirty when assignees change', () => {
    useAuthAccess.getState().enterGuest();
    const list = useChecklists.getState().lists[0];
    const task = useChecklists.getState().addTask(list.id, 'Review plans')!;
    useAuthAccess.getState().enterGuest();

    useChecklists.getState().setAssignee(task.id, ['member-a']);

    expect(useAuthAccess.getState().guestDataDirty).toBe(true);
  });

  it('persists an explicit list order without changing list contents', () => {
    const groceries = useChecklists.getState().createList('Groceries')!;
    const maintenance = useChecklists.getState().createList('Maintenance')!;
    const originalIds = useChecklists.getState().lists.map((list) => list.id);
    const stampsById = Object.fromEntries(
      useChecklists.getState().lists.map((list) => [list.id, list.updatedAt]),
    );

    useChecklists.getState().reorderLists([
      groceries.id,
      originalIds.find((id) => id !== groceries.id && id !== maintenance.id)!,
      maintenance.id,
    ]);

    expect(useChecklists.getState().lists.map((list) => list.name)).toEqual([
      'Groceries',
      'To Do',
      'Maintenance',
    ]);
    expect(useChecklists.getState().lists.map((list) => list.updatedAt)).toEqual(
      useChecklists.getState().lists.map((list) => stampsById[list.id]),
    );

    const shared = {
      ...useChecklists.getState().lists[0],
      id: '9a21f566-3bc6-43df-a125-03e4c4541963',
      name: 'Shared errands',
      mode: 'shared' as const,
    };
    useChecklists.getState().replaceSharedSnapshot({ list: shared, tasks: [], members: [] });
    useChecklists.getState().reorderLists([
      maintenance.id,
      shared.id,
      groceries.id,
      originalIds.find((id) => id !== groceries.id && id !== maintenance.id)!,
    ]);
    useChecklists.getState().replaceSharedSnapshot({
      list: { ...shared, updatedAt: '2026-07-28T12:00:00.000Z' },
      tasks: [],
      members: [],
    });

    expect(useChecklists.getState().lists.map((list) => list.name)).toEqual([
      'Maintenance',
      'Shared errands',
      'Groceries',
      'To Do',
    ]);
  });

  it('appends newly shared lists without reshuffling the existing catalog', () => {
    const groceries = useChecklists.getState().createList('Groceries')!;
    expect(useChecklists.getState().lists.map((list) => list.name)).toEqual([
      'Groceries',
      'To Do',
    ]);

    useChecklists.getState().replaceSharedSnapshots([
      {
        list: {
          ...useChecklists.getState().lists[0],
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Shared A',
          mode: 'shared',
          updatedAt: '2099-01-01T12:00:00.000Z',
        },
        tasks: [],
        members: [],
      },
      {
        list: {
          ...useChecklists.getState().lists[0],
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Shared B',
          mode: 'shared',
          updatedAt: '2099-01-01T13:00:00.000Z',
        },
        tasks: [],
        members: [],
      },
    ]);

    expect(useChecklists.getState().lists.map((list) => list.name)).toEqual([
      'Groceries',
      'To Do',
      'Shared A',
      'Shared B',
    ]);
    expect(useChecklists.getState().lists[0]?.id).toBe(groceries.id);
  });
});
