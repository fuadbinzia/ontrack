import { fetchWithTimeout } from '@/services/http/fetch-with-timeout';

describe('fetchWithTimeout', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a successful response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const response = await fetchWithTimeout('https://example.com/api', undefined, 1_000);
    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('aborts when the external signal fires', async () => {
    const controller = new AbortController();
    jest.spyOn(global, 'fetch').mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });
    const pending = fetchWithTimeout(
      'https://example.com/slow',
      { signal: controller.signal },
      10_000,
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('preserves an external abort that happened before the request starts', async () => {
    const controller = new AbortController();
    controller.abort();
    jest.spyOn(global, 'fetch').mockImplementation((_url, init) => {
      expect(init?.signal?.aborted).toBe(true);
      const error = new Error('Aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    });

    await expect(
      fetchWithTimeout(
        'https://example.com/already-cancelled',
        { signal: controller.signal },
        10_000,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
