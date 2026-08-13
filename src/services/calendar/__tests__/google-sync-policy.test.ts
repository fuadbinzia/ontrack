import {
  GOOGLE_CALENDAR_MUTATIONS_PER_REQUEST,
  googleCalendarDuplicateEventIds,
  googleCalendarAccountChanged,
  googleCalendarErrorMessage,
  googleCalendarReturnUri,
  googleCalendarSyncPolicy,
  hasGoogleCalendarWriteScope,
} from '@/services/calendar/google-server';

it('preserves structured server errors for calendar troubleshooting', () => {
  expect(googleCalendarErrorMessage({ message: 'Database rejected the calendar link.' }, 'Calendar sync failed.'))
    .toBe('Database rejected the calendar link.');
});

it('does not expose Calendar link constraint details to the sync screen', () => {
  expect(googleCalendarErrorMessage({
    message: 'duplicate key value violates unique constraint "google_calendar_event_links_user_id_activity_id_key"',
  }, 'Calendar sync failed.')).toBe('Calendar links changed during sync. Please try again.');
});

it('resets event mappings only when reconnecting a different known Google account', () => {
  expect(googleCalendarAccountChanged('calendar@example.com', 'CALENDAR@example.com')).toBe(false);
  expect(googleCalendarAccountChanged('first@example.com', 'second@example.com')).toBe(true);
  expect(googleCalendarAccountChanged(null, 'second@example.com')).toBe(false);
  expect(googleCalendarAccountChanged('first@example.com', undefined)).toBe(false);
});

it('uses public web paths and the registered native scheme for OAuth returns', () => {
  expect(googleCalendarReturnUri('https://ontrack.example/api/calendar/google/connect', false))
    .toBe('https://ontrack.example/profile/calendar-sync');
  expect(googleCalendarReturnUri('https://ontrack.example/api/calendar/google/connect', true))
    .toBe('ontrack://calendar/google');
});

it('keeps each server chunk below a conservative Google mutation budget', () => {
  expect(GOOGLE_CALENDAR_MUTATIONS_PER_REQUEST).toBeLessThanOrEqual(20);
});

it('enforces each calendar sync direction at the server policy boundary', () => {
  expect(googleCalendarSyncPolicy.importsUnlinkedGoogleEvents('to_google')).toBe(false);
  expect(googleCalendarSyncPolicy.pushesToGoogle('to_google')).toBe(true);
  expect(googleCalendarSyncPolicy.importsUnlinkedGoogleEvents('from_google')).toBe(true);
  expect(googleCalendarSyncPolicy.pushesToGoogle('from_google')).toBe(false);
  expect(googleCalendarSyncPolicy.removesFromOnTrack('from_google')).toBe(false);
  expect(googleCalendarSyncPolicy.removesFromOnTrack('to_google')).toBe(false);
  expect(googleCalendarSyncPolicy.removesFromOnTrack('two_way')).toBe(true);
  expect(googleCalendarSyncPolicy.cleansRemoteDuplicates('from_google')).toBe(false);
  expect(googleCalendarSyncPolicy.acceptsGoogleChanges('from_google', 'ontrack')).toBe(true);
  expect(googleCalendarSyncPolicy.acceptsGoogleChanges('two_way', 'ontrack')).toBe(false);
  expect(googleCalendarSyncPolicy.acceptsGoogleChanges('two_way', 'google')).toBe(true);
  expect(googleCalendarSyncPolicy.hasLocalChanges(
    { updatedAt: '2026-08-12T11:00:00.000Z' },
    { local_updated_at: '2026-08-12T10:00:00.000Z' },
  )).toBe(true);
  expect(googleCalendarSyncPolicy.isExplicitDeletion(
    { activity_id: 'google-import' },
    new Set(['google-import']),
  )).toBe(true);
});

it('never treats recurring occurrences with a shared parent marker as duplicate events', () => {
  const events = Array.from({ length: 102 }, (_, index) => ({
    id: `occurrence-${index}`,
    recurringEventId: 'therapy-series',
    extendedProperties: { private: { ontrackActivityId: 'therapy-parent' } },
  }));
  const links = events.map((event, index) => ({
    google_event_id: event.id!, activity_id: `therapy-${index}`,
  }));

  expect(googleCalendarDuplicateEventIds(events, links)).toEqual(new Set());
});

it('does not delete visible candidates when the recorded canonical event is absent', () => {
  const events = ['candidate-a', 'candidate-b'].map((id) => ({
    id,
    extendedProperties: { private: { ontrackActivityId: 'activity-1' } },
  }));

  expect(googleCalendarDuplicateEventIds(events, [{
    google_event_id: 'canonical-outside-window', activity_id: 'activity-1',
  }])).toEqual(new Set());
});

it('still identifies a genuine standalone duplicate when its canonical event is present', () => {
  const events = ['canonical', 'duplicate'].map((id) => ({
    id,
    extendedProperties: { private: { ontrackActivityId: 'activity-1' } },
  }));

  expect(googleCalendarDuplicateEventIds(events, [{
    google_event_id: 'canonical', activity_id: 'activity-1',
  }])).toEqual(new Set(['duplicate']));
});

it('recognizes fresh Calendar write grants and rejects read-only grants', () => {
  expect(hasGoogleCalendarWriteScope('openid email https://www.googleapis.com/auth/calendar.events')).toBe(true);
  expect(hasGoogleCalendarWriteScope('https://www.googleapis.com/auth/calendar')).toBe(true);
  expect(hasGoogleCalendarWriteScope('openid email https://www.googleapis.com/auth/calendar.events.readonly')).toBe(false);
});
