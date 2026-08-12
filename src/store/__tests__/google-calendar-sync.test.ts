import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { useSchedule } from '@/store/schedule';
import type { Activity } from '@/types/models';

const base: Activity = {
  id: 'local-1',
  title: 'Local event',
  date: '2026-08-12',
  startMinutes: 600,
  durationMinutes: 60,
  categoryId: 'personal',
  status: 'upcoming',
  createdAt: '2026-08-12T10:00:00.000Z',
  updatedAt: '2026-08-12T10:00:00.000Z',
};

beforeEach(() => {
  useSchedule.setState({
    seeded: true,
    activities: [], meals: [], workouts: [], workSessions: [], movies: [],
    categories: DEFAULT_CATEGORIES,
    googleCalendarDeletions: [],
  });
});

it('preserves a newer local edit while accepting link metadata from an in-flight sync', () => {
  const linked = {
    ...base,
    title: 'Sent to Google',
    googleCalendar: { calendarId: 'primary', eventId: 'event-1', origin: 'ontrack' as const, lastSyncedAt: base.updatedAt },
  };
  useSchedule.setState({ activities: [{ ...base, title: 'Edited during sync', updatedAt: '2026-08-12T11:00:00.000Z' }] });

  useSchedule.getState().replaceGoogleCalendarActivities([linked]);

  expect(useSchedule.getState().activities[0]).toEqual(expect.objectContaining({
    title: 'Edited during sync',
    updatedAt: '2026-08-12T11:00:00.000Z',
    googleCalendar: linked.googleCalendar,
  }));
});

it('queues an intentional Google-linked deletion until the provider acknowledges it', () => {
  useSchedule.setState({ activities: [{
    ...base,
    id: 'google-import',
    googleCalendar: { calendarId: 'primary', eventId: 'event-1', origin: 'google', lastSyncedAt: base.updatedAt },
  }] });

  useSchedule.getState().deleteActivity('google-import');
  expect(useSchedule.getState().googleCalendarDeletions).toEqual([{
    activityId: 'google-import', calendarId: 'primary', eventId: 'event-1', origin: 'google',
  }]);

  useSchedule.getState().clearGoogleCalendarDeletions(['google-import']);
  expect(useSchedule.getState().googleCalendarDeletions).toEqual([]);
});

it('does not resurrect an event deleted while a sync response was in flight', () => {
  const linked = {
    ...base,
    googleCalendar: { calendarId: 'primary', eventId: 'event-1', origin: 'ontrack' as const, lastSyncedAt: base.updatedAt },
  };
  useSchedule.setState({ activities: [linked] });
  useSchedule.getState().deleteActivity(linked.id);

  useSchedule.getState().replaceGoogleCalendarActivities([linked]);

  expect(useSchedule.getState().activities).toEqual([]);
  expect(useSchedule.getState().googleCalendarDeletions).toEqual([
    expect.objectContaining({ activityId: linked.id, eventId: 'event-1' }),
  ]);
});

it('does not make a duplicate share the original Google event link', () => {
  useSchedule.setState({ activities: [{
    ...base,
    googleCalendar: { calendarId: 'primary', eventId: 'event-1', origin: 'ontrack', lastSyncedAt: base.updatedAt },
  }] });

  useSchedule.getState().duplicateActivity(base.id);

  const duplicate = useSchedule.getState().activities.find((activity) => activity.id !== base.id);
  expect(duplicate?.googleCalendar).toBeUndefined();
});

it('keeps Google link metadata when the event editor saves a linked activity', () => {
  const googleCalendar = {
    calendarId: 'primary', eventId: 'event-1', origin: 'google' as const, lastSyncedAt: base.updatedAt,
  };
  useSchedule.setState({ activities: [{ ...base, googleCalendar }] });

  useSchedule.getState().saveEvent({
    id: base.id,
    activity: {
      date: base.date,
      title: 'Edited linked event',
      categoryId: base.categoryId,
      startMinutes: base.startMinutes,
      durationMinutes: base.durationMinutes,
      status: base.status,
    },
    detailKind: 'generic',
  });

  expect(useSchedule.getState().activities[0]).toEqual(expect.objectContaining({
    title: 'Edited linked event',
    googleCalendar,
  }));
});

it('reconciles linked activities while preserving ordinary local entries', () => {
  const imported: Activity = {
    ...base,
    id: 'google-1',
    title: 'Old Google title',
    googleCalendar: { calendarId: 'primary', eventId: 'event-1', origin: 'google', lastSyncedAt: base.updatedAt },
  };
  useSchedule.setState({ activities: [base, imported] });

  useSchedule.getState().replaceGoogleCalendarActivities([
    { ...base, googleCalendar: { calendarId: 'primary', eventId: 'event-2', origin: 'ontrack', lastSyncedAt: base.updatedAt } },
    { ...imported, title: 'Updated Google title' },
  ]);

  expect(useSchedule.getState().activities).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'local-1', googleCalendar: expect.objectContaining({ origin: 'ontrack' }) }),
    expect.objectContaining({ id: 'google-1', title: 'Updated Google title' }),
  ]));
});

it('removes only Google-origin imports during cleanup', () => {
  useSchedule.setState({ activities: [
    base,
    { ...base, id: 'google-1', googleCalendar: { calendarId: 'primary', eventId: 'event-1', origin: 'google', lastSyncedAt: base.updatedAt } },
    { ...base, id: 'export-1', googleCalendar: { calendarId: 'primary', eventId: 'event-2', origin: 'ontrack', lastSyncedAt: base.updatedAt } },
  ] });

  useSchedule.getState().removeGoogleCalendarImports();

  expect(useSchedule.getState().activities.map((item) => item.id)).toEqual(['local-1', 'export-1']);
});
