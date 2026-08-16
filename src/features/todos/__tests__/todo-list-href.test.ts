import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { TODO_LISTS_HREF, todoListDetailHref } from '@/features/todos/todo-list-href';

describe('todoListDetailHref', () => {
  it('uses the goto path so Expo does not treat the open as a same-tab jump', () => {
    expect(todoListDetailHref('list-agent-ui-demo-checklist')).toBe(
      '/to-do/list-agent-ui-demo-checklist',
    );
    expect(TODO_LISTS_HREF).toBe('/to-do');
  });

  it('sends Checklists back to the hub instead of tab history', () => {
    const header = readFileSync(
      join(process.cwd(), 'src/features/todos/todo-list-header.tsx'),
      'utf8',
    );
    const grocery = readFileSync(
      join(process.cwd(), 'src/features/todos/grocery-list-header.tsx'),
      'utf8',
    );
    expect(header).toContain('onPress={openTodoLists}');
    expect(header).not.toContain('router.canGoBack()');
    expect(grocery).toContain('openTodoLists()');
    expect(grocery).not.toContain('router.canGoBack()');
  });
});
