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
  });
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
