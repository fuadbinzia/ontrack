import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { spacing } from '@/design-system';
import { checklistHubWindowing } from '@/features/todos/todo-list-hub-windowing';
import {
  checklistDismissFooterStyle,
  checklistScrollContentStyle,
} from '@/features/todos/todo-list-scroll-style';

describe('todo list first-open layout', () => {
  it('does not flex-grow a populated list so the first row parks near the bottom', () => {
    expect(checklistScrollContentStyle(true)).toEqual({ flexGrow: 0 });
  });

  it('still grows an empty list to fill the screen under the header', () => {
    expect(checklistScrollContentStyle(false)).toEqual({ flexGrow: 1 });
  });

  it('keeps a dismiss footer without stretching rows away from the top', () => {
    expect(checklistDismissFooterStyle()).toEqual({
      minHeight: spacing.xxl * 3,
    });
    expect(checklistDismissFooterStyle()).not.toHaveProperty('flexGrow');
  });

  it('uses the first-open scroll style instead of always flex-growing the list', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/todos/todo-list-screen.tsx'),
      'utf8',
    );
    expect(source).toContain(
      'checklistScrollContentStyle(visibleTasks.length > 0)',
    );
    expect(source).toContain('checklistDismissFooterStyle()');
    expect(source).not.toContain('listEmptyContent');
    expect(source).not.toContain('styles.listDismissFooter');
  });

  it('paints every hub card on first layout instead of windowing the rest in', () => {
    expect(checklistHubWindowing(14)).toEqual({
      initialNumToRender: 14,
      maxToRenderPerBatch: 14,
      windowSize: 15,
      updateCellsBatchingPeriod: 0,
      removeClippedSubviews: false,
    });
    expect(checklistHubWindowing(0).initialNumToRender).toBe(1);
  });

  it('loads the full catalog before the hub paints and does not stream-sort rows', () => {
    const overview = readFileSync(
      join(process.cwd(), 'src/features/todos/todo-lists-overview.tsx'),
      'utf8',
    );
    const reload = readFileSync(
      join(process.cwd(), 'src/services/todos/collaboration-reload.ts'),
      'utf8',
    );
    const account = readFileSync(
      join(process.cwd(), 'src/services/cloud/sync-account.ts'),
      'utf8',
    );
    expect(overview).toContain('checklistHubWindowing(lists.length)');
    expect(overview).toContain(
      'const lists = useChecklists((state) => state.lists, listReferenceEquality);',
    );
    expect(overview).toContain('<FlatList');
    expect(overview).toContain('<DraggableFlatList');
    expect(overview).toContain('activationDistance={8}');
    expect(overview).not.toContain('10_000');
    expect(overview).not.toContain('sortChecklistsByRecent');
    expect(overview).not.toContain('key={editMode}');
    expect(reload).toContain('replaceSharedSnapshots');
    expect(reload).toContain('sharedCatalogLoad');
    expect(reload).not.toContain('loadChecklistSnapshot');
    expect(account).toContain('loadAllSharedChecklists');
    const normalize = readFileSync(
      join(process.cwd(), 'src/store/todos-normalize.ts'),
      'utf8',
    );
    const sync = readFileSync(
      join(process.cwd(), 'src/store/todos-sync-actions.ts'),
      'utf8',
    );
    expect(normalize).toContain('lists: [...dedupedLists.values()]');
    expect(normalize).not.toMatch(/lists:\s*sortChecklistsByRecent/);
    expect(sync).not.toContain('sortChecklistsByRecent');
  });
});
