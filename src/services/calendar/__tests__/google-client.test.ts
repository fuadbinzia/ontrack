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
  disconnectGoogleCalendar,
  googleCalendarCallbackError,
  GoogleCalendarError,
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
