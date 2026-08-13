const mockAuthenticateApiRequest = jest.fn();
const mockIsApiRequestBlocked = jest.fn();

jest.mock('@/services/http/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => mockAuthenticateApiRequest(...args),
  isApiRequestBlocked: (...args: unknown[]) => mockIsApiRequestBlocked(...args),
}));

const { withGoogleCalendarApiAuth } = require('../google-api-route') as typeof import('../google-api-route');
const { GoogleCalendarProviderTimeoutError } = require('../google-fetch') as typeof import('../google-fetch');

const config = {
  methods: 'POST, OPTIONS',
  unauthorizedMessage: 'Sign in to sync calendars.',
  errorFallback: 'Calendar sync failed.',
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('does not invoke a Calendar API handler for an unauthenticated request', async () => {
  mockAuthenticateApiRequest.mockResolvedValueOnce({ status: 'unauthorized' });
  mockIsApiRequestBlocked.mockReturnValueOnce(false);
  const handler = jest.fn();

  const response = await withGoogleCalendarApiAuth(
    new Request('https://ontrack.example/api/calendar/google/sync', { method: 'POST' }),
    config,
    handler,
  );

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: 'Sign in to sync calendars.' });
  expect(handler).not.toHaveBeenCalled();
});

it('passes only the authenticated user id into the Calendar API handler', async () => {
  mockAuthenticateApiRequest.mockResolvedValueOnce({ status: 'ok', userId: 'user-1' });
  mockIsApiRequestBlocked.mockReturnValueOnce(false);
  const handler = jest.fn().mockResolvedValue({ connected: true });
  const request = new Request('https://ontrack.example/api/calendar/google/status');

  const response = await withGoogleCalendarApiAuth(request, config, handler);

  expect(handler).toHaveBeenCalledWith(request, 'user-1');
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ connected: true });
});

it('preserves a structured server failure instead of replacing it with a generic error', async () => {
  mockAuthenticateApiRequest.mockResolvedValueOnce({ status: 'ok', userId: 'user-1' });
  mockIsApiRequestBlocked.mockReturnValueOnce(false);
  const handler = jest.fn().mockRejectedValue(new Error('Google Calendar permission expired.'));

  const response = await withGoogleCalendarApiAuth(
    new Request('https://ontrack.example/api/calendar/google/sync', { method: 'POST' }),
    config,
    handler,
  );

  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toEqual({ error: 'Google Calendar permission expired.' });
});

it('preserves the provider timeout code so the client can retry safely', async () => {
  mockAuthenticateApiRequest.mockResolvedValueOnce({ status: 'ok', userId: 'user-1' });
  mockIsApiRequestBlocked.mockReturnValueOnce(false);
  const handler = jest.fn().mockRejectedValue(new GoogleCalendarProviderTimeoutError());

  const response = await withGoogleCalendarApiAuth(
    new Request('https://ontrack.example/api/calendar/google/sync', { method: 'POST' }),
    config,
    handler,
  );

  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toEqual({
    error: 'Google Calendar took too long to respond. Tap Sync Now to continue.',
    code: 'PROVIDER_TIMEOUT',
  });
});
