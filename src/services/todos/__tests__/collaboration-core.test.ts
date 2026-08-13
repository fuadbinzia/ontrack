const mockGetSupabaseClient = jest.fn();

jest.mock('@/services/cloud/supabase', () => ({
  getSupabaseClient: (...args: unknown[]) => mockGetSupabaseClient(...args),
}));

// eslint-disable-next-line import/first
import {
  authenticatedClient,
  messageFrom,
  sharedSnapshot,
  TodoCollaborationError,
} from '../collaboration-core';

describe('todo collaboration boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('distinguishes an unconfigured build from a signed-out client', async () => {
    mockGetSupabaseClient.mockReturnValueOnce(undefined);
    await expect(authenticatedClient()).rejects.toEqual(
      new TodoCollaborationError('Shared lists are not configured for this build.'),
    );

    mockGetSupabaseClient.mockReturnValueOnce({
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }) },
    });
    await expect(authenticatedClient()).rejects.toEqual(
      new TodoCollaborationError('Sign in to share or join a list.'),
    );
  });

  it('returns the authenticated client without replacing it', async () => {
    const client = {
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null }) },
    };
    mockGetSupabaseClient.mockReturnValue(client);
    await expect(authenticatedClient()).resolves.toBe(client);
  });

  it('normalizes one shared list and discards unrelated entities', () => {
    const now = '2026-01-01T00:00:00.000Z';
    expect(sharedSnapshot({
      list: { id: 'list-1', name: 'Shared', kind: 'checklist', mode: 'shared', role: 'owner', createdAt: now, updatedAt: now },
      tasks: [
        { id: 'task-1', listId: 'list-1', title: 'Keep', completed: false, important: false, createdAt: now, updatedAt: now, version: 1 },
        { id: 'task-2', listId: 'other', title: 'Drop', completed: false, important: false, createdAt: now, updatedAt: now, version: 1 },
      ],
      members: [],
      recipes: [],
      categories: [],
    })).toMatchObject({ list: { id: 'list-1', mode: 'shared' }, tasks: [{ id: 'task-1' }] });
    expect(sharedSnapshot({ list: { mode: 'private' } })).toBeUndefined();
  });

  it('uses trimmed service errors and stable fallbacks', () => {
    expect(messageFrom({ message: '  denied  ' }, 'fallback')).toBe('denied');
    expect(messageFrom({ message: ' ' }, 'fallback')).toBe('fallback');
    expect(messageFrom(null, 'fallback')).toBe('fallback');
  });
});

