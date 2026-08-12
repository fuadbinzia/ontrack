import {
  GOOGLE_CALENDAR_MUTATIONS_PER_REQUEST,
  googleCalendarErrorMessage,
  googleCalendarSyncPolicy,
  hasGoogleCalendarWriteScope,
} from '@/services/calendar/google-server';

it('preserves structured server errors for calendar troubleshooting', () => {
  expect(googleCalendarErrorMessage({ message: 'Database rejected the calendar link.' }, 'Calendar sync failed.'))
    .toBe('Database rejected the calendar link.');
});

it('keeps each server chunk below a conservative Google mutation budget', () => {
  expect(GOOGLE_CALENDAR_MUTATIONS_PER_REQUEST).toBeLessThanOrEqual(50);
});

it('enforces each calendar sync direction at the server policy boundary', () => {
  expect(googleCalendarSyncPolicy.importsUnlinkedGoogleEvents('to_google')).toBe(false);
  expect(googleCalendarSyncPolicy.pushesToGoogle('to_google')).toBe(true);
  expect(googleCalendarSyncPolicy.importsUnlinkedGoogleEvents('from_google')).toBe(true);
  expect(googleCalendarSyncPolicy.pushesToGoogle('from_google')).toBe(false);
  expect(googleCalendarSyncPolicy.cleansRemoteDuplicates('from_google')).toBe(false);
  expect(googleCalendarSyncPolicy.acceptsGoogleChanges('from_google', 'ontrack')).toBe(true);
  expect(googleCalendarSyncPolicy.acceptsGoogleChanges('two_way', 'ontrack')).toBe(false);
  expect(googleCalendarSyncPolicy.acceptsGoogleChanges('two_way', 'google')).toBe(true);
});

it('recognizes fresh Calendar write grants and rejects read-only grants', () => {
  expect(hasGoogleCalendarWriteScope('openid email https://www.googleapis.com/auth/calendar.events')).toBe(true);
  expect(hasGoogleCalendarWriteScope('https://www.googleapis.com/auth/calendar')).toBe(true);
  expect(hasGoogleCalendarWriteScope('openid email https://www.googleapis.com/auth/calendar.events.readonly')).toBe(false);
});
