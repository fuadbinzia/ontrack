import {
    expandTimelineEntries,
    groupTimelineEntriesByDate,
} from '../travel-timeline-entries';
import {
    autoCollapsedTimelineDates,
    isTimelineEntryPast,
    resolveCollapsedTimelineDates,
    resolveJourneyTraveler,
    summarizeTimelineProgress,
    timelineClockSample,
    timelineDayPhase,
} from '../travel-timeline-progress';
import type { TravelItineraryItem } from '../types';

const days = [
  {
    date: '2026-09-27',
    entries: [{ startMinutes: 10 * 60 + 30 }, { startMinutes: 18 * 60 + 30 }],
  },
  {
    date: '2026-09-28',
    entries: [{ startMinutes: 6 * 60 + 30 }],
  },
  {
    date: '2026-09-29',
    entries: [{ startMinutes: 11 * 60 }, { startMinutes: 16 * 60 + 30 }],
  },
  {
    date: '2026-09-30',
    entries: [{ startMinutes: 90 }],
  },
];

function travelerDays(items: TravelItineraryItem[]) {
  return groupTimelineEntriesByDate(expandTimelineEntries(items));
}

const transportThenFlightStay: TravelItineraryItem[] = [
  {
    id: 'item-drive',
    kind: 'transport',
    title: 'Drive to airport',
    date: '2026-09-27',
    startMinutes: 8 * 60,
    durationMinutes: 60,
    transport: {
      mode: 'driving',
      origin: 'Home',
      destination: 'Airport',
      arrivalDate: '2026-09-27',
      arrivalMinutes: 9 * 60,
    },
  },
  {
    id: 'item-flight',
    kind: 'flight',
    title: 'Flight',
    date: '2026-09-27',
    startMinutes: 10 * 60 + 30,
    durationMinutes: 180,
    flight: {
      departureAirport: 'JFK',
      arrivalAirport: 'LAX',
    },
  },
  {
    id: 'item-stay',
    kind: 'stay',
    title: 'Hotel',
    date: '2026-09-27',
    startMinutes: 16 * 60,
    durationMinutes: 60,
    stay: {
      checkoutDate: '2026-09-30',
      checkoutMinutes: 11 * 60,
    },
  },
];

const flightOnly: TravelItineraryItem[] = [
  {
    id: 'item-flight-only',
    kind: 'flight',
    title: 'Flight',
    date: '2026-09-27',
    startMinutes: 10 * 60 + 30,
    durationMinutes: 180,
    flight: {
      departureAirport: 'JFK',
      arrivalAirport: 'LAX',
    },
  },
];

describe('travel timeline progress', () => {
  it('marks entries before now as past', () => {
    const now = timelineClockSample('2026-09-28', 8 * 60);
    expect(
      isTimelineEntryPast({ date: '2026-09-27', startMinutes: 18 * 60 }, now),
    ).toBe(true);
    expect(
      isTimelineEntryPast({ date: '2026-09-28', startMinutes: 6 * 60 + 30 }, now),
    ).toBe(true);
    expect(
      isTimelineEntryPast({ date: '2026-09-28', startMinutes: 12 * 60 }, now),
    ).toBe(false);
  });

  it('classifies day phases and auto-collapses every timeline day', () => {
    const now = timelineClockSample('2026-09-28', 8 * 60);
    expect(timelineDayPhase('2026-09-27', days[0].entries, now)).toBe('past');
    expect(timelineDayPhase('2026-09-28', days[1].entries, now)).toBe('past');
    expect(timelineDayPhase('2026-09-29', days[2].entries, now)).toBe(
      'upcoming',
    );

    const midDay = timelineClockSample('2026-09-29', 12 * 60);
    expect(timelineDayPhase('2026-09-29', days[2].entries, midDay)).toBe(
      'current',
    );

    expect([...autoCollapsedTimelineDates(days, now)].sort()).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
    ]);
  });

  it('keeps user-expanded days open after remount / clock sync', () => {
    const autoCollapsed = autoCollapsedTimelineDates(days);
    const resolved = resolveCollapsedTimelineDates({
      days,
      autoCollapsed,
      currentCollapsed: new Set(['2026-09-28', '2026-09-29', '2026-09-30']),
      userTouched: new Set(['2026-09-27']),
    });
    expect(resolved.has('2026-09-27')).toBe(false);
    expect(resolved.has('2026-09-28')).toBe(true);
    expect(resolved.has('2026-09-29')).toBe(true);
    expect(resolved.has('2026-09-30')).toBe(true);
  });

  it('summarizes upcoming, in-progress, and complete trips', () => {
    const upcoming = summarizeTimelineProgress({
      planStartDate: '2026-09-27',
      planEndDate: '2026-09-30',
      days,
      now: timelineClockSample('2026-09-01', 12 * 60),
    });
    expect(upcoming.tripPhase).toBe('upcoming');
    expect(upcoming.label).toContain('Starts in');
    expect(upcoming.progress).toBe(0);

    const inProgress = summarizeTimelineProgress({
      planStartDate: '2026-09-27',
      planEndDate: '2026-09-30',
      days,
      now: timelineClockSample('2026-09-29', 12 * 60),
    });
    expect(inProgress.tripPhase).toBe('in_progress');
    expect(inProgress.label).toBe('Day 3 of 4');
    expect(inProgress.completedDays).toBe(2);
    expect(inProgress.progress).toBeCloseTo(0.5);

    const complete = summarizeTimelineProgress({
      planStartDate: '2026-09-27',
      planEndDate: '2026-09-30',
      days,
      now: timelineClockSample('2026-10-01', 9 * 60),
    });
    expect(complete.tripPhase).toBe('complete');
    expect(complete.label).toBe('Trip complete');
    expect(complete.progress).toBe(1);
  });

  describe('resolveJourneyTraveler', () => {
    it('uses planning far from the start', () => {
      const travelerDaysList = travelerDays(transportThenFlightStay);
      const traveler = resolveJourneyTraveler({
        planStartDate: '2026-09-27',
        planEndDate: '2026-09-30',
        days: travelerDaysList,
        now: timelineClockSample('2026-08-01', 12 * 60),
      });
      expect(traveler.beat).toBe('planning');
      expect(traveler.icon).toBe('calendar');
      expect(traveler.progress).toBeLessThan(0.05);
    });

    it('uses packing in the two-week window', () => {
      const traveler = resolveJourneyTraveler({
        planStartDate: '2026-09-27',
        planEndDate: '2026-09-30',
        days: travelerDays(transportThenFlightStay),
        now: timelineClockSample('2026-09-17', 12 * 60),
      });
      expect(traveler.beat).toBe('packing');
      expect(traveler.icon).toBe('backpack');
      expect(traveler.progress).toBeGreaterThan(0.05);
      expect(traveler.progress).toBeLessThanOrEqual(0.18);
    });

    it('heads out with the first transport icon the day before', () => {
      const traveler = resolveJourneyTraveler({
        planStartDate: '2026-09-27',
        planEndDate: '2026-09-30',
        days: travelerDays(transportThenFlightStay),
        now: timelineClockSample('2026-09-26', 12 * 60),
      });
      expect(traveler.beat).toBe('heading_out');
      expect(traveler.icon).toBe('vehicles');
    });

    it('heads out with a flight icon when there is no transport', () => {
      const traveler = resolveJourneyTraveler({
        planStartDate: '2026-09-27',
        planEndDate: '2026-09-30',
        days: travelerDays(flightOnly),
        now: timelineClockSample('2026-09-26', 12 * 60),
      });
      expect(traveler.beat).toBe('heading_out');
      expect(traveler.icon).toBe('flight');
    });

    it('points at stay between landing and check-in', () => {
      // Land ~13:30; check-in 16:00 — mid-afternoon gap.
      const traveler = resolveJourneyTraveler({
        planStartDate: '2026-09-27',
        planEndDate: '2026-09-30',
        days: travelerDays(transportThenFlightStay),
        now: timelineClockSample('2026-09-27', 14 * 60 + 30),
      });
      expect(traveler.beat).toBe('stay');
      expect(traveler.icon).toBe('lodging');
      expect(traveler.progress).toBeGreaterThan(0);
      expect(traveler.progress).toBeLessThan(1);
    });

    it('completes at the end of the track', () => {
      const traveler = resolveJourneyTraveler({
        planStartDate: '2026-09-27',
        planEndDate: '2026-09-30',
        days: travelerDays(transportThenFlightStay),
        now: timelineClockSample('2026-10-01', 9 * 60),
      });
      expect(traveler.beat).toBe('complete');
      expect(traveler.icon).toBe('backpack');
      expect(traveler.progress).toBe(1);
    });
  });
});
