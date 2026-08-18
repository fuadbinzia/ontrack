import {
  maintenanceDueCount,
  nextTravelPlan,
  overviewAttentionItems,
  plantsDue,
  remainingActivities,
  upcomingBills,
} from '../overview-summary';

describe('overview summary', () => {
  it('keeps unfinished in-progress and later activities in start order', () => {
    const base = {
      categoryId: 'personal',
      status: 'upcoming' as const,
      durationMinutes: 60,
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
    };
    const result = remainingActivities(
      [
        {
          ...base,
          id: 'past',
          title: 'Past',
          date: '2026-08-13',
          startMinutes: 480,
        },
        {
          ...base,
          id: 'now',
          title: 'Now',
          date: '2026-08-13',
          startMinutes: 600,
        },
        {
          ...base,
          id: 'later',
          title: 'Later',
          date: '2026-08-13',
          startMinutes: 720,
        },
        {
          ...base,
          id: 'done',
          title: 'Done',
          date: '2026-08-13',
          startMinutes: 800,
          status: 'completed' as const,
        },
      ],
      '2026-08-13',
      650,
    );
    expect(result.map((activity) => activity.id)).toEqual(['now', 'later']);
  });

  it('names every item contributing to the attention count', () => {
    const items = overviewAttentionItems({
      activities: [
        {
          id: 'event',
          title: 'Therapy',
          date: '2026-08-13',
          startMinutes: 840,
          durationMinutes: 60,
          categoryId: 'personal',
          status: 'upcoming',
          createdAt: '2026-08-13T00:00:00.000Z',
          updatedAt: '2026-08-13T00:00:00.000Z',
        },
      ],
      overdueBills: [
        {
          id: 'bill',
          name: 'Internet',
          amount: 80,
          currency: 'USD',
          cadence: 'monthly',
          nextDue: '2026-08-13',
          categoryId: 'home',
          entityId: 'personal',
          kind: 'bill',
          active: true,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
      ],
      duePlants: [
        {
          id: 'plant',
          nickname: 'Monstera',
          nextWateringAt: '2026-08-13T09:00:00.000Z',
        },
      ] as never,
      vehicles: [
        {
          id: 'vehicle',
          nickname: 'Roadster',
          odometerMiles: 15_000,
          maintenanceSchedules: [
            {
              id: 'oil',
              title: 'Oil change',
              intervalMiles: 5_000,
              lastDoneMiles: 10_000,
              updatedAt: '2026-08-01T00:00:00.000Z',
            },
          ],
        },
      ] as never,
      dateKey: '2026-08-13',
    });

    expect(items).toEqual([
      {
        key: 'activity:event:2026-08-13T00:00:00.000Z',
        label: 'Therapy · 2:00 PM',
      },
      { key: 'bill:bill:2026-08-13', label: 'Internet · Bill due' },
      {
        key: 'plant:plant:2026-08-13T09:00:00.000Z',
        label: 'Monstera · Watering due',
      },
      {
        key: 'vehicle:vehicle:oil:2026-08-01T00:00:00.000Z',
        label: 'Roadster · Oil change due',
      },
    ]);
  });

  it('selects the nearest current or future trip and ignores past trips', () => {
    const plan = (id: string, startDate: string, endDate: string) => ({
      id,
      title: id,
      destination: id,
      startDate,
      endDate,
      itinerary: [],
      participants: [],
      baseCurrency: 'USD',
      expenses: [],
      createdAt: startDate,
      updatedAt: startDate,
    });
    expect(
      nextTravelPlan(
        [
          plan('future', '2026-09-01', '2026-09-05'),
          plan('past', '2026-07-01', '2026-07-05'),
          plan('mixedNow', '2026-08-14T00:00:00.000Z', '2026-08-15T00:00:00.000Z'),
          plan('current', '2026-08-10', '2026-08-15'),
        ],
        '2026-08-13',
      )?.id,
    ).toBe('current');
  });

  it('chooses nearest trip when startDate mixes date-only and timestamp strings', () => {
    const plan = (id: string, startDate: string, endDate: string) => ({
      id,
      title: id,
      destination: id,
      startDate,
      endDate,
      itinerary: [],
      participants: [],
      baseCurrency: 'USD',
      expenses: [],
      createdAt: startDate,
      updatedAt: startDate,
    });
    expect(
      nextTravelPlan(
        [
          plan('tomorrow', '2026-08-14T00:00:00.000Z', '2026-08-14T00:00:00.000Z'),
          plan('farther', '2026-08-20', '2026-08-25'),
        ],
        '2026-08-13',
      )?.id,
    ).toBe('tomorrow');
  });

  it('sorts only active, not-yet-past bills', () => {
    const bill = (id: string, nextDue: string, active = true) => ({
      id,
      name: id,
      amount: 10,
      currency: 'USD',
      cadence: 'monthly' as const,
      nextDue,
      categoryId: 'home',
      entityId: 'personal',
      kind: 'bill' as const,
      active,
      createdAt: nextDue,
      updatedAt: nextDue,
    });
    expect(
      upcomingBills(
        [
          bill('later', '2026-08-20'),
          bill('inactive', '2026-08-14', false),
          bill('past', '2026-08-01'),
          bill('next', '2026-08-15'),
        ],
        '2026-08-13',
      ).map((item) => item.id),
    ).toEqual(['next', 'later']);
  });

  it('sorts upcoming bills by date order with mixed timestamp and date-only nextDue keys', () => {
    const bill = (id: string, nextDue: string, active = true) => ({
      id,
      name: id,
      amount: 10,
      currency: 'USD',
      cadence: 'monthly' as const,
      nextDue,
      categoryId: 'home',
      entityId: 'personal',
      kind: 'bill' as const,
      active,
      createdAt: nextDue,
      updatedAt: nextDue,
    });
    expect(
      upcomingBills(
        [
          bill('nearFutureTimestamp', '2026-08-14T00:00:00.000Z'),
          bill('past', '2026-08-01T00:00:00.000Z', true),
          bill('alsoNearDate', '2026-08-14'),
          bill('later', '2026-08-20'),
        ],
        '2026-08-13',
      ).map((item) => item.id),
    ).toEqual(['alsoNearDate', 'nearFutureTimestamp', 'later']);
  });

  it('counts due plant care and vehicle maintenance boundaries', () => {
    const plant = (id: string, due: string) => ({ id, nextWateringAt: due });
    expect(
      plantsDue(
        [
          plant('due', '2026-08-13T09:00:00Z'),
          plant('later', '2026-08-14T09:00:00Z'),
        ] as never,
        '2026-08-13',
      ),
    ).toHaveLength(1);
    expect(
      maintenanceDueCount(
        [
          {
            odometerMiles: 15_000,
            maintenanceSchedules: [
              { intervalMiles: 5_000, lastDoneMiles: 10_000 },
            ],
          },
        ] as never,
        '2026-08-13',
      ),
    ).toBe(1);
  });
});
