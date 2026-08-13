const mockExchangeGoogleCalendarCode = jest.fn();
const mockReadCalendarOAuthState = jest.fn();
const mockPreviewGoogleCalendarSyncServer = jest.fn();
const mockSyncGoogleCalendarServer = jest.fn();

jest.mock('@/services/calendar/google-server', () => ({
  exchangeGoogleCalendarCode: (...args: unknown[]) => mockExchangeGoogleCalendarCode(...args),
  googleCalendarCallbackUri: () => 'https://ontrack.example/api/calendar/google/callback',
  googleCalendarErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
  readCalendarOAuthState: (...args: unknown[]) => mockReadCalendarOAuthState(...args),
  previewGoogleCalendarSyncServer: (...args: unknown[]) => mockPreviewGoogleCalendarSyncServer(...args),
  syncGoogleCalendarServer: (...args: unknown[]) => mockSyncGoogleCalendarServer(...args),
}));

jest.mock('@/services/calendar/google-api-route', () => ({
  googleCalendarApiOptions: jest.fn(),
  withGoogleCalendarApiAuth: (
    request: Request,
    _config: unknown,
    handler: (request: Request, userId: string) => Promise<unknown>,
  ) => handler(request, 'user-1').then((result) =>
    result instanceof Response ? result : Response.json(result)),
}));

const callbackRoute = require('@/app/api/calendar/google/callback+api') as typeof import('@/app/api/calendar/google/callback+api');
const previewRoute = require('@/app/api/calendar/google/preview+api') as typeof import('@/app/api/calendar/google/preview+api');
const syncRoute = require('@/app/api/calendar/google/sync+api') as typeof import('@/app/api/calendar/google/sync+api');

beforeEach(() => {
  jest.clearAllMocks();
});

it('redirects a successful OAuth callback only after exchanging its code', async () => {
  mockReadCalendarOAuthState.mockResolvedValueOnce({
    userId: 'user-1',
    returnUri: 'https://ontrack.example/profile/calendar-sync',
    exp: Date.now() + 60_000,
  });

  const response = await callbackRoute.GET(new Request(
    'https://ontrack.example/api/calendar/google/callback?state=signed-state&code=google-code',
  ));

  expect(mockExchangeGoogleCalendarCode).toHaveBeenCalledWith(
    'user-1',
    'google-code',
    'https://ontrack.example/api/calendar/google/callback',
  );
  expect(response.status).toBe(302);
  expect(response.headers.get('location'))
    .toBe('https://ontrack.example/profile/calendar-sync?calendarConnected=1');
});

it('returns Google provider errors to the verified app route without exchanging a code', async () => {
  mockReadCalendarOAuthState.mockResolvedValueOnce({
    userId: 'user-1',
    returnUri: 'ontrack://calendar/google',
    exp: Date.now() + 60_000,
  });

  const response = await callbackRoute.GET(new Request(
    'https://ontrack.example/api/calendar/google/callback?state=signed-state&error=access_denied',
  ));

  expect(mockExchangeGoogleCalendarCode).not.toHaveBeenCalled();
  expect(response.status).toBe(302);
  expect(response.headers.get('location'))
    .toBe('ontrack://calendar/google?calendarError=access_denied');
});

it('rejects an invalid activity payload before starting Calendar sync', async () => {
  const response = await syncRoute.POST(new Request(
    'https://ontrack.example/api/calendar/google/sync',
    { method: 'POST', body: JSON.stringify({ activities: 'not-an-array' }) },
  ));

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: 'Calendar payload is invalid.' });
  expect(mockSyncGoogleCalendarServer).not.toHaveBeenCalled();
});

it('rejects an invalid deletion queue before starting Calendar sync', async () => {
  const response = await syncRoute.POST(new Request(
    'https://ontrack.example/api/calendar/google/sync',
    { method: 'POST', body: JSON.stringify({ activities: [], deletions: {} }) },
  ));

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: 'Calendar deletion payload is invalid.' });
  expect(mockSyncGoogleCalendarServer).not.toHaveBeenCalled();
});

it('passes activities, deletion intent, timezone, and push phase to the server boundary', async () => {
  const deletion = {
    activityId: 'activity-1', calendarId: 'primary', eventId: 'event-1', origin: 'ontrack',
  };
  mockSyncGoogleCalendarServer.mockResolvedValueOnce({ hasMore: false });

  const response = await syncRoute.POST(new Request(
    'https://ontrack.example/api/calendar/google/sync',
    {
      method: 'POST',
      body: JSON.stringify({ activities: [], deletions: [deletion], timeZone: 'America/New_York', phase: 'push' }),
    },
  ));

  expect(response.status).toBe(200);
  expect(mockSyncGoogleCalendarServer).toHaveBeenCalledWith(
    'user-1', [], [deletion], 'America/New_York', 'push',
  );
});

it('returns a read-only sync preview before any sync mutation starts', async () => {
  const deletion = {
    activityId: 'activity-1', calendarId: 'primary', eventId: 'event-1', origin: 'ontrack',
  };
  mockPreviewGoogleCalendarSyncServer.mockResolvedValueOnce({
    direction: 'to_google',
    changes: [{ id: 'change-1', title: 'Plan', action: 'create', destination: 'google' }],
  });

  const response = await previewRoute.POST(new Request(
    'https://ontrack.example/api/calendar/google/preview',
    { method: 'POST', body: JSON.stringify({ activities: [], deletions: [deletion] }) },
  ));

  expect(response.status).toBe(200);
  expect(mockPreviewGoogleCalendarSyncServer).toHaveBeenCalledWith('user-1', [], [deletion], 'UTC');
  expect(mockSyncGoogleCalendarServer).not.toHaveBeenCalled();
});

it('normalizes untrusted timezone and phase values at the sync route', async () => {
  mockSyncGoogleCalendarServer.mockResolvedValueOnce({ hasMore: false });

  await syncRoute.POST(new Request(
    'https://ontrack.example/api/calendar/google/sync',
    {
      method: 'POST',
      body: JSON.stringify({ activities: [], timeZone: 'x'.repeat(80), phase: 'delete_everything' }),
    },
  ));

  expect(mockSyncGoogleCalendarServer).toHaveBeenCalledWith('user-1', [], [], 'UTC', 'pull');
});
