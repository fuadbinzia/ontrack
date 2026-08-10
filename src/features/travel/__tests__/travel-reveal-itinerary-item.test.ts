import {
  buildRevealItineraryUiPatch,
  firstCreatedItineraryItem,
} from '@/features/travel/travel-reveal-itinerary-item';
import type { TravelItineraryItem } from '@/features/travel/types';

function moment(id: string, date: string): TravelItineraryItem {
  return {
    id,
    kind: 'moment',
    title: 'Sunset',
    date,
    startMinutes: 18 * 60,
    durationMinutes: 15,
  };
}

describe('travel-reveal-itinerary-item', () => {
  it('opens timeline + day and expands only the new stop', () => {
    const existing = moment('a', '2026-08-10');
    const created = moment('b', '2026-08-11');
    const { patch, focusEntryKey } = buildRevealItineraryUiPatch({
      target: { itemId: 'b', date: '2026-08-11', kind: 'moment' },
      sectionExpanded: { timeline: false },
      minimizedItemIds: undefined,
      defaultMinimizedItemIds: ['a', 'b'],
      collapsedDayDates: ['2026-08-10', '2026-08-11'],
      dayCollapseTouched: [],
      itinerary: [existing, created],
    });

    expect(focusEntryKey).toBe('b');
    expect(patch.sectionExpanded?.timeline).toBe(true);
    expect(patch.collapsedDayDates).toEqual(['2026-08-10']);
    expect(patch.dayCollapseTouched).toEqual(['2026-08-11']);
    expect(patch.minimizedItemIds).toEqual(['a']);
  });

  it('opens transport flights for a new flight', () => {
    const flight: TravelItineraryItem = {
      id: 'f1',
      kind: 'flight',
      title: 'Flight',
      date: '2026-08-12',
      startMinutes: 9 * 60,
      durationMinutes: 120,
    };
    const { patch } = buildRevealItineraryUiPatch({
      target: { itemId: 'f1', date: '2026-08-12', kind: 'flight' },
      sectionExpanded: {},
      minimizedItemIds: ['f1', 'f1:board', 'f1:land'],
      defaultMinimizedItemIds: [],
      collapsedDayDates: [],
      dayCollapseTouched: ['2026-08-12'],
      itinerary: [flight],
    });

    expect(patch.sectionExpanded).toMatchObject({
      timeline: true,
      transport: true,
      flights: true,
    });
    expect(patch.minimizedItemIds).not.toContain('f1:board');
    expect(patch.minimizedItemIds).not.toContain('f1:land');
  });

  it('opens transport events for a new event', () => {
    const event: TravelItineraryItem = {
      id: 'e1',
      kind: 'event',
      title: 'Concert',
      date: '2026-08-13',
      startMinutes: 20 * 60,
      durationMinutes: 120,
    };
    const { patch } = buildRevealItineraryUiPatch({
      target: { itemId: 'e1', date: '2026-08-13', kind: 'event' },
      sectionExpanded: {},
      minimizedItemIds: ['e1'],
      defaultMinimizedItemIds: [],
      collapsedDayDates: [],
      dayCollapseTouched: ['2026-08-13'],
      itinerary: [event],
    });

    expect(patch.sectionExpanded).toMatchObject({
      timeline: true,
      transport: true,
      events: true,
    });
  });

  it('does not collapse other expanded stops when prefs already exist', () => {
    const existing = moment('a', '2026-08-10');
    const created = moment('b', '2026-08-11');
    const { patch } = buildRevealItineraryUiPatch({
      target: { itemId: 'b', date: '2026-08-11', kind: 'moment' },
      sectionExpanded: { timeline: true },
      // `a` intentionally omitted → currently expanded
      minimizedItemIds: ['other'],
      defaultMinimizedItemIds: ['a', 'b'],
      collapsedDayDates: [],
      dayCollapseTouched: [],
      itinerary: [existing, created],
    });

    expect(patch.minimizedItemIds).toEqual(['other']);
    expect(patch.minimizedItemIds).not.toContain('a');
  });

  it('finds the first created itinerary item', () => {
    const before = [moment('a', '2026-08-10')];
    const after = [moment('a', '2026-08-10'), moment('b', '2026-08-11')];
    expect(firstCreatedItineraryItem(before, after)?.id).toBe('b');
    expect(firstCreatedItineraryItem(after, after)).toBeUndefined();
  });
});
