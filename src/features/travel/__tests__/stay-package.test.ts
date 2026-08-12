import {
  applyStayPackagesToPlan,
  normalizeStayPackage,
  stayItemToPackage,
  stayPackagesFromPlan,
} from '../stay-package';
import type { TravelItineraryItem, TravelPlan } from '../types';

function plan(overrides: Partial<TravelPlan> = {}): TravelPlan {
  return {
    id: 'plan-1',
    title: 'Brooklyn',
    destination: 'Brooklyn',
    startDate: '2026-09-12',
    endDate: '2026-09-14',
    itinerary: [],
    participants: [],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function stayItem(overrides: Partial<TravelItineraryItem> = {}): TravelItineraryItem {
  return {
    id: 'stay-1',
    kind: 'stay',
    title: 'North Harbor Loft',
    date: '2026-09-12',
    startMinutes: 16 * 60,
    durationMinutes: 12 * 60,
    details: '12 River St, Brooklyn',
    stay: { confirmationCode: 'HM3DMFZH2T', checkoutDate: '2026-09-14' },
    ...overrides,
  };
}

describe('stay package', () => {
  it('maps a stay itinerary item to StayPackage', () => {
    const trip = plan({ itinerary: [stayItem()] });
    const pkg = stayItemToPackage(trip, stayItem(), 'Alex Rivera');
    expect(pkg).toMatchObject({
      version: 1,
      propertyName: 'North Harbor Loft',
      address: '12 River St, Brooklyn',
      checkInDate: '2026-09-12',
      checkOutDate: '2026-09-14',
      confirmationCode: 'HM3DMFZH2T',
      guestDisplayName: 'Alex Rivera',
      ontrackPlanId: 'plan-1',
      ontrackItemId: 'stay-1',
    });
  });

  it('drops invalid packages', () => {
    expect(normalizeStayPackage({ propertyName: 'Loft' })).toBeUndefined();
    expect(normalizeStayPackage({ propertyName: 'Loft', checkInDate: 'nope' })).toBeUndefined();
    expect(
      normalizeStayPackage({
        propertyName: 'Loft',
        checkInDate: '2026-09-12',
        bookingUrl: 'javascript:alert(1)',
      }),
    ).toBeUndefined();
  });

  it('exports only stay items', () => {
    const trip = plan({
      itinerary: [
        stayItem(),
        { id: 'flight-1', kind: 'flight', title: 'JFK → SFO', date: '2026-09-12', startMinutes: 480, durationMinutes: 360 },
      ],
    });
    expect(stayPackagesFromPlan(trip)).toHaveLength(1);
  });

  it('upserts a new stay and skips older writes', () => {
    const trip = plan({ itinerary: [stayItem({ sharedUpdatedAt: '2026-08-12T12:00:00.000Z' })] });
    const created = applyStayPackagesToPlan(trip, [
      {
        version: 1,
        updatedAt: '2026-08-12T18:00:00.000Z',
        propertyName: 'Snow Cabin',
        checkInDate: '2026-09-20',
        straiawayReservationId: 'res_9',
      },
    ]);
    expect(created?.itinerary.some((item) => item.stay?.straiawayReservationId === 'res_9')).toBe(true);

    const skipped = applyStayPackagesToPlan(created!, [
      {
        version: 1,
        updatedAt: '2026-08-01T00:00:00.000Z',
        propertyName: 'North Harbor Loft',
        checkInDate: '2026-09-12',
        ontrackItemId: 'stay-1',
        notes: 'stale',
      },
    ]);
    expect(skipped).toBeUndefined();
  });
});
