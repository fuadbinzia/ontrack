import {
  createInstalledTodoCollaboratorJoinUrl,
  createTodoCollaboratorJoinUrl,
  formatTodoListText,
} from '@/features/todos/share';
import type {
  TodoList,
  TodoMember,
  TodoRecipe,
  TodoTask,
} from '@/store/todos';

const list: TodoList = {
  id: 'list',
  name: 'Groceries',
  kind: 'grocery',
  mode: 'shared',
  role: 'owner',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
};

const members: TodoMember[] = [
  {
    listId: list.id,
    userId: 'owner',
    displayName: 'Rocky',
    role: 'owner',
    joinedAt: list.createdAt,
  },
  {
    listId: list.id,
    userId: 'alex',
    displayName: 'Alex',
    role: 'member',
    joinedAt: list.createdAt,
  },
];

function task(patch: Partial<TodoTask>): TodoTask {
  return {
    id: patch.id ?? 'task',
    listId: list.id,
    title: patch.title ?? 'Milk',
    completed: patch.completed ?? false,
    important: patch.important ?? false,
    recipeId: patch.recipeId,
    ingredientName: patch.ingredientName,
    canonicalKey: patch.canonicalKey,
    quantityValue: patch.quantityValue,
    quantityText: patch.quantityText,
    unit: patch.unit,
    preparation: patch.preparation,
    originalText: patch.originalText,
    assigneeUserIds: patch.assigneeUserIds,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    version: 0,
  };
}

describe('pretty to-do list text', () => {
  it('formats open items, focus, and collaborative assignments', () => {
    expect(
      formatTodoListText(
        list,
        [
          task({ id: 'milk', title: 'Milk' }),
          task({ id: 'battery', title: 'Batteries', important: true, assigneeUserIds: ['alex'] }),
          task({ id: 'done', title: 'Already bought', completed: true }),
        ],
        members,
      ),
    ).toBe(
      [
        '📝 Groceries',
        '',
        '☐ Milk — Anyone',
        '★ ☐ Batteries — Alex',
        '',
        '2 open items · onTrack',
      ].join('\n'),
    );
  });

  it('omits assignments for private lists and celebrates an empty list', () => {
    expect(formatTodoListText({ name: 'Maintenance' }, [], [])).toBe(
      ['📝 Maintenance', '', '✓ All done!', '', 'All done · onTrack'].join('\n'),
    );
  });

  it('preserves meal headings and ingredient context', () => {
    const recipe: TodoRecipe = {
      id: 'recipe',
      listId: list.id,
      name: 'Tomato soup',
      sourceKind: 'url',
      sourceUrl: 'https://example.com/soup',
      targetServings: 4,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    };
    const text = formatTodoListText(
      list,
      [
        task({
          id: 'tomatoes',
          recipeId: recipe.id,
          ingredientName: 'Tomatoes',
          title: '4 count Tomatoes',
        }),
        task({ id: 'soap', title: 'Dish soap' }),
      ],
      [],
      [recipe],
    );

    expect(text).toContain('🍽 Tomato soup · 4 servings');
    expect(text).toContain('  ☐ 4 count Tomatoes');
    expect(text).toContain('Other items\n☐ Dish soap');
  });

  it('creates web fallback and installed-app collaborator links', () => {
    expect(createTodoCollaboratorJoinUrl('abc123')).toBe(
      'https://ontrack--links.expo.app/c/abc123',
    );
    expect(createInstalledTodoCollaboratorJoinUrl('abc123')).toBe(
      'ontrack:///c/abc123',
    );
  });
});
