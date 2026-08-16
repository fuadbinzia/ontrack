import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { useAuthAccess } from '@/store/auth-access';
import { normalizeTodoState, useTodos } from '@/store/todos';
import { useTravel } from '@/store/travel';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('to-do store recency and trip-linked sync', () => {
  beforeEach(() => {
    useTodos.getState().reset();
    useAuthAccess.getState().resetAccess();
  });

  it('records a local open without treating it as a list edit', () => {
    const buried = useTodos.getState().createList('Features')!;
    useTodos.getState().createList('Iceland Checklist');
    const updatedAt = useTodos
      .getState()
      .lists.find((list) => list.id === buried.id)!.updatedAt;

    useTodos.getState().touchList(buried.id, '2026-08-15T20:00:00.000Z');

    const state = useTodos.getState();
    expect(state.lists.find((list) => list.id === buried.id)?.updatedAt).toBe(
      updatedAt,
    );
    expect(state.listOpenedAt[buried.id]).toBe('2026-08-15T20:00:00.000Z');
    expect(state.pendingMutations).toEqual([]);
  });

  it('ignores an open for a list that is not on the device', () => {
    useTodos.getState().touchList('missing-list', '2026-08-15T20:00:00.000Z');
    expect(useTodos.getState().listOpenedAt).toEqual({});
  });

  it('ignores a second open of the same list within 750ms', () => {
    const list = useTodos.getState().createList('Ideas')!;
    useTodos.getState().touchList(list.id, '2026-08-15T20:00:00.000Z');
    useTodos.getState().touchList(list.id, '2026-08-15T20:00:00.400Z');

    expect(useTodos.getState().listOpenedAt[list.id]).toBe(
      '2026-08-15T20:00:00.000Z',
    );
  });

  it('drops opened recency when a private list is deleted', () => {
    const list = useTodos.getState().createList('Temp')!;
    useTodos.getState().touchList(list.id, '2026-08-15T20:00:00.000Z');
    useTodos.getState().deleteList(list.id);

    expect(useTodos.getState().listOpenedAt[list.id]).toBeUndefined();
  });

  it('drops opened recency for lists that no longer exist', () => {
    const migrated = normalizeTodoState({
      groceryMigrationVersion: 1,
      lists: [{
        id: 'list-1',
        name: 'Keep',
        kind: 'checklist',
        mode: 'private',
        role: 'owner',
        createdAt: '2026-08-12T00:00:00.000Z',
        updatedAt: '2026-08-12T00:00:00.000Z',
      }],
      listOpenedAt: {
        'list-1': '2026-08-14T09:00:00.000Z',
        gone: '2026-08-15T09:00:00.000Z',
      },
    });

    expect(migrated.listOpenedAt).toEqual({
      'list-1': '2026-08-14T09:00:00.000Z',
    });
  });

  it('keeps a trip-linked checklist when a cloud pull omits it', () => {
    useTravel.getState().reset();
    const packing = useTodos.getState().createList('Iceland Checklist')!;
    expect(
      useTravel.getState().savePlan({
        id: 'trip-iceland',
        title: 'Iceland',
        destination: 'Reykjavik',
        startDate: '2026-09-08',
        endDate: '2026-09-14',
        itinerary: [],
        participants: [],
        baseCurrency: 'USD',
        expenses: [],
        packingListId: packing.id,
        createdAt: '2026-08-12T00:00:00.000Z',
        updatedAt: '2026-08-12T00:00:00.000Z',
      }),
    ).toBe(true);

    useTodos.getState().replacePrivateData({
      lists: [],
      tasks: [],
      categories: [],
      recipes: [],
    });

    expect(
      useTodos.getState().lists.some((item) => item.id === packing.id),
    ).toBe(true);
  });

  it('still drops an unlinked private list omitted from a cloud pull', () => {
    const extra = useTodos.getState().createList('Scratch')!;
    useTodos.getState().replacePrivateData({
      lists: [],
      tasks: [],
      categories: [],
      recipes: [],
    });
    expect(
      useTodos.getState().lists.some((item) => item.id === extra.id),
    ).toBe(false);
  });

  it('does not import the travel store at module load', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/store/todos-sync-actions.ts'),
      'utf8',
    );
    expect(source).not.toMatch(
      /import\s+\{[^}]*useTravel[^}]*\}\s+from\s+'@\/store\/travel'/,
    );
    expect(source).toContain("require('@/store/travel')");
  });
});
