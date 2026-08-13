import { fetchGoogleApi } from '../google-fetch';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('passes an already-aborted caller signal through to Google provider requests', async () => {
  const external = new AbortController();
  external.abort();
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
    expect(init?.signal?.aborted).toBe(true);
    throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  });

  await expect(fetchGoogleApi('https://www.googleapis.com/calendar/v3/calendars/primary', {
    signal: external.signal,
  })).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('replaces a provider deadline abort with a useful Calendar timeout', async () => {
  jest.useFakeTimers();
  jest.spyOn(global, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }));

  const request = fetchGoogleApi('https://oauth2.googleapis.com/token', {}, 25);
  const rejection = expect(request).rejects.toMatchObject({
    name: 'GoogleCalendarProviderTimeoutError',
    code: 'PROVIDER_TIMEOUT',
    message: 'Google Calendar took too long to respond. Tap Sync Now to continue.',
  });
  await jest.advanceTimersByTimeAsync(25);
  await rejection;
});
