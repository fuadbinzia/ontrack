const mockFetch = jest.fn();
const mockFinishActivity = jest.fn();
const mockAuthHeader = jest.fn();

jest.mock('expo/fetch', () => ({
  fetch: (...args: unknown[]) => mockFetch(...args),
}));

jest.mock('@/features/performance/runtime-activity', () => ({
  beginRuntimeOperation: () => mockFinishActivity,
}));

jest.mock('@/services/cloud/access-token', () => ({
  authHeader: (...args: unknown[]) => mockAuthHeader(...args),
}));

// eslint-disable-next-line import/first
import { apiRequest } from '@/services/http/api-client';

class TestApiError extends Error {}

describe('apiRequest', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFinishActivity.mockReset();
    mockAuthHeader.mockReset();
    mockAuthHeader.mockResolvedValue({ Authorization: 'Bearer token' });
  });

  it('preserves an external abort that happened before an authenticated request starts', async () => {
    const controller = new AbortController();
    controller.abort();
    mockFetch.mockImplementation((_url, init: RequestInit) => {
      expect(init.signal?.aborted).toBe(true);
      const error = new Error('Aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    await expect(
      apiRequest({
        url: 'https://api.example.com/data',
        timeoutMs: 10_000,
        signal: controller.signal,
        offlineMessage: 'Offline',
        unavailableMessage: 'Unavailable',
        createError: (message) => new TestApiError(message),
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockFinishActivity).toHaveBeenCalledWith({ error: true });
  });

  it('times out while auth-token lookup is stalled', async () => {
    mockAuthHeader.mockImplementation(() => new Promise(() => undefined));

    const request = apiRequest({
      url: 'https://api.example.com/data',
      timeoutMs: 1,
      offlineMessage: 'Offline',
      unavailableMessage: 'Unavailable',
      createError: (message) => new TestApiError(message),
    }).then(
      () => 'resolved',
      (error: unknown) =>
        error instanceof Error && error.name === 'AbortError' ? 'aborted' : 'rejected',
    );

    const outcome = await Promise.race([
      request,
      new Promise<'hung'>((resolve) => setTimeout(() => resolve('hung'), 30)),
    ]);
    expect(outcome).toBe('aborted');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('maps an unreadable success body to the unavailable error', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => '12' },
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    });

    await expect(
      apiRequest({
        url: 'https://api.example.com/data',
        unavailableMessage: 'Unavailable',
        offlineMessage: 'Offline',
        createError: (message) => new TestApiError(message),
      }),
    ).rejects.toMatchObject({ message: 'Unavailable' });
  });
});
