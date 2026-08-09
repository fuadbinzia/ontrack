import { activityEndMinutesFromItem } from '@/features/travel/use-travel-plan-detail-add-form';
import type { TravelItineraryItem } from '@/features/travel/types';

function activity(partial: Partial<TravelItineraryItem>): TravelItineraryItem {
  return {
    id: 'item-1',
    kind: 'activity',
    title: 'Tour',
    date: '2026-09-08',
    startMinutes: 9 * 60,
    durationMinutes: 60,
    ...partial,
  };
}

describe('activityEndMinutesFromItem', () => {
  it('adds duration to start', () => {
    expect(
      activityEndMinutesFromItem(
        activity({ startMinutes: 9 * 60, durationMinutes: 90 }),
      ),
    ).toBe(10 * 60 + 30);
  });

  it('clamps before midnight', () => {
    expect(
      activityEndMinutesFromItem(
        activity({ startMinutes: 23 * 60, durationMinutes: 120 }),
      ),
    ).toBe(24 * 60 - 1);
  });
});
