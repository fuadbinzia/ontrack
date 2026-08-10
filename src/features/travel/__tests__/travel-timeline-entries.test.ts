import {
  expandTimelineEntries,
  groupTimelineDaysForPlan,
  groupTimelineEntriesByDate,
  TIMELINE_POST_TRIP_KEY,
  TIMELINE_PRE_TRIP_KEY,
  timelineEntryCaption,
} from '../travel-timeline-entries';
import type { TravelItineraryItem } from '../types';

const outbound: TravelItineraryItem = {
  id: 'flight-out',
  kind: 'flight',
  title: 'Flight EWR → KEF',
  date: '2026-09-08',
  startMinutes: 20 * 60 + 25,
  durationMinutes: 5 * 60 + 50,
  flight: {
    departureAirport: 'EWR',
    arrivalAirport: 'KEF',
  },
};

const rental: TravelItineraryItem = {
  id: 'rental-1',
  kind: 'rental',
  title: 'Hertz Rental · Keflavik International Airport (KEF)',
  date: '2026-09-09',
  startMinutes: 6 * 60 + 30,
  durationMinutes: 60,
  rental: {
    company: 'Hertz',
    pickupLocation: 'Keflavik International Airport (KEF)',
    dropoffLocation: 'Keflavik International Airport (KEF)',
    dropoffDate: '2026-09-14',
    dropoffMinutes: 15 * 60,
  },
};

const inbound: TravelItineraryItem = {
  id: 'flight-in',
  kind: 'flight',
  title: 'Flight KEF → EWR',
  date: '2026-09-14',
  startMinutes: 17 * 60,
  durationMinutes: 6 * 60 + 15,
  flight: {
    departureAirport: 'KEF',
    arrivalAirport: 'EWR',
  },
};

describe('travel timeline entries', () => {
  it('expands flights and rentals into action markers', () => {
    const entries = expandTimelineEntries([outbound, rental, inbound]);
    expect(entries.map((entry) => entry.title)).toEqual([
      'Board Flight',
      'Land',
      'Pick Up Car',
      'Drop Off Car',
      'Board Flight',
      'Land',
    ]);
    expect(entries.map((entry) => ({ date: entry.date, minutes: entry.startMinutes }))).toEqual([
      { date: '2026-09-08', minutes: 20 * 60 + 25 },
      { date: '2026-09-09', minutes: 6 * 60 + 15 },
      { date: '2026-09-09', minutes: 6 * 60 + 30 },
      { date: '2026-09-14', minutes: 15 * 60 },
      { date: '2026-09-14', minutes: 17 * 60 },
      { date: '2026-09-14', minutes: 19 * 60 + 15 },
    ]);
  });

  it('places land and drop-off on the correct days', () => {
    const days = groupTimelineEntriesByDate(
      expandTimelineEntries([outbound, rental, inbound]),
    );
    expect(days.map((day) => day.date)).toEqual([
      '2026-09-08',
      '2026-09-09',
      '2026-09-14',
    ]);
    expect(days[0].entries.map((e) => e.title)).toEqual(['Board Flight']);
    expect(days[1].entries.map((e) => e.title)).toEqual([
      'Land',
      'Pick Up Car',
    ]);
    expect(days[2].entries.map((e) => e.title)).toEqual([
      'Drop Off Car',
      'Board Flight',
      'Land',
    ]);
  });

  it('buckets out-of-range moments into Pre-trip and Post trip', () => {
    const pre: TravelItineraryItem = {
      id: 'm-pre',
      kind: 'moment',
      title: 'Pack',
      date: '2026-09-01',
      startMinutes: 10 * 60,
      durationMinutes: 15,
    };
    const pre2: TravelItineraryItem = {
      id: 'm-pre-2',
      kind: 'moment',
      title: 'Visa',
      date: '2026-09-05',
      startMinutes: 14 * 60,
      durationMinutes: 15,
    };
    const onTrip: TravelItineraryItem = {
      id: 'm-trip',
      kind: 'moment',
      title: 'Harbor',
      date: '2026-09-10',
      startMinutes: 12 * 60,
      durationMinutes: 15,
    };
    const post: TravelItineraryItem = {
      id: 'm-post',
      kind: 'moment',
      title: 'Laundry',
      date: '2026-09-20',
      startMinutes: 9 * 60,
      durationMinutes: 15,
    };
    const sections = groupTimelineDaysForPlan(
      expandTimelineEntries([onTrip, post, pre2, pre]),
      '2026-09-08',
      '2026-09-14',
    );
    expect(sections.map((day) => ({ date: day.date, zone: day.zone }))).toEqual([
      { date: TIMELINE_PRE_TRIP_KEY, zone: 'pre' },
      { date: '2026-09-10', zone: 'trip' },
      { date: TIMELINE_POST_TRIP_KEY, zone: 'post' },
    ]);
    expect(sections[0].entries.map((e) => e.item.id)).toEqual([
      'm-pre',
      'm-pre-2',
    ]);
    expect(sections[0].rangeStart).toBe('2026-09-01');
    expect(sections[0].rangeEnd).toBe('2026-09-05');
    expect(sections[2].entries.map((e) => e.item.id)).toEqual(['m-post']);
  });

  it('formats action captions without the full span', () => {
    const [board, land] = expandTimelineEntries([outbound]);
    expect(timelineEntryCaption(board, 'mdy')).toMatch(/8:25 PM/);
    expect(timelineEntryCaption(board, 'mdy')).toContain('EWR → KEF');
    expect(timelineEntryCaption(land, 'mdy')).toMatch(/6:15 AM/);
    expect(timelineEntryCaption(land, 'mdy')).toContain('KEF');
    expect(timelineEntryCaption(land, 'mdy')).not.toMatch(/8:25 PM/);

    const [pickup, dropoff] = expandTimelineEntries([rental]);
    expect(timelineEntryCaption(pickup, 'mdy')).toBe('Sep 9 · 6:30 AM · KEF');
    expect(timelineEntryCaption(dropoff, 'mdy')).toBe('Sep 14 · 3:00 PM · KEF');
    expect(timelineEntryCaption(pickup, 'mdy')).not.toContain(
      'Keflavik International Airport',
    );
  });

  it('uses medium month dates on board captions', () => {
    const flightCaption = timelineEntryCaption(
      {
        key: outbound.id,
        item: outbound,
        phase: 'default',
        date: outbound.date,
        startMinutes: outbound.startMinutes,
        title: outbound.title,
      },
      'mdy',
    );
    expect(flightCaption).toContain('Sep 8');
    expect(flightCaption).not.toMatch(/\b9\/8\b/);

    const stay: TravelItineraryItem = {
      id: 'stay-1',
      kind: 'stay',
      title: 'Hotel',
      date: '2026-09-27',
      startMinutes: 15 * 60,
      durationMinutes: 60,
      stay: {
        checkoutDate: '2026-09-29',
        checkoutMinutes: 11 * 60,
      },
    };
    const stayCaption = timelineEntryCaption(
      {
        key: stay.id,
        item: stay,
        phase: 'default',
        date: stay.date,
        startMinutes: stay.startMinutes,
        title: stay.title,
      },
      'mdy',
    );
    expect(stayCaption).toBe('Sep 27 · 3:00 PM → Sep 29 · 11:00 AM');
  });

  it('keeps activities as a single marker with their title', () => {
    const activity: TravelItineraryItem = {
      id: 'act-1',
      kind: 'activity',
      title: 'Blue Lagoon',
      date: '2026-09-10',
      startMinutes: 10 * 60,
      durationMinutes: 120,
    };
    expect(expandTimelineEntries([activity])).toEqual([
      expect.objectContaining({
        key: 'act-1',
        phase: 'default',
        title: 'Blue Lagoon',
      }),
    ]);
  });

  it('expands transport into departure, timed stops, and arrival', () => {
    const transport: TravelItineraryItem = {
      id: 'transport-1',
      kind: 'transport',
      title: 'Road trip',
      date: '2026-09-10',
      startMinutes: 8 * 60,
      durationMinutes: 10 * 60,
      transport: {
        mode: 'driving',
        origin: 'New York',
        destination: 'Washington',
        arrivalDate: '2026-09-10',
        arrivalMinutes: 18 * 60,
        stops: [
          { id: 'timed', name: 'Philadelphia', arrivalDate: '2026-09-10', arrivalMinutes: 11 * 60 },
          { id: 'untimed', name: 'Scenic overlook' },
        ],
      },
    };
    expect(expandTimelineEntries([transport]).map((entry) => entry.phase)).toEqual([
      'depart', 'stop', 'arrive',
    ]);
  });
});
