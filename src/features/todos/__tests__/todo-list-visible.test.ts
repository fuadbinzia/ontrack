import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { rememberVisibleChecklist } from '../todo-list-visible';

const list = { id: 'list-1', name: 'Weekend' };

describe('rememberVisibleChecklist', () => {
  it('keeps the last painted list when a viewed checklist is deleted', () => {
    const seen = rememberVisibleChecklist(list, undefined);
    const afterDelete = rememberVisibleChecklist(undefined, seen.held);

    expect(afterDelete.value).toEqual(list);
    expect(afterDelete.vanished).toBe(true);
  });

  it('does not pretend a stale deep link was just deleted', () => {
    const missing = rememberVisibleChecklist(undefined, undefined);

    expect(missing.value).toBeUndefined();
    expect(missing.vanished).toBe(false);
  });

  it('updates the held snapshot when the store list is still present', () => {
    const next = { id: 'list-1', name: 'Renamed' };
    const remembered = rememberVisibleChecklist(next, list);

    expect(remembered.value).toEqual(next);
    expect(remembered.held).toEqual(next);
    expect(remembered.vanished).toBe(false);
  });

  it('holds grocery kind so delete does not remount as the checklist unavailable screen', () => {
    const seen = rememberVisibleChecklist('grocery' as const, undefined);
    const afterDelete = rememberVisibleChecklist(undefined, seen.held);

    expect(afterDelete.value).toBe('grocery');
    expect(afterDelete.vanished).toBe(true);
  });
});

describe('todo list delete navigation', () => {
  it('holds the open list and goes to the hub instead of flashing unavailable', () => {
    const checklist = readFileSync(
      join(process.cwd(), 'src/features/todos/todo-list-screen.tsx'),
      'utf8',
    );
    const grocery = readFileSync(
      join(process.cwd(), 'src/features/todos/grocery-list-screen.tsx'),
      'utf8',
    );
    const route = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/to-do/[id].tsx'),
      'utf8',
    );

    expect(checklist).toContain('useVisibleChecklist(listId)');
    expect(grocery).toContain('useVisibleChecklist(listId)');
    expect(route).toContain('useHeldVisible(kind)');
    expect(checklist).toContain('openChecklists()');
    expect(grocery).toContain('onPress={openChecklists}');
  });
});
