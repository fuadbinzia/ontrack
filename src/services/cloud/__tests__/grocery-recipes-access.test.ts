import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('collaborative grocery recipe contract', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'supabase/migrations/202607290001_grocery_recipes.sql',
    ),
    'utf8',
  );
  const collaboration = [
    readFileSync(join(process.cwd(), 'src/services/todos/collaboration-core.ts'), 'utf8'),
    readFileSync(join(process.cwd(), 'src/services/todos/collaboration-mutations.ts'), 'utf8'),
  ].join('\n');

  it('stores recipe headers and structured ingredient columns behind RLS', () => {
    expect(migration).toContain('create table public.todo_recipes');
    expect(migration).toContain(
      'alter table public.todo_recipes enable row level security',
    );
    for (const column of [
      'recipe_id',
      'ingredient_name',
      'canonical_key',
      'quantity_value',
      'quantity_text',
      'preparation',
      'original_text',
      'confidence',
    ]) {
      expect(migration).toContain(column);
    }
  });

  it('publishes and snapshots recipe groups atomically', () => {
    expect(migration).toContain("operation = 'add_recipe'");
    expect(migration).toContain("operation = 'set_tasks_completion'");
    expect(migration).toContain("'recipes', coalesce((");
    expect(collaboration).toContain(
      'recipes: normalized.recipes.filter((recipe) => recipe.listId === list.id)',
    );
    expect(collaboration).toContain('resolveSharedRecipeMedia');
  });

  it('keeps shared thumbnails private and list scoped', () => {
    expect(migration).toContain(
      "values ('todo-recipe-images', 'todo-recipe-images', false)",
    );
    expect(migration).toContain('public.is_todo_member');
    expect(migration).toContain('public.is_todo_owner');
    expect(migration).toContain('todo owners delete recipe images');
  });
});

