import type { EventDetails } from '@/services/events';
import type { Activity, ActivityCategory } from '@/types/models';

import { findCalendarEventExcitement } from '../calendar-event-excitement';

const categories: ActivityCategory[] = [
  {
    id: 'event', name: 'Event', icon: 'event', colorKey: 'event',
    supportsPhotos: false, supportsTimer: false, detailKind: 'event',
  },
  {
    id: 'personal', name: 'Personal', icon: 'calendar', colorKey: 'personal',
    supportsPhotos: false, supportsTimer: false, detailKind: 'generic',
  },
];

function activity(patch: Partial<Activity> = {}): Activity {
  return {
    id: 'event-1', date: '2026-08-15', title: 'UFC 330: Rivera vs. Lee',
    categoryId: 'personal', startMinutes: 21 * 60, durationMinutes: 180,
    status: 'upcoming', createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z', ...patch,
  };
}

function details(patch: Partial<EventDetails> = {}): EventDetails {
  return {
    activityId: 'event-1', provider: 'espn', providerEventId: 'ufc-330', kind: 'ufc',
    sourceName: 'ESPN', participants: [], broadcasts: [], status: 'scheduled',
    importMode: 'manual', syncState: 'linked', lastSyncedAt: '2026-08-01T00:00:00.000Z',
    ...patch,
  };
}

describe('findCalendarEventExcitement', () => {
  it('turns a same-day fight into exciting copy and a YouTube updates search', () => {
    const result = findCalendarEventExcitement({
      activities: [activity()], categories, eventDetails: [],
      today: '2026-08-15', currentMinutes: 12 * 60,
    });
    expect(result).toMatchObject({ kind: 'combat', eyebrow: 'Tonight', headline: 'Fight Night Is Here' });
    expect(result?.message).toContain('UFC 330: Rivera vs. Lee is almost here');
    expect(result?.youtubeUrl).toBe(
      'https://www.youtube.com/results?search_query=UFC%20330%3A%20Rivera%20vs.%20Lee%20latest%20news%20preview%20updates',
    );
  });

  it('recognizes provider-linked events even when their titles have no keywords', () => {
    const result = findCalendarEventExcitement({
      activities: [activity({ date: '2026-08-18', title: 'Rivera at Lee' })], categories,
      eventDetails: [details({ kind: 'sports' })], today: '2026-08-15', currentMinutes: 12 * 60,
    });
    expect(result).toMatchObject({ kind: 'sports', eyebrow: 'In 3 Days', headline: 'The Countdown Is On' });
  });

  it('does not hype routine calendar appointments', () => {
    expect(findCalendarEventExcitement({
      activities: [activity({ title: 'Dentist Appointment' })], categories, eventDetails: [],
      today: '2026-08-15', currentMinutes: 12 * 60,
    })).toBeUndefined();
  });

  it('skips finished, cancelled, and distant events', () => {
    const finished = activity({ startMinutes: 8 * 60, durationMinutes: 60 });
    const cancelled = activity({ id: 'event-2', title: 'Concert Downtown' });
    const distant = activity({ id: 'event-3', date: '2026-09-20', title: 'Big Game' });
    expect(findCalendarEventExcitement({
      activities: [finished, cancelled, distant], categories,
      eventDetails: [details({ activityId: 'event-2', status: 'cancelled' })],
      today: '2026-08-15', currentMinutes: 12 * 60,
    })).toBeUndefined();
  });

  it('celebrates personal milestones without offering irrelevant video updates', () => {
    const result = findCalendarEventExcitement({
      activities: [activity({ title: 'Birthday Party' })], categories, eventDetails: [],
      today: '2026-08-15', currentMinutes: 12 * 60,
    });
    expect(result?.kind).toBe('celebration');
    expect(result?.youtubeUrl).toBeUndefined();
  });
});
