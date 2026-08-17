import {
  travelRangeScheduleDraft,
  validateTravelRangeSchedule,
} from '@/features/travel/travel-range-schedule';
import type { TravelItineraryItem } from '@/features/travel/types';

const stay: TravelItineraryItem = {
  id: 'stay-1',
  kind: 'stay',
  title: 'Centerhotel Miðgarður',
  date: '2026-09-09',
  startMinutes: 12 * 60,
  durationMinutes: 60,
};

describe('travel range schedules', () => {
  it('builds a draft from the item start and structured end', () => {
    expect(
      travelRangeScheduleDraft(stay, '2026-09-14', 12 * 60),
    ).toEqual({
      startDate: '2026-09-09',
      startMinutes: 12 * 60,
      endDate: '2026-09-14',
      endMinutes: 12 * 60,
    });
  });

  it('returns the itinerary start when the range is valid', () => {
    expect(
      validateTravelRangeSchedule(
        {
          startDate: '2026-09-09',
          startMinutes: 12 * 60,
          endDate: '2026-09-14',
          endMinutes: 12 * 60,
        },
        { start: 'check-in', end: 'check-out' },
      ),
    ).toEqual({
      ok: true,
      value: { date: '2026-09-09', startMinutes: 12 * 60 },
    });
  });

  it('rejects a drop-off before pick-up', () => {
    expect(
      validateTravelRangeSchedule(
        {
          startDate: '2026-09-14',
          startMinutes: 15 * 60,
          endDate: '2026-09-14',
          endMinutes: 14 * 60,
        },
        { start: 'pick-up', end: 'drop-off' },
      ),
    ).toEqual({
      ok: false,
      error: 'Drop-off needs to be after pick-up.',
    });
  });
});
