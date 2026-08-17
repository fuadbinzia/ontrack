import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { STORAGE_KEYS } from '@/services/storage';
import { useAuthAccess } from '@/store/auth-access';
import {
    normalizeChecklistState,
    privateChecklistPayload,
    useChecklists,
} from '@/store/todos';
import { useTravel } from '@/store/travel';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('to-do store recency and trip-linked sync', () => {
  beforeEach(() => {
    useChecklists.getState().reset();
    useAuthAccess.getState().resetAccess();
  });

  it('records a local open without treating it as a list edit', () => {
    const buried = useChecklists.getState().createList('Features')!;
    useChecklists.getState().createList('Iceland Checklist');
    const updatedAt = useChecklists
      .getState()
      .lists.find((list) => list.id === buried.id)!.updatedAt;

    useChecklists.getState().touchList(buried.id, '2026-08-15T20:00:00.000Z');

    const state = useChecklists.getState();
    expect(state.lists.find((list) => list.id === buried.id)?.updatedAt).toBe(
      updatedAt,
    );
    expect(state.listOpenedAt[buried.id]).toBe('2026-08-15T20:00:00.000Z');
    expect(state.pendingMutations).toEqual([]);
    expect(state.lists[0]?.id).toBe(buried.id);
  });

  it('keeps the last-opened list on top after closing and reopening the app', async () => {
    const buried = useChecklists.getState().createList('Features')!;
    useChecklists.getState().createList('Iceland Checklist');
    useChecklists.getState().touchList(buried.id, '2026-08-15T20:00:00.000Z');
    expect(useChecklists.getState().lists[0]?.id).toBe(buried.id);

    // Wait for the promoted order to reach disk (the persist backend resolves
    // asynchronously), then run the exact cold-start path — persist merge and
    // migrate both feed the stored blob through normalizeChecklistState.
    let persisted: unknown;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const raw = await mockAsyncStorage.getItem(STORAGE_KEYS.checklists);
      persisted = raw ? (JSON.parse(raw) as { state: unknown }).state : undefined;
      const lists = (persisted as { lists?: { id: string }[] } | undefined)?.lists;
      if (lists?.[0]?.id === buried.id) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const rehydrated = normalizeChecklistState(persisted);
    expect(rehydrated.lists[0]?.id).toBe(buried.id);
    expect(rehydrated.lists.map((list) => list.id)).toContain(buried.id);
    expect(rehydrated.listOpenedAt[buried.id]).toBe('2026-08-15T20:00:00.000Z');
  });

  it('keeps a promoted shared list on top when its snapshot refreshes on reopen', () => {
    const shared = {
      ...useChecklists.getState().lists[0],
      id: '9a21f566-3bc6-43df-a125-03e4c4541963',
      name: 'Family Errands',
      mode: 'shared' as const,
    };
    useChecklists.getState().replaceSharedSnapshots([
      { list: shared, tasks: [], members: [] },
    ]);
    expect(useChecklists.getState().lists.at(-1)?.id).toBe(shared.id);

    useChecklists.getState().touchList(shared.id, '2026-08-15T20:00:00.000Z');
    expect(useChecklists.getState().lists[0]?.id).toBe(shared.id);

    useChecklists.getState().replaceSharedSnapshots([
      {
        list: { ...shared, updatedAt: '2026-08-16T09:00:00.000Z' },
        tasks: [],
        members: [],
      },
    ]);

    expect(useChecklists.getState().lists[0]?.id).toBe(shared.id);
  });

  it('keeps the same lists array when the front list is re-opened', () => {
    const front = useChecklists.getState().createList('Front')!;
    const before = useChecklists.getState().lists;

    expect(
      useChecklists.getState().touchList(front.id, '2026-08-15T20:00:00.000Z'),
    ).toBe(true);

    expect(useChecklists.getState().lists).toBe(before);
    expect(useChecklists.getState().listOpenedAt[front.id]).toBe(
      '2026-08-15T20:00:00.000Z',
    );
  });

  it('ignores an open for a list that is not on the device', () => {
    expect(
      useChecklists.getState().touchList('missing-list', '2026-08-15T20:00:00.000Z'),
    ).toBe(false);
    expect(useChecklists.getState().listOpenedAt).toEqual({});
  });

  it('ignores a second open of the same list within 750ms', () => {
    const list = useChecklists.getState().createList('Ideas')!;
    expect(
      useChecklists.getState().touchList(list.id, '2026-08-15T20:00:00.000Z'),
    ).toBe(true);
    expect(
      useChecklists.getState().touchList(list.id, '2026-08-15T20:00:00.400Z'),
    ).toBe(false);

    expect(useChecklists.getState().listOpenedAt[list.id]).toBe(
      '2026-08-15T20:00:00.000Z',
    );
  });

  it('drops opened recency when a private list is deleted', () => {
    const list = useChecklists.getState().createList('Temp')!;
    useChecklists.getState().touchList(list.id, '2026-08-15T20:00:00.000Z');
    useChecklists.getState().deleteList(list.id);

    expect(useChecklists.getState().listOpenedAt[list.id]).toBeUndefined();
  });

  it('drops opened recency for lists that no longer exist', () => {
    const migrated = normalizeChecklistState({
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

  it('hydrates checklists in persist order instead of resorting by last opened', () => {
    const migrated = normalizeChecklistState({
      groceryMigrationVersion: 1,
      lists: [
        {
          id: 'ideas',
          name: 'Ideas',
          kind: 'checklist',
          mode: 'private',
          role: 'owner',
          createdAt: '2026-08-11T00:00:00.000Z',
          updatedAt: '2026-08-14T12:00:00.000Z',
        },
        {
          id: 'features',
          name: 'Features',
          kind: 'checklist',
          mode: 'private',
          role: 'owner',
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-10T00:00:00.000Z',
        },
      ],
      listOpenedAt: {
        features: '2026-08-15T09:00:00.000Z',
      },
    });

    expect(migrated.lists.map((list) => list.name)).toEqual([
      'Ideas',
      'Features',
    ]);
    expect(migrated.listOpenedAt).toEqual({
      features: '2026-08-15T09:00:00.000Z',
    });
  });

  it('keeps persist order across a cloud pull instead of resorting by recency', () => {
    const older = useChecklists.getState().createList('Older')!;
    useChecklists.getState().createList('Newer');
    useChecklists.getState().touchList(older.id, '2099-01-01T00:00:00.000Z');
    const persistOrder = useChecklists.getState().lists.map((list) => list.id);

    useChecklists.getState().replacePrivateData({
      lists: [...useChecklists.getState().lists].reverse(),
      tasks: useChecklists.getState().tasks,
      categories: [],
      recipes: [],
    });

    expect(useChecklists.getState().lists.map((list) => list.id)).toEqual(persistOrder);
    expect(useChecklists.getState().lists[0]?.id).toBe(older.id);
  });

  it('keeps the same list objects when a cloud pull does not change them', () => {
    const older = useChecklists.getState().createList('Older')!;
    const before = useChecklists.getState().lists;

    useChecklists.getState().replacePrivateData({
      lists: useChecklists.getState().lists.map((list) => ({ ...list })),
      tasks: useChecklists.getState().tasks,
      categories: [],
      recipes: [],
    });

    expect(useChecklists.getState().lists).toBe(before);
    expect(useChecklists.getState().lists[0]).toBe(
      before.find((list) => list.id === older.id),
    );
  });

  it('appends unknown private lists from a cloud pull after the existing catalog', () => {
    const local = useChecklists.getState().createList('Local')!;
    const fromCloud = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'From Cloud',
      kind: 'checklist' as const,
      mode: 'private' as const,
      role: 'owner' as const,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2099-01-01T00:00:00.000Z',
    };

    useChecklists.getState().replacePrivateData({
      lists: [fromCloud, ...useChecklists.getState().lists],
      tasks: [],
      categories: [],
      recipes: [],
    });

    expect(useChecklists.getState().lists.map((list) => list.name)).toEqual([
      'Local',
      'To Do',
      'From Cloud',
    ]);
    expect(useChecklists.getState().lists[0]?.id).toBe(local.id);
  });

  it('restores the promoted order after a sign-out wipe and sign-in cloud restore', () => {
    const buried = useChecklists.getState().createList('Features')!;
    useChecklists.getState().createList('Iceland Checklist');
    useChecklists.getState().touchList(buried.id, '2026-08-15T20:00:00.000Z');
    const payload = privateChecklistPayload(useChecklists.getState());

    // Sign-out wipes local state; sign-in writes the cloud blob back.
    useChecklists.getState().reset();
    useChecklists.getState().replacePrivateData(payload);

    expect(useChecklists.getState().lists.map((list) => list.name)).toEqual([
      'Features',
      'Iceland Checklist',
      'To Do',
    ]);
    expect(useChecklists.getState().listOpenedAt[buried.id]).toBe(
      '2026-08-15T20:00:00.000Z',
    );
  });

  it('puts a promoted shared list back on top when it reloads after a restore', () => {
    const sharedId = '9a21f566-3bc6-43df-a125-03e4c4541963';
    const snapshot = {
      list: {
        ...useChecklists.getState().lists[0],
        id: sharedId,
        name: 'Family Errands',
        mode: 'shared' as const,
      },
      tasks: [],
      members: [],
    };
    useChecklists.getState().createList('Groceries');
    useChecklists.getState().replaceSharedSnapshots([snapshot]);
    useChecklists.getState().touchList(sharedId, '2026-08-15T20:00:00.000Z');
    expect(useChecklists.getState().lists[0]?.id).toBe(sharedId);
    const payload = privateChecklistPayload(useChecklists.getState());
    expect(payload.listOrderHint[0]).toBe(sharedId);

    useChecklists.getState().reset();
    useChecklists.getState().replacePrivateData(payload);
    // The shared catalog reloads after the private pull — the order hint puts
    // the list back on top instead of appending it at the end.
    useChecklists.getState().replaceSharedSnapshots([snapshot]);

    expect(useChecklists.getState().lists.map((list) => list.name)).toEqual([
      'Family Errands',
      'Groceries',
      'To Do',
    ]);
    expect(useChecklists.getState().listOpenedAt[sharedId]).toBe(
      '2026-08-15T20:00:00.000Z',
    );
  });

  it('restores the same order when the shared catalog loads before the private pull', () => {
    const sharedId = '9a21f566-3bc6-43df-a125-03e4c4541963';
    const snapshot = {
      list: {
        ...useChecklists.getState().lists[0],
        id: sharedId,
        name: 'Family Errands',
        mode: 'shared' as const,
      },
      tasks: [],
      members: [],
    };
    useChecklists.getState().createList('Groceries');
    useChecklists.getState().replaceSharedSnapshots([snapshot]);
    useChecklists.getState().touchList(sharedId, '2026-08-15T20:00:00.000Z');
    const payload = privateChecklistPayload(useChecklists.getState());

    useChecklists.getState().reset();
    useChecklists.getState().replaceSharedSnapshots([snapshot]);
    useChecklists.getState().replacePrivateData(payload);

    expect(useChecklists.getState().lists.map((list) => list.name)).toEqual([
      'Family Errands',
      'Groceries',
      'To Do',
    ]);
  });

  it('keeps a brand-new local list above restored positions when a shared list arrives', () => {
    const sharedId = '9a21f566-3bc6-43df-a125-03e4c4541963';
    const snapshot = {
      list: {
        ...useChecklists.getState().lists[0],
        id: sharedId,
        name: 'Family Errands',
        mode: 'shared' as const,
      },
      tasks: [],
      members: [],
    };
    useChecklists.getState().replaceSharedSnapshots([snapshot]);
    useChecklists.getState().touchList(sharedId, '2026-08-15T20:00:00.000Z');
    const payload = privateChecklistPayload(useChecklists.getState());

    useChecklists.getState().reset();
    useChecklists.getState().replacePrivateData(payload);
    // Created after the restore — not in the hint, so it outranks everything.
    useChecklists.getState().createList('Fresh Ideas');
    useChecklists.getState().replaceSharedSnapshots([snapshot]);

    expect(useChecklists.getState().lists.map((list) => list.name)).toEqual([
      'Fresh Ideas',
      'Family Errands',
      'To Do',
    ]);
  });

  it('keeps a fresher local order when a stale cloud hint arrives mid-session', () => {
    const older = useChecklists.getState().createList('Older')!;
    useChecklists.getState().createList('Newer');
    const stalePayload = privateChecklistPayload(useChecklists.getState());

    useChecklists.getState().touchList(older.id, '2099-01-01T00:00:00.000Z');
    const localOrder = useChecklists.getState().lists.map((list) => list.id);

    useChecklists.getState().replacePrivateData(stalePayload);

    expect(useChecklists.getState().lists.map((list) => list.id)).toEqual(localOrder);
    expect(useChecklists.getState().lists[0]?.id).toBe(older.id);
  });

  it('ships the full catalog order and open recency in the private payload', () => {
    const sharedId = '9a21f566-3bc6-43df-a125-03e4c4541963';
    useChecklists.getState().replaceSharedSnapshots([
      {
        list: {
          ...useChecklists.getState().lists[0],
          id: sharedId,
          name: 'Family Errands',
          mode: 'shared' as const,
        },
        tasks: [],
        members: [],
      },
    ]);
    useChecklists.getState().touchList(sharedId, '2026-08-15T20:00:00.000Z');

    const state = useChecklists.getState();
    const payload = privateChecklistPayload(state);

    expect(payload.listOrderHint).toEqual(state.lists.map((list) => list.id));
    expect(payload.listOrderHint).toContain(sharedId);
    expect(payload.listOpenedAt).toBe(state.listOpenedAt);
    expect(payload.lists.every((list) => list.mode === 'private')).toBe(true);
  });

  it('keeps a trip-linked checklist when a cloud pull omits it', () => {
    useTravel.getState().reset();
    const packing = useChecklists.getState().createList('Iceland Checklist')!;
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

    useChecklists.getState().replacePrivateData({
      lists: [],
      tasks: [],
      categories: [],
      recipes: [],
    });

    expect(
      useChecklists.getState().lists.some((item) => item.id === packing.id),
    ).toBe(true);
  });

  it('still drops an unlinked private list omitted from a cloud pull', () => {
    const extra = useChecklists.getState().createList('Scratch')!;
    useChecklists.getState().replacePrivateData({
      lists: [],
      tasks: [],
      categories: [],
      recipes: [],
    });
    expect(
      useChecklists.getState().lists.some((item) => item.id === extra.id),
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
