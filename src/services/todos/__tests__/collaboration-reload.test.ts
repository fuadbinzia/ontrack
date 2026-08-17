import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { loadAllSharedChecklists } from '@/services/todos/collaboration-reload';
import { useChecklists } from '@/store/todos';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('@/services/todos/collaboration-core', () => {
  const actual = jest.requireActual('@/services/todos/collaboration-core');
  return {
    ...actual,
    authenticatedClient: jest.fn(),
  };
});

jest.mock('@/services/todos/collaboration-mutations', () => ({
  flushChecklistMutations: jest.fn(async () => undefined),
  fetchChecklistSnapshot: jest.fn(),
}));

jest.mock('@/services/todos/collaboration-invites', () => ({
  loadChecklistInvites: jest.fn(async () => undefined),
}));

const { authenticatedClient } = jest.requireMock('@/services/todos/collaboration-core');
const { fetchChecklistSnapshot } = jest.requireMock(
  '@/services/todos/collaboration-mutations',
);

const SHARED_ID = '9a21f566-3bc6-43df-a125-03e4c4541963';
const INVITE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function sharedListRow(id: string, name: string) {
  return {
    id,
    name,
    kind: 'checklist' as const,
    mode: 'shared' as const,
    role: 'member' as const,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function snapshotFor(id: string, name: string) {
  return { list: sharedListRow(id, name), tasks: [], members: [] };
}

function mockRemoteIds(ids: string[]) {
  (authenticatedClient as jest.Mock).mockResolvedValue({
    rpc: jest.fn(async () => ({
      data: ids.map((id) => ({ list_id: id })),
      error: null,
    })),
  });
}

describe('shared catalog reload', () => {
  beforeEach(() => {
    useChecklists.getState().reset();
    (authenticatedClient as jest.Mock).mockReset();
    (fetchChecklistSnapshot as jest.Mock).mockReset();
  });

  it('does not resurrect a list the user left while its snapshot was in flight', async () => {
    useChecklists.getState().replaceSharedSnapshot(snapshotFor(SHARED_ID, 'Family Errands'));
    mockRemoteIds([SHARED_ID]);

    let releaseFetch: (() => void) | undefined;
    (fetchChecklistSnapshot as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseFetch = () => resolve(snapshotFor(SHARED_ID, 'Family Errands'));
        }),
    );

    const load = loadAllSharedChecklists();
    // Let the catalog RPC resolve and the snapshot fetch start.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(releaseFetch).toBeDefined();

    // The user leaves while the stale snapshot is still in flight.
    useChecklists.getState().removeSharedList(SHARED_ID);
    releaseFetch!();
    await load;

    expect(
      useChecklists.getState().lists.some((list) => list.id === SHARED_ID),
    ).toBe(false);
  });

  it('merges a fresh invite that was never on this device', async () => {
    mockRemoteIds([INVITE_ID]);
    (fetchChecklistSnapshot as jest.Mock).mockResolvedValue(
      snapshotFor(INVITE_ID, 'Trip Prep'),
    );

    await loadAllSharedChecklists();

    const list = useChecklists.getState().lists.find((item) => item.id === INVITE_ID);
    expect(list?.mode).toBe('shared');
    expect(list?.name).toBe('Trip Prep');
  });

  it('drops a local shared list the server no longer returns', async () => {
    useChecklists.getState().replaceSharedSnapshot(snapshotFor(SHARED_ID, 'Family Errands'));
    mockRemoteIds([]);

    await loadAllSharedChecklists();

    expect(
      useChecklists.getState().lists.some((list) => list.id === SHARED_ID),
    ).toBe(false);
  });

  it('drops a list whose snapshot fetch reports revoked access', async () => {
    useChecklists.getState().replaceSharedSnapshot(snapshotFor(SHARED_ID, 'Family Errands'));
    mockRemoteIds([SHARED_ID]);
    (fetchChecklistSnapshot as jest.Mock).mockResolvedValue(undefined);

    await loadAllSharedChecklists();

    expect(
      useChecklists.getState().lists.some((list) => list.id === SHARED_ID),
    ).toBe(false);
  });
});
