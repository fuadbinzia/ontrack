import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import {
    canCompleteTodo,
    canDeleteTodoList,
    canEditTodoContent,
    canLeaveTodoList,
    normalizeTodoState,
    privateTodoPayload,
    useTodos,
} from '@/store/todos';
import { useAuthAccess } from '@/store/auth-access';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('to-do store', () => {
  beforeEach(() => {
    useTodos.getState().reset();
    useAuthAccess.getState().resetAccess();
  });

  it('captures, edits, prioritizes, and completes a task', () => {
    const task = useTodos.getState().addTask('  Make a thoughtful plan  ');
    expect(task?.title).toBe('Make a thoughtful plan');

    useTodos.getState().toggleImportant(task!.id);
    useTodos.getState().updateTask(task!.id, 'Make a simple plan');
    useTodos.getState().toggleTask(task!.id);

    expect(useTodos.getState().tasks[0]).toMatchObject({
      title: 'Make a simple plan',
      important: true,
      completed: true,
    });
    expect(useTodos.getState().tasks[0].completedAt).toBeDefined();
  });

  it('ignores empty tasks and clears only completed work', () => {
    expect(useTodos.getState().addTask('   ')).toBeUndefined();
    const done = useTodos.getState().addTask('Done');
    useTodos.getState().addTask('Still open');
    useTodos.getState().toggleTask(done!.id);
    useTodos.getState().clearCompleted();

    expect(useTodos.getState().tasks.map((task) => task.title)).toEqual(['Still open']);
  });

  it('keeps tasks isolated inside multiple named lists', () => {
    const groceries = useTodos.getState().createList('  Groceries  ');
    const maintenance = useTodos.getState().createList('Maintenance');
    useTodos.getState().addTask(groceries!.id, 'Milk');
    useTodos.getState().addTask(maintenance!.id, 'Replace air filter');

    expect(
      useTodos.getState().tasks
        .filter((task) => task.listId === groceries!.id)
        .map((task) => task.title),
    ).toEqual(['Milk']);
    expect(
      useTodos.getState().tasks
        .filter((task) => task.listId === maintenance!.id)
        .map((task) => task.title),
    ).toEqual(['Replace air filter']);
  });

  it('creates categories, assigns items, and uncategorizes on removal', () => {
    const list = useTodos.getState().createList('Projects');
    const category = useTodos.getState().addCategory(list!.id, 'Finance');
    const task = useTodos.getState().addTask(list!.id, 'Review budget', category!.id);

    expect(task?.categoryId).toBe(category?.id);
    expect(useTodos.getState().categories).toEqual([category]);

    useTodos.getState().deleteCategory(category!.id);

    expect(useTodos.getState().categories).toEqual([]);
    expect(useTodos.getState().tasks.find((item) => item.id === task?.id)?.categoryId)
      .toBeUndefined();
  });

  it('normalizes category assignments only within known categories', () => {
    const normalized = normalizeTodoState({
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
    const normalized = normalizeTodoState({
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
    const list = useTodos.getState().lists[0];
    useTodos.setState((state) => ({
      lists: state.lists.map((item) =>
        item.id === list.id ? { ...item, mode: 'shared', role: 'owner' } : item,
      ),
    }));
    const category = useTodos.getState().addCategory(list.id, 'Finance')!;
    useTodos.getState().addTask(list.id, 'Review budget', category.id);

    expect(useTodos.getState().pendingMutations.map((mutation) => mutation.operation))
      .toEqual(['add_category', 'add_task', 'set_task_category']);
  });

  it('preserves shared categories when a legacy snapshot omits the field', () => {
    const initial = useTodos.getState();
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
    useTodos.getState().replaceSharedSnapshot({
      list,
      categories: [category],
      tasks: [task],
      members: [],
    });

    useTodos.getState().replaceSharedSnapshot({
      list: { ...list, updatedAt: '2026-08-12T12:00:00.000Z' },
      tasks: [{ ...task, title: 'Review updated budget' }],
      members: [],
    });

    expect(useTodos.getState().categories).toEqual([category]);
  });

  it('keeps shared snapshot tasks and members inside their checklist', () => {
    const state = useTodos.getState();
    const privateList = state.lists[0];
    const sharedList = {
      ...privateList,
      id: '9a21f566-3bc6-43df-a125-03e4c4541963',
      name: 'Shared projects',
      mode: 'shared' as const,
    };
    const privateCategory = state.addCategory(privateList.id, 'Private')!;

    useTodos.getState().replaceSharedSnapshot({
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

    expect(useTodos.getState().tasks.find((task) => task.id === 'task-shared'))
      .toMatchObject({ listId: sharedList.id, categoryId: undefined });
    expect(useTodos.getState().members.find((member) => member.userId === 'member-a'))
      .toMatchObject({ listId: sharedList.id });
    expect(
      useTodos.getState().categories.find((category) => category.id === privateCategory.id),
    ).toMatchObject({ listId: privateList.id });
  });

  it('renames a checklist and normalizes its name', () => {
    const list = useTodos.getState().lists[0];

    useTodos.getState().renameList(list.id, '  Weekend   errands  ');

    expect(useTodos.getState().lists[0].name).toBe('Weekend errands');
  });

  it('lets only the owner delete a private checklist', () => {
    const owned = useTodos.getState().createList('Weekend')!;
    useTodos.getState().addTask(owned.id, 'Pack bags');

    useTodos.getState().deleteList(owned.id);

    expect(useTodos.getState().lists.find((list) => list.id === owned.id)).toBeUndefined();
    expect(useTodos.getState().tasks.some((task) => task.listId === owned.id)).toBe(false);
  });

  it('does not let an editor or member delete a shared checklist from local store', () => {
    for (const role of ['editor', 'member'] as const) {
      const seed = useTodos.getState().createList(`Trip ${role}`)!;
      useTodos.getState().replaceSharedSnapshot({
        list: { ...seed, mode: 'shared', role },
        tasks: [],
        members: [],
      });

      useTodos.getState().deleteList(seed.id);

      expect(useTodos.getState().lists.some((list) => list.id === seed.id)).toBe(true);
    }
  });

  it('persists a manual task order inside its checklist', () => {
    const list = useTodos.getState().lists[0];
    const first = useTodos.getState().addTask(list.id, 'First')!;
    const second = useTodos.getState().addTask(list.id, 'Second')!;
    const third = useTodos.getState().addTask(list.id, 'Third')!;

    useTodos.getState().reorderTasks(list.id, [
      first.id,
      third.id,
      second.id,
    ]);

    expect(
      [...useTodos.getState().tasks]
        .filter((task) => task.listId === list.id)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((task) => task.title),
    ).toEqual(['First', 'Third', 'Second']);
  });

  it('preserves hidden task slots when reordering a filtered checklist', () => {
    const list = useTodos.getState().lists[0];
    const first = useTodos.getState().addTask(list.id, 'First')!;
    const hidden = useTodos.getState().addTask(list.id, 'Hidden')!;
    const third = useTodos.getState().addTask(list.id, 'Third')!;
    useTodos.getState().reorderTasks(list.id, [first.id, hidden.id, third.id]);
    useTodos.setState((state) => ({
      lists: state.lists.map((item) =>
        item.id === list.id ? { ...item, mode: 'shared' } : item,
      ),
      pendingMutations: [],
    }));

    useTodos.getState().reorderTasks(list.id, [third.id, first.id]);

    const ordered = [...useTodos.getState().tasks]
      .filter((task) => task.listId === list.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    expect(ordered.map((task) => task.title)).toEqual(['Third', 'Hidden', 'First']);
    expect(ordered.map((task) => task.position)).toEqual([0, 1, 2]);
    expect(useTodos.getState().pendingMutations).toHaveLength(1);
    expect(useTodos.getState().pendingMutations[0]).toMatchObject({
      operation: 'reorder_tasks',
      payload: { orderedIds: [third.id, hidden.id, first.id] },
    });
  });

  it('marks guest checklist data dirty when assignees change', () => {
    useAuthAccess.getState().enterGuest();
    const list = useTodos.getState().lists[0];
    const task = useTodos.getState().addTask(list.id, 'Review plans')!;
    useAuthAccess.getState().enterGuest();

    useTodos.getState().setAssignee(task.id, ['member-a']);

    expect(useAuthAccess.getState().guestDataDirty).toBe(true);
  });

  it('persists an explicit list order without changing list contents', () => {
    const groceries = useTodos.getState().createList('Groceries')!;
    const maintenance = useTodos.getState().createList('Maintenance')!;
    const originalIds = useTodos.getState().lists.map((list) => list.id);

    useTodos.getState().reorderLists([
      groceries.id,
      originalIds.find((id) => id !== groceries.id && id !== maintenance.id)!,
      maintenance.id,
    ]);

    expect(useTodos.getState().lists.map((list) => list.name)).toEqual([
      'Groceries',
      'To Do',
      'Maintenance',
    ]);
    expect(
      [...useTodos.getState().lists]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((list) => list.name),
    ).toEqual(['Groceries', 'To Do', 'Maintenance']);

    const shared = {
      ...useTodos.getState().lists[0],
      id: '9a21f566-3bc6-43df-a125-03e4c4541963',
      name: 'Shared errands',
      mode: 'shared' as const,
    };
    useTodos.getState().replaceSharedSnapshot({ list: shared, tasks: [], members: [] });
    useTodos.getState().reorderLists([
      maintenance.id,
      shared.id,
      groceries.id,
      originalIds.find((id) => id !== groceries.id && id !== maintenance.id)!,
    ]);
    useTodos.getState().replaceSharedSnapshot({
      list: { ...shared, updatedAt: '2026-07-28T12:00:00.000Z' },
      tasks: [],
      members: [],
    });

    expect(useTodos.getState().lists.map((list) => list.name)).toEqual([
      'Maintenance',
      'Shared errands',
      'Groceries',
      'To Do',
    ]);
  });

  it('migrates the legacy flat checklist into a default list with new task ids', () => {
    const migrated = normalizeTodoState({
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
      ...useTodos.getState().lists[0],
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
    useTodos.getState().replaceSharedSnapshot({
      list: shared,
      tasks: [
        { ...base, id: 'task-a', title: 'A', position: 0 },
        { ...base, id: 'task-b', title: 'B', position: 1 },
      ],
      members: [],
    });
    // Local optimistic order differs from a later server reorder.
    useTodos.setState((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === 'task-a'
          ? { ...task, position: 1 }
          : task.id === 'task-b'
            ? { ...task, position: 0 }
            : task,
      ),
    }));
    useTodos.getState().replaceSharedSnapshot({
      list: { ...shared, updatedAt: '2026-07-28T12:00:00.000Z' },
      tasks: [
        { ...base, id: 'task-a', title: 'A', position: 0 },
        { ...base, id: 'task-b', title: 'B', position: 1 },
      ],
      members: [],
    });
    const ordered = useTodos
      .getState()
      .tasks.filter((task) => task.listId === shared.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    expect(ordered.map((task) => task.id)).toEqual(['task-a', 'task-b']);
  });

  it('excludes shared caches and mutations from the private account payload', () => {
    const state = useTodos.getState();
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
    useTodos.getState().replaceSharedSnapshot({
      list: sharedList,
      tasks: [sharedTask],
      members: [],
    });

    const payload = privateTodoPayload(useTodos.getState());
    expect(payload.lists.map((list) => list.name)).not.toContain('Shared');
    expect(payload.tasks.map((task) => task.title)).not.toContain('Shared task');
  });

  it('allows members to complete only assigned or anyone items', () => {
    const state = normalizeTodoState(undefined);
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

    expect(canCompleteTodo(list, baseTask, 'member-a')).toBe(true);
    expect(
      canCompleteTodo(list, { ...baseTask, assigneeUserIds: ['member-a'] }, 'member-a'),
    ).toBe(true);
    expect(
      canCompleteTodo(
        list,
        { ...baseTask, assigneeUserIds: ['member-a', 'member-c'] },
        'member-a',
      ),
    ).toBe(true);
    expect(
      canCompleteTodo(list, { ...baseTask, assigneeUserIds: ['member-b'] }, 'member-a'),
    ).toBe(false);
  });

  it('lets editors complete any item and edit content', () => {
    const state = normalizeTodoState(undefined);
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

    expect(canEditTodoContent(editorList)).toBe(true);
    expect(canEditTodoContent(memberList)).toBe(false);
    expect(canCompleteTodo(editorList, baseTask, 'editor-a')).toBe(true);
    expect(canCompleteTodo(memberList, baseTask, 'member-a')).toBe(false);
    expect(canDeleteTodoList(editorList)).toBe(false);
    expect(canDeleteTodoList(memberList)).toBe(false);
    expect(canDeleteTodoList({ ...editorList, kind: 'grocery', role: 'editor' })).toBe(false);
    expect(canDeleteTodoList({ ...editorList, role: 'owner' })).toBe(true);
    expect(canLeaveTodoList(editorList)).toBe(true);
    expect(canLeaveTodoList(memberList)).toBe(true);
    expect(canLeaveTodoList({ ...editorList, role: 'owner' })).toBe(false);
    expect(canLeaveTodoList({ ...editorList, mode: 'private', role: 'editor' })).toBe(false);
  });

  it('migrates recognized grocery names but preserves explicit checklist kinds', () => {
    const migrated = normalizeTodoState({
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
    expect(normalizeTodoState(legacy).lists[0].kind).toBe('grocery');
    expect(
      normalizeTodoState({
        ...legacy,
        groceryMigrationVersion: 1,
      }).lists[0].kind,
    ).toBe('checklist');
  });

  it('adds a recipe and prevents converting back while its group exists', () => {
    const list = useTodos.getState().createList('Meal shop', 'grocery')!;
    const recipe = useTodos.getState().addRecipe(list.id, {
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
      useTodos.getState().tasks.filter((task) => task.recipeId === recipe?.id),
    ).toHaveLength(2);
    expect(useTodos.getState().setListKind(list.id, 'checklist')).toBe(false);

    useTodos.getState().deleteRecipe(recipe!.id);
    expect(useTodos.getState().setListKind(list.id, 'checklist')).toBe(true);
  });

  it('batch completion updates every permitted occurrence only', () => {
    const list = useTodos.getState().createList('Shop', 'grocery')!;
    const recipe = useTodos.getState().addRecipe(list.id, {
      name: 'Dinner',
      sourceKind: 'url',
      ingredients: [{ name: 'Onion' }, { name: 'Garlic' }],
    })!;
    const tasks = useTodos
      .getState()
      .tasks.filter((task) => task.recipeId === recipe.id);
    useTodos.setState((state) => ({
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

    useTodos
      .getState()
      .setTasksCompletion(tasks.map((task) => task.id), true, 'member-a');

    expect(
      useTodos.getState().tasks.find((task) => task.id === tasks[0].id)?.completed,
    ).toBe(true);
    expect(
      useTodos.getState().tasks.find((task) => task.id === tasks[1].id)?.completed,
    ).toBe(false);
  });
});
