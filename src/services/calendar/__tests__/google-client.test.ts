import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { useSchedule } from '@/store/schedule';
import type { Activity } from '@/types/models';

const mockApiRequest = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();

jest.mock('@/services/http/api-client', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}));

const {
  connectGoogleCalendar,
  describeGoogleCalendarSyncPreview,
  disconnectGoogleCalendar,
  googleCalendarCallbackError,
  googleCalendarReviewErrorMessage,
  GoogleCalendarError,
  previewGoogleCalendarSync,
  syncGoogleCalendar,
} = require('../google-client') as typeof import('../google-client');

const syncedAt = '2026-08-12T10:00:00.000Z';
const baseActivity: Activity = {
  id: 'local-1',
  title: 'Local event',
  date: '2026-08-12',
  startMinutes: 600,
  durationMinutes: 60,
  categoryId: 'personal',
  status: 'upcoming',
  createdAt: syncedAt,
  updatedAt: syncedAt,
};

beforeEach(() => {
  jest.clearAllMocks();
  useSchedule.setState({
    seeded: true,
    activities: [],
    meals: [],
    workouts: [],
    workSessions: [],
    movies: [],
    categories: DEFAULT_CATEGORIES,
    googleCalendarDeletions: [],
  });
});

it('surfaces provider callback errors instead of treating any browser return as a successful link', () => {
  expect(googleCalendarCallbackError('ontrack://calendar/google?calendarError=Access+denied'))
    .toBe('Access denied');
  expect(googleCalendarCallbackError('ontrack://calendar/google?calendarConnected=1'))
    .toBeUndefined();
  expect(googleCalendarCallbackError('ontrack://calendar/google'))
    .toBe('Google Calendar did not finish connecting.');
  expect(googleCalendarCallbackError('not a url'))
    .toBe('Google Calendar returned an invalid callback.');
});

it('requests a read-only preview from current local schedule state', async () => {
  useSchedule.setState({ activities: [baseActivity] });
  mockApiRequest.mockResolvedValueOnce({ direction: 'to_google', changes: [] });

  await expect(previewGoogleCalendarSync()).resolves.toEqual({ direction: 'to_google', changes: [] });
  expect(mockApiRequest).toHaveBeenCalledWith(expect.objectContaining({
    method: 'POST',
    timeoutMs: 60_000,
    url: expect.stringContaining('/api/calendar/google/preview'),
    body: expect.objectContaining({
      activities: [baseActivity],
      deletions: [],
      timeZone: expect.any(String),
    }),
  }));
});

it('explains a failed review with the server status and confirms that nothing changed', () => {
  expect(googleCalendarReviewErrorMessage(new GoogleCalendarError(
    'Google Calendar sync is temporarily unavailable.',
    undefined,
    503,
  ))).toBe(
    'The onTrack calendar server could not prepare the change review (503). No calendar events were changed. Try again in a few minutes.',
  );
});

it.each([
  [
    new GoogleCalendarError('Too many requests.', undefined, 429),
    'Google Calendar is rate-limiting requests (429). No calendar events were changed. Wait a minute, then tap Sync Now again.',
  ],
  [
    new GoogleCalendarError('Not found.', undefined, 404),
    'The connected onTrack server does not have the calendar review endpoint (404). No calendar events were changed. Update onTrack or try again later.',
  ],
  [
    new GoogleCalendarError('Permission needs to be renewed.', 'RECONNECT_REQUIRED', 503),
    'Google Calendar access has expired. Reconnect your account, then tap Sync Now again. No calendar events were changed.',
  ],
  [
    Object.assign(new Error('The request was aborted.'), { name: 'AbortError' }),
    'Google Calendar did not finish preparing the change review within 60 seconds. No calendar events were changed. Try again.',
  ],
] as const)('gives an actionable review message for %s', (error, expected) => {
  expect(googleCalendarReviewErrorMessage(error)).toBe(expected);
});

it('preserves a specific safe validation message and adds the no-change result', () => {
  expect(googleCalendarReviewErrorMessage(new GoogleCalendarError(
    'Calendar payload is invalid.',
    undefined,
    400,
  ))).toBe('Calendar payload is invalid. No calendar events were changed.');
});

it('describes every previewed change so long lists can be reviewed', () => {
  const changes = Array.from({ length: 10 }, (_, index) => ({
    id: `change-${index}`,
    title: `Plan ${index}`,
    action: index === 0 ? 'delete' as const : 'create' as const,
    destination: index === 0 ? 'ontrack' as const : 'google' as const,
  }));

  const description = describeGoogleCalendarSyncPreview({ direction: 'two_way', changes });

  expect(description).toContain('10 changes will be made');
  expect(description).toContain('Remove from onTrack: “Plan 0”');
  expect(description).toContain('Add to Google: “Plan 1”');
  expect(description).toContain('Add to Google: “Plan 8”');
  expect(description).toContain('Add to Google: “Plan 9”');
  expect(description).not.toContain('Plus 2 more changes');
});

it('keeps long or multiline event titles compact in the confirmation prompt', () => {
  const description = describeGoogleCalendarSyncPreview({
    direction: 'to_google',
    changes: [{
      id: 'change-1',
      title: `A long\ncalendar title ${'x'.repeat(80)}`,
      action: 'update',
      destination: 'google',
    }],
  });

  expect(description).not.toContain('\ncalendar title');
  expect(description).toContain('A long calendar title');
  expect(description).toContain('…');
});

it('describes the reason and before-to-after fields for each planned update', () => {
  const description = describeGoogleCalendarSyncPreview({
    direction: 'from_google',
    changes: [{
      id: 'change-1',
      title: 'Therapy',
      action: 'update',
      destination: 'ontrack',
      reason: 'Matched by Google event id',
      details: [
        { label: 'Time', before: '10:00 AM', after: '11:00 AM' },
        { label: 'Duration', before: '1h', after: '1h 30m' },
      ],
    }],
  });

  expect(description).toContain('Update in onTrack: “Therapy”');
  expect(description).toContain('Why: Matched by Google event id');
  expect(description).toContain('Time: 10:00 AM → 11:00 AM');
  expect(description).toContain('Duration: 1h → 1h 30m');
});

it('labels metadata-only link repairs without claiming event content will change', () => {
  const description = describeGoogleCalendarSyncPreview({
    direction: 'from_google',
    changes: [{
      id: 'repair-1', title: 'Therapy', action: 'relink', destination: 'ontrack',
      reason: 'The events already match; only their stored connection will be corrected.',
      details: [{ label: 'Time', after: '2:00 PM' }],
    }],
  });

  expect(description).toContain('Repair calendar link for “Therapy”');
  expect(description).toContain('Time: 2:00 PM');
  expect(description).not.toContain('Update in onTrack');
});

it('rejects a native OAuth session when Google redirects back with an error', async () => {
  mockApiRequest.mockResolvedValueOnce({ authorizationUrl: 'https://accounts.google.test/oauth' });
  mockOpenAuthSessionAsync.mockResolvedValueOnce({
    type: 'success',
    url: 'ontrack://calendar/google?calendarError=Permission+denied',
  });

  await expect(connectGoogleCalendar()).rejects.toEqual(expect.objectContaining({
    name: 'GoogleCalendarError',
    message: 'Permission denied',
  }));
  expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
    'https://accounts.google.test/oauth',
    'ontrack://calendar/google',
  );
});

it('accepts only an explicit successful native OAuth callback and distinguishes cancellation', async () => {
  mockApiRequest.mockResolvedValueOnce({ authorizationUrl: 'https://accounts.google.test/oauth' });
  mockOpenAuthSessionAsync.mockResolvedValueOnce({
    type: 'success',
    url: 'ontrack://calendar/google?calendarConnected=1',
  });
  await expect(connectGoogleCalendar()).resolves.toBeUndefined();

  mockApiRequest.mockResolvedValueOnce({ authorizationUrl: 'https://accounts.google.test/oauth' });
  mockOpenAuthSessionAsync.mockResolvedValueOnce({ type: 'cancel' });
  await expect(connectGoogleCalendar()).rejects.toEqual(expect.objectContaining({
    code: 'CANCELLED',
    message: 'Google Calendar connection was cancelled.',
  }));
});

it('sends durable deletion intent and clears only provider-acknowledged tombstones after sync', async () => {
  const linked = {
    ...baseActivity,
    googleCalendar: {
      calendarId: 'primary', eventId: 'event-1', origin: 'google' as const, lastSyncedAt: syncedAt,
    },
  };
  useSchedule.setState({ activities: [linked] });
  useSchedule.getState().deleteActivity(linked.id);
  const deletion = useSchedule.getState().googleCalendarDeletions[0];
  mockApiRequest.mockResolvedValueOnce({
    activities: [],
    acknowledgedDeletionIds: [linked.id],
    imported: 0,
    exported: 0,
    updated: 0,
    removed: 1,
    lastSyncedAt: syncedAt,
    hasMore: false,
  });

  const result = await syncGoogleCalendar();

  expect(result.removed).toBe(1);
  expect(mockApiRequest).toHaveBeenCalledWith(expect.objectContaining({
    method: 'POST',
    timeoutMs: 60_000,
    body: expect.objectContaining({ activities: [], deletions: [deletion], phase: 'pull' }),
  }));
  expect(useSchedule.getState().googleCalendarDeletions).toEqual([]);
});

it('keeps an unacknowledged tombstone and rejects a stale activity returned by sync', async () => {
  const linked = {
    ...baseActivity,
    googleCalendar: {
      calendarId: 'primary', eventId: 'event-1', origin: 'ontrack' as const, lastSyncedAt: syncedAt,
    },
  };
  useSchedule.setState({ activities: [linked] });
  useSchedule.getState().deleteActivity(linked.id);
  mockApiRequest.mockResolvedValueOnce({
    activities: [linked],
    acknowledgedDeletionIds: [],
    imported: 0,
    exported: 0,
    updated: 0,
    removed: 0,
    lastSyncedAt: syncedAt,
    hasMore: false,
  });

  await syncGoogleCalendar();

  expect(useSchedule.getState().activities).toEqual([]);
  expect(useSchedule.getState().googleCalendarDeletions).toEqual([
    expect.objectContaining({ activityId: linked.id, eventId: 'event-1' }),
  ]);
});

it('retries one timed-out sync chunk before succeeding', async () => {
  const abort = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
  mockApiRequest
    .mockRejectedValueOnce(abort)
    .mockResolvedValueOnce({
      activities: [], acknowledgedDeletionIds: [], imported: 0, exported: 1,
      updated: 0, removed: 0, lastSyncedAt: syncedAt, hasMore: false,
    });

  await expect(syncGoogleCalendar()).resolves.toEqual(expect.objectContaining({ exported: 1 }));
  expect(mockApiRequest).toHaveBeenCalledTimes(2);
});

it('replaces repeated request aborts with a resumable timeout message', async () => {
  mockApiRequest.mockRejectedValue(
    Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
  );

  await expect(syncGoogleCalendar()).rejects.toEqual(expect.objectContaining({
    name: 'GoogleCalendarError',
    code: 'TIMEOUT',
    message: 'Google Calendar took too long to respond. Completed changes were saved; tap Sync Now to continue.',
  }));
  expect(mockApiRequest).toHaveBeenCalledTimes(2);
});

it('finishes every disconnect cleanup chunk before stripping local links', async () => {
  const imported = {
    ...baseActivity,
    id: 'google-import',
    googleCalendar: {
      calendarId: 'primary', eventId: 'event-1', origin: 'google' as const, lastSyncedAt: syncedAt,
    },
  };
  const exported = {
    ...baseActivity,
    id: 'ontrack-export',
    googleCalendar: {
      calendarId: 'primary', eventId: 'event-2', origin: 'ontrack' as const, lastSyncedAt: syncedAt,
    },
  };
  useSchedule.setState({
    activities: [baseActivity, imported, exported],
    googleCalendarDeletions: [{
      activityId: 'old-delete', calendarId: 'primary', eventId: 'event-old', origin: 'ontrack',
    }],
  });
  mockApiRequest
    .mockResolvedValueOnce({ disconnected: false, hasMore: true })
    .mockResolvedValueOnce({ disconnected: true, hasMore: false });

  await disconnectGoogleCalendar({ removeImported: true, removeExported: true });

  expect(mockApiRequest).toHaveBeenCalledTimes(2);
  expect(mockApiRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
    body: { removeImported: true, removeExported: true },
    timeoutMs: 60_000,
  }));
  expect(useSchedule.getState().activities).toEqual([
    baseActivity,
    expect.not.objectContaining({ googleCalendar: expect.anything() }),
  ]);
  expect(useSchedule.getState().activities.map((activity) => activity.id))
    .toEqual(['local-1', 'ontrack-export']);
  expect(useSchedule.getState().googleCalendarDeletions).toEqual([]);
});

it('preserves local links and deletion intent when disconnect fails', async () => {
  const linked = {
    ...baseActivity,
    googleCalendar: {
      calendarId: 'primary', eventId: 'event-1', origin: 'ontrack' as const, lastSyncedAt: syncedAt,
    },
  };
  const deletion = {
    activityId: 'deleted-1', calendarId: 'primary', eventId: 'event-2', origin: 'ontrack' as const,
  };
  useSchedule.setState({ activities: [linked], googleCalendarDeletions: [deletion] });
  mockApiRequest.mockRejectedValueOnce(new GoogleCalendarError('Google Calendar request failed.'));

  await expect(disconnectGoogleCalendar({ removeImported: true, removeExported: true }))
    .rejects.toThrow('Google Calendar request failed.');

  expect(useSchedule.getState().activities).toEqual([linked]);
  expect(useSchedule.getState().googleCalendarDeletions).toEqual([deletion]);
});
