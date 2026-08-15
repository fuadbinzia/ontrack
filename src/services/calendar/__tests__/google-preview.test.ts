import type { Activity } from '@/types/models';

import { buildGoogleCalendarSyncPreview } from '../google-sync';
import type { GoogleCalendarEvent, GoogleCalendarLinkRow } from '../google-types';

const syncedAt = '2026-08-13T10:00:00.000Z';

function activity(id: string, title: string, updatedAt = syncedAt): Activity {
  return {
    id, title, date: '2026-08-13', startMinutes: 600, durationMinutes: 60,
    categoryId: 'personal', status: 'upcoming', createdAt: syncedAt, updatedAt,
  };
}

function link(
  activityId: string,
  eventId: string,
  origin: GoogleCalendarLinkRow['origin'] = 'ontrack',
): GoogleCalendarLinkRow {
  return {
    user_id: 'user-1', calendar_id: 'primary', google_event_id: eventId,
    activity_id: activityId, origin, google_updated_at: syncedAt,
    local_updated_at: syncedAt, created_at: syncedAt,
  };
}

it('previews creates, updates, and removals going to Google without mutating input', () => {
  const existingLink = link('updated', 'event-updated');
  const deletedLink = link('deleted', 'event-deleted');
  const activities = [
    activity('new', 'New plan'),
    activity('updated', 'Changed plan', '2026-08-13T11:00:00.000Z'),
  ];

  const preview = buildGoogleCalendarSyncPreview(
    'to_google',
    activities,
    [{ activityId: 'deleted', calendarId: 'primary', eventId: 'event-deleted', origin: 'ontrack' }],
    [existingLink, deletedLink],
    [],
  );

  expect(preview.changes).toEqual(expect.arrayContaining([
    expect.objectContaining({ title: 'New plan', action: 'create', destination: 'google' }),
    expect.objectContaining({ title: 'Changed plan', action: 'update', destination: 'google' }),
    expect.objectContaining({ action: 'delete', destination: 'google' }),
  ]));
  expect(activities).toHaveLength(2);
});

it('previews Google creates and updates without destructive removals in From Google mode', () => {
  const links = [
    link('updated', 'event-updated', 'google'),
    link('deleted', 'event-deleted', 'google'),
  ];
  const events: GoogleCalendarEvent[] = [
    { id: 'event-new', summary: 'Google plan', updated: '2026-08-13T11:00:00.000Z' },
    { id: 'event-updated', summary: 'Renamed plan', updated: '2026-08-13T11:00:00.000Z' },
    { id: 'event-deleted', summary: 'Cancelled plan', status: 'cancelled', updated: '2026-08-13T11:00:00.000Z' },
  ];

  const preview = buildGoogleCalendarSyncPreview(
    'from_google',
    [activity('updated', 'Old title'), activity('deleted', 'Cancelled plan')],
    [],
    links,
    events,
  );

  expect(preview.changes).toEqual(expect.arrayContaining([
    expect.objectContaining({ title: 'Google plan', action: 'create', destination: 'ontrack' }),
    expect.objectContaining({ title: 'Renamed plan', action: 'update', destination: 'ontrack' }),
  ]));
  expect(preview.changes).not.toContainEqual(expect.objectContaining({
    title: 'Cancelled plan', action: 'delete', destination: 'ontrack',
  }));
  expect(preview.changes).not.toContainEqual(expect.objectContaining({ destination: 'google' }));
});

it('previews a confirmed Google deletion only when Two-Way mode can remove from onTrack', () => {
  const cancelledLink = link('deleted', 'event-deleted', 'google');
  const cancelledEvent: GoogleCalendarEvent = {
    id: 'event-deleted', summary: 'Cancelled plan', status: 'cancelled', updated: syncedAt,
  };

  const preview = buildGoogleCalendarSyncPreview(
    'two_way',
    [activity('deleted', 'Cancelled plan')],
    [],
    [cancelledLink],
    [cancelledEvent],
  );

  expect(preview.changes).toContainEqual(expect.objectContaining({
    title: 'Cancelled plan', action: 'delete', destination: 'ontrack',
  }));
});

it('does not propose removing 106 cancelled recurring records in From Google mode', () => {
  const activities = Array.from({ length: 106 }, (_, index) =>
    activity(`therapy-${index}`, 'Therapy'));
  const links = activities.map((item, index) => link(item.id, `occurrence-${index}`, 'google'));
  const events: GoogleCalendarEvent[] = activities.map((_item, index) => ({
    id: `occurrence-${index}`,
    recurringEventId: 'therapy-series',
    summary: 'Therapy',
    status: 'cancelled',
    updated: '2026-08-13T11:00:00.000Z',
  }));

  expect(buildGoogleCalendarSyncPreview(
    'from_google', activities, [], links, events, 'UTC',
  ).changes).toEqual([]);
});

it('returns no planned changes when linked timestamps are already current', () => {
  const current = activity('current', 'Current plan');
  const currentLink = link('current', 'event-current', 'google');

  expect(buildGoogleCalendarSyncPreview(
    'two_way',
    [current],
    [],
    [currentLink],
    [{
      id: 'event-current', summary: 'Current plan', updated: syncedAt,
      start: { dateTime: '2026-08-13T10:00:00Z' },
      end: { dateTime: '2026-08-13T11:00:00Z' },
    }],
  ).changes).toEqual([]);
});

it('does not import an event already identified by local Google metadata when its server link is missing', () => {
  const existing = {
    ...activity('therapy', 'Therapy'),
    googleCalendar: {
      calendarId: 'primary',
      eventId: 'event-therapy',
      origin: 'google' as const,
      lastSyncedAt: syncedAt,
    },
  };

  expect(buildGoogleCalendarSyncPreview(
    'from_google',
    [existing],
    [],
    [],
    [{
      id: 'event-therapy', summary: 'Therapy', updated: syncedAt,
      start: { dateTime: '2026-08-13T10:00:00Z' },
      end: { dateTime: '2026-08-13T11:00:00Z' },
    }],
    'UTC',
  ).changes).toEqual([]);
});

it('recovers one uniquely matching unlinked occurrence instead of adding a duplicate', () => {
  expect(buildGoogleCalendarSyncPreview(
    'from_google',
    [activity('therapy', 'Therapy')],
    [],
    [],
    [{
      id: 'event-therapy', summary: 'Therapy', updated: syncedAt,
      start: { dateTime: '2026-08-13T10:00:00Z' },
      end: { dateTime: '2026-08-13T11:00:00Z' },
    }],
    'UTC',
  ).changes).toEqual([]);
});

it('does not guess between indistinguishable unlinked local events', () => {
  const preview = buildGoogleCalendarSyncPreview(
    'from_google',
    [activity('therapy-a', 'Therapy'), activity('therapy-b', 'Therapy')],
    [],
    [],
    [{
      id: 'event-therapy', summary: 'Therapy', updated: syncedAt,
      start: { dateTime: '2026-08-13T10:00:00Z' },
      end: { dateTime: '2026-08-13T11:00:00Z' },
    }],
    'UTC',
  );

  expect(preview.changes).toContainEqual(expect.objectContaining({
    action: 'create',
    destination: 'ontrack',
    reason: 'Google event is not linked to an onTrack event',
  }));
});

it('shows the exact fields a Google update will change in onTrack', () => {
  const preview = buildGoogleCalendarSyncPreview(
    'from_google',
    [{ ...activity('therapy', 'Therapy'), notes: 'Old note' }],
    [],
    [link('therapy', 'event-therapy', 'google')],
    [{
      id: 'event-therapy', summary: 'Therapy session', description: 'New note',
      updated: '2026-08-13T11:00:00.000Z',
      start: { dateTime: '2026-08-13T11:00:00Z' },
      end: { dateTime: '2026-08-13T12:30:00Z' },
    }],
    'UTC',
  );

  expect(preview.changes).toEqual([
    expect.objectContaining({
      action: 'update',
      destination: 'ontrack',
      details: expect.arrayContaining([
        { label: 'Title', before: 'Therapy', after: 'Therapy session' },
        { label: 'Time', before: '10:00 AM', after: '11:00 AM' },
        { label: 'Duration', before: '1h', after: '1h 30m' },
        { label: 'Notes', before: 'Old note', after: 'New note' },
      ]),
    }),
  ]);
});

it('shows the guest list that an invitation update will send to Google', () => {
  const invited = {
    ...activity('invited', 'Dinner'),
    attendeeEmails: ['alex@example.com', 'jordan@example.com'],
    updatedAt: '2026-08-13T11:00:00.000Z',
  };
  const preview = buildGoogleCalendarSyncPreview(
    'to_google',
    [invited],
    [],
    [link('invited', 'event-invited')],
    [{
      id: 'event-invited', summary: 'Dinner', updated: syncedAt,
      start: { dateTime: '2026-08-13T10:00:00Z' },
      end: { dateTime: '2026-08-13T11:00:00Z' },
    }],
    'UTC',
  );

  expect(preview.changes).toContainEqual(expect.objectContaining({
    action: 'update',
    destination: 'google',
    details: expect.arrayContaining([
      { label: 'Guests', before: 'None', after: 'alex@example.com, jordan@example.com' },
    ]),
  }));
});

it('repairs crossed recurring links instead of proposing stale Google times', () => {
  const therapy = { ...activity('therapy', 'Therapy'), startMinutes: 14 * 60 };
  const friend = { ...activity('friend', 'Ft w/ Aya'), startMinutes: 10 * 60 };
  const events: GoogleCalendarEvent[] = [
    {
      id: 'event-friend', recurringEventId: 'friend-series', summary: 'Ft w/ Aya',
      updated: syncedAt, start: { dateTime: '2026-08-13T10:00:00Z' },
      end: { dateTime: '2026-08-13T11:00:00Z' },
    },
    {
      id: 'event-therapy', recurringEventId: 'therapy-series', summary: 'Therapy',
      updated: syncedAt, start: { dateTime: '2026-08-13T14:00:00Z' },
      end: { dateTime: '2026-08-13T15:00:00Z' },
    },
  ];

  const preview = buildGoogleCalendarSyncPreview(
    'from_google',
    [therapy, friend],
    [],
    [link('therapy', 'event-friend', 'google'), link('friend', 'event-therapy', 'google')],
    events,
    'UTC',
  );

  expect(preview.changes).toEqual([
    expect.objectContaining({
      title: 'Therapy', action: 'relink', destination: 'ontrack',
      details: expect.arrayContaining([
        { label: 'Time', after: '2:00 PM' },
      ]),
    }),
    expect.objectContaining({
      title: 'Ft w/ Aya', action: 'relink', destination: 'ontrack',
      details: expect.arrayContaining([
        { label: 'Time', after: '10:00 AM' },
      ]),
    }),
  ]);
  expect(preview.changes).not.toContainEqual(expect.objectContaining({
    action: 'update',
  }));
});

it('keeps a genuine remote time edit when no exact replacement event exists', () => {
  const therapy = { ...activity('therapy', 'Therapy'), startMinutes: 14 * 60 };
  const preview = buildGoogleCalendarSyncPreview(
    'from_google',
    [therapy],
    [],
    [link('therapy', 'event-therapy', 'google')],
    [{
      id: 'event-therapy', summary: 'Therapy', updated: '2026-08-13T11:00:00.000Z',
      start: { dateTime: '2026-08-13T10:00:00Z' },
      end: { dateTime: '2026-08-13T11:00:00Z' },
    }],
    'UTC',
  );

  expect(preview.changes).toEqual([
    expect.objectContaining({
      action: 'update',
      destination: 'ontrack',
      details: expect.arrayContaining([
        { label: 'Time', before: '2:00 PM', after: '10:00 AM' },
      ]),
    }),
  ]);
});

it('does not count timestamp-only recurring saves as 147 Google changes', () => {
  const count = 147;
  const activities = Array.from({ length: count }, (_, index) => ({
    ...activity(`therapy-${index}`, 'Therapy', '2026-08-13T12:00:00.000Z'),
    date: '2026-08-13',
    status: index % 2 ? 'completed' as const : 'upcoming' as const,
    categoryId: index % 2 ? 'health' : 'personal',
  }));
  const links = activities.map((item, index) => link(item.id, `event-${index}`));
  const events = activities.map((_item, index) => ({
    id: `event-${index}`,
    summary: 'Therapy',
    updated: syncedAt,
    start: { dateTime: '2026-08-13T10:00:00Z' },
    end: { dateTime: '2026-08-13T11:00:00Z' },
  }));

  expect(buildGoogleCalendarSyncPreview(
    'to_google', activities, [], links, events, 'UTC',
  ).changes).toEqual([]);
});

it('still counts real Google-visible edits when timestamps are unchanged', () => {
  const current = activity('therapy', 'Therapy');
  const preview = buildGoogleCalendarSyncPreview(
    'to_google',
    [current],
    [],
    [link(current.id, 'event-therapy')],
    [{
      id: 'event-therapy', summary: 'Old title', updated: syncedAt,
      start: { dateTime: '2026-08-13T10:00:00Z' },
      end: { dateTime: '2026-08-13T11:00:00Z' },
    }],
    'UTC',
  );

  expect(preview.changes).toEqual([
    expect.objectContaining({ title: 'Therapy', action: 'update', destination: 'google' }),
  ]);
});

it('shows duplicate Google copies as removals and does not also import them', () => {
  const duplicateEvents: GoogleCalendarEvent[] = [
    {
      id: 'event-a', summary: 'Plan', updated: syncedAt,
      extendedProperties: { private: { ontrackActivityId: 'current' } },
    },
    {
      id: 'event-b', summary: 'Plan duplicate', updated: syncedAt,
      extendedProperties: { private: { ontrackActivityId: 'current' } },
    },
  ];

  const preview = buildGoogleCalendarSyncPreview(
    'two_way',
    [activity('current', 'Plan')],
    [],
    [link('current', 'event-a')],
    duplicateEvents,
  );

  expect(preview.changes).toContainEqual(expect.objectContaining({
    title: 'Plan duplicate', action: 'delete', destination: 'google',
  }));
  expect(preview.changes).not.toContainEqual(expect.objectContaining({
    title: 'Plan duplicate', destination: 'ontrack',
  }));
});

it('does not propose removing 102 legitimate Therapy occurrences from a recurring series', () => {
  const count = 102;
  const activities = Array.from({ length: count }, (_, index) =>
    activity(`therapy-${index}`, 'Therapy'));
  const links = activities.map((item, index) => link(item.id, `occurrence-${index}`));
  const events: GoogleCalendarEvent[] = activities.map((_item, index) => ({
    id: `occurrence-${index}`,
    recurringEventId: 'therapy-series',
    summary: 'Therapy',
    updated: syncedAt,
    start: { dateTime: '2026-08-13T10:00:00Z' },
    end: { dateTime: '2026-08-13T11:00:00Z' },
    // Google can inherit one private marker from the recurring parent across
    // all materialized occurrences.
    extendedProperties: { private: { ontrackActivityId: 'therapy-0' } },
  }));

  const preview = buildGoogleCalendarSyncPreview(
    'two_way', activities, [], links, events, 'UTC',
  );

  expect(preview.changes).toEqual([]);
});
