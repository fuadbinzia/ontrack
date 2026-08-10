import { normalizeTravelPlan, normalizeTravelPlans } from '../normalize';

describe('travel plan normalization', () => {
  const legacyPlan = {
    id: 'trip-legacy',
    title: 'Iceland',
    destination: 'Iceland',
    startDate: '2026-09-08',
    endDate: '2026-09-13',
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-02T12:00:00.000Z',
  };

  it('migrates legacy trips without an itinerary to an empty itinerary', () => {
    expect(normalizeTravelPlan(legacyPlan)).toEqual({
      ...legacyPlan,
      mode: 'flight',
      notes: undefined,
      itinerary: [],
      participants: [],
      baseCurrency: 'USD',
      expenses: [],
    });
  });

  it('omits cover fields when uploads are cleared', () => {
    const cleared = normalizeTravelPlan({
      ...legacyPlan,
      coverUri: undefined,
      coverUris: undefined,
    });
    expect(cleared?.coverUri).toBeUndefined();
    expect(cleared?.coverUris).toBeUndefined();
  });

  it('keeps durable coverUris (and coverUri alias) and drops invalid ones', () => {
    expect(
      normalizeTravelPlan({
        ...legacyPlan,
        coverUri: 'file:///Documents/travel-moments/cover-trip.jpg',
      }),
    ).toMatchObject({
      coverUri: 'file:///Documents/travel-moments/cover-trip.jpg',
      coverUris: ['file:///Documents/travel-moments/cover-trip.jpg'],
    });
    expect(
      normalizeTravelPlan({
        ...legacyPlan,
        coverUris: [
          'file:///Documents/travel-moments/cover-a.jpg',
          'file:///Documents/travel-moments/cover-b.jpg',
          'file:///Documents/travel-moments/cover-c.jpg',
          'file:///Documents/travel-moments/cover-d.jpg',
        ],
      }),
    ).toMatchObject({
      coverUri: 'file:///Documents/travel-moments/cover-a.jpg',
      coverUris: [
        'file:///Documents/travel-moments/cover-a.jpg',
        'file:///Documents/travel-moments/cover-b.jpg',
        'file:///Documents/travel-moments/cover-c.jpg',
      ],
    });
    expect(
      normalizeTravelPlan({
        ...legacyPlan,
        coverUri: 'https://example.com/photo.jpg',
      })?.coverUri,
    ).toBeUndefined();
    expect(
      normalizeTravelPlan({
        ...legacyPlan,
        coverUri:
          'https://example.supabase.co/storage/v1/object/sign/app-media/user-1/travel/cover.jpg?token=x',
      })?.coverUri,
    ).toBe('ontrack-media:user-1/travel/cover.jpg');
  });

  it('keeps valid expenses and drops malformed ones', () => {
    expect(
      normalizeTravelPlan({
        ...legacyPlan,
        baseCurrency: 'eur',
        expenses: [
          {
            id: 'expense-1',
            title: 'Dinner',
            amount: 4500,
            currency: 'isk',
            date: '2026-09-09',
            category: 'food',
            paidById: 'self',
            splitWithIds: ['self'],
            createdAt: '2026-07-01T12:00:00.000Z',
            updatedAt: '2026-07-01T12:00:00.000Z',
          },
          { id: 'broken', amount: -1 },
        ],
      }),
    ).toMatchObject({
      baseCurrency: 'EUR',
      expenses: [
        {
          id: 'expense-1',
          title: 'Dinner',
          amount: 4500,
          currency: 'ISK',
          category: 'food',
          paidById: 'self',
          splitWithIds: ['self'],
        },
      ],
    });
  });


  it('removes malformed itinerary entries without discarding the trip', () => {
    expect(
      normalizeTravelPlan({
        ...legacyPlan,
        itinerary: [
          undefined,
          { id: 'broken' },
          {
            id: 'dinner',
            kind: 'activity',
            title: 'Dinner',
            date: '2026-09-09',
            startMinutes: 1140,
            durationMinutes: 90,
          },
        ],
      })?.itinerary,
    ).toEqual([
      {
        id: 'dinner',
        kind: 'activity',
        title: 'Dinner',
        date: '2026-09-09',
        startMinutes: 1140,
        durationMinutes: 90,
        details: undefined,
        bookingUrl: undefined,
        shareMode: 'trip',
        flight: undefined,
        transport: undefined,
        rental: undefined,
        stay: undefined,
      },
    ]);
  });

  it('keeps moment entries with photos and defaults blank titles', () => {
    expect(
      normalizeTravelPlan({
        ...legacyPlan,
        itinerary: [
          {
            id: 'moment-1',
            kind: 'moment',
            title: '  ',
            date: '2026-09-10',
            startMinutes: 1080,
            photoUris: [
              'file:///Documents/travel-moments/sunset.jpg',
              'https://evil.example/x.jpg',
              '',
            ],
          },
        ],
      })?.itinerary,
    ).toEqual([
      {
        id: 'moment-1',
        kind: 'moment',
        title: 'Moment',
        date: '2026-09-10',
        startMinutes: 1080,
        durationMinutes: 15,
        details: undefined,
        bookingUrl: undefined,
        shareMode: 'trip',
        photoUris: ['file:///Documents/travel-moments/sunset.jpg'],
        flight: undefined,
        transport: undefined,
        rental: undefined,
        stay: undefined,
      },
    ]);
  });

  it('keeps car rental itinerary details', () => {
    expect(
      normalizeTravelPlan({
        ...legacyPlan,
        itinerary: [
          {
            id: 'rental-1',
            kind: 'rental',
            title: 'Hertz rental',
            date: '2026-09-09',
            startMinutes: 600,
            durationMinutes: 60,
            rental: {
              company: 'Hertz',
              confirmationCode: 'K98M7X2PQ1',
              pickupLocation: 'KEF',
              dropoffDate: '2026-09-14',
              dropoffMinutes: 480,
            },
          },
        ],
      })?.itinerary,
    ).toEqual([
      {
        id: 'rental-1',
        kind: 'rental',
        title: 'Hertz Rental',
        date: '2026-09-09',
        startMinutes: 600,
        durationMinutes: 60,
        details: undefined,
        bookingUrl: undefined,
        shareMode: 'trip',
        flight: undefined,
        transport: undefined,
        rental: {
          company: 'Hertz',
          confirmationCode: 'K98M7X2PQ1',
          pickupLocation: 'KEF',
          dropoffLocation: undefined,
          vehicleClass: undefined,
          dropoffDate: '2026-09-14',
          dropoffMinutes: 480,
        },
        stay: undefined,
      },
    ]);
  });

  it('repairs the broken Hertz L666EBA86A0 rental import (wrong pickup, missing drop-off)', () => {
    const normalized = normalizeTravelPlan({
      ...legacyPlan,
      startDate: '2026-09-08',
      endDate: '2026-09-14',
      itinerary: [
        {
          id: 'trip-item-ms9jg1he-1',
          kind: 'rental',
          title: 'Hertz rental',
          date: '2026-09-08',
          startMinutes: 18 * 60 + 52,
          durationMinutes: 60,
          rental: {
            company: 'Hertz',
            confirmationCode: 'L666EBA86A0',
            vehicleClass: 'Compact Elite',
          },
        },
      ],
    });
    expect(normalized?.itinerary[0]).toMatchObject({
      title: 'Hertz Rental · Keflavik International Airport (KEF)',
      date: '2026-09-09',
      startMinutes: 6 * 60 + 30,
      rental: {
        confirmationCode: 'L666EBA86A0',
        pickupLocation: 'Keflavik International Airport (KEF)',
        dropoffLocation: 'Keflavik International Airport (KEF)',
        dropoffDate: '2026-09-14',
        dropoffMinutes: 15 * 60,
        vehicleClass: 'Compact Elite',
      },
    });
  });

  it('corrects a previously repaired L666EBA86A0 rental that still had wrong times', () => {
    const normalized = normalizeTravelPlan({
      ...legacyPlan,
      startDate: '2026-09-08',
      endDate: '2026-09-14',
      itinerary: [
        {
          id: 'trip-item-ms9jg1he-1',
          kind: 'rental',
          title: 'Hertz rental · Keflavik International Airport (KEF)',
          date: '2026-09-09',
          startMinutes: 10 * 60,
          durationMinutes: 60,
          rental: {
            company: 'Hertz',
            confirmationCode: 'L666EBA86A0',
            pickupLocation: 'Keflavik International Airport (KEF)',
            dropoffLocation: 'Keflavik International Airport (KEF)',
            vehicleClass: 'Compact Elite',
            dropoffDate: '2026-09-14',
            dropoffMinutes: 8 * 60,
          },
        },
      ],
    });
    expect(normalized?.itinerary[0]).toMatchObject({
      title: 'Hertz Rental · Keflavik International Airport (KEF)',
      startMinutes: 6 * 60 + 30,
      rental: { dropoffMinutes: 15 * 60 },
    });
  });

  it('keeps collaborative itinerary notes and drops malformed ones', () => {
    const normalized = normalizeTravelPlan({
      ...legacyPlan,
      itinerary: [
        {
          id: 'item-1',
          kind: 'activity',
          title: 'Blue Lagoon',
          date: '2026-09-09',
          startMinutes: 10 * 60,
          durationMinutes: 120,
          notes: [
            {
              id: 'note-1',
              body: 'Bring towels',
              authorId: 'self',
              authorName: 'Rocky',
              createdAt: '2026-08-01T12:00:00.000Z',
              updatedAt: '2026-08-01T13:00:00.000Z',
            },
            {
              id: 'bad',
              body: '   ',
              authorId: 'self',
              authorName: 'Rocky',
              createdAt: '2026-08-01T12:00:00.000Z',
            },
          ],
        },
      ],
    });
    expect(normalized?.itinerary[0]?.notes).toEqual([
      {
        id: 'note-1',
        body: 'Bring towels',
        authorId: 'self',
        authorName: 'Rocky',
        createdAt: '2026-08-01T12:00:00.000Z',
        updatedAt: '2026-08-01T13:00:00.000Z',
      },
    ]);
  });

  it('deduplicates repeated itinerary items with different ids', () => {
    const normalized = normalizeTravelPlan({
      ...legacyPlan,
      itinerary: [
        {
          id: 'item-1',
          kind: 'activity',
          title: 'Dinner',
          date: '2026-09-09',
          startMinutes: 19 * 60,
          durationMinutes: 90,
        },
        {
          id: 'item-2',
          kind: 'activity',
          title: 'Dinner',
          date: '2026-09-09',
          startMinutes: 19 * 60,
          durationMinutes: 90,
        },
      ],
    });

    expect(normalized?.itinerary).toEqual([
      {
        id: 'item-1',
        kind: 'activity',
        title: 'Dinner',
        date: '2026-09-09',
        startMinutes: 19 * 60,
        durationMinutes: 90,
        details: undefined,
        bookingUrl: undefined,
        shareMode: 'trip',
        flight: undefined,
        transport: undefined,
        rental: undefined,
        stay: undefined,
      },
    ]);
  });

  it('repairs the previously persisted Icelandair return flight import', () => {
    const normalized = normalizeTravelPlan({
      ...legacyPlan,
      startDate: '2026-09-08',
      endDate: '2026-09-13',
      itinerary: [
        {
          id: 'outbound',
          kind: 'flight',
          title: 'Flight EWR → KEF',
          date: '2026-09-08',
          startMinutes: 20 * 60 + 25,
          durationMinutes: 5 * 60 + 50,
          flight: {
            airline: 'Icelandair',
            flightNumber: 'FI 622',
            confirmationCode: 'AB2ZQV',
            departureAirport: 'EWR',
            arrivalAirport: 'KEF',
          },
        },
        {
          id: 'return',
          kind: 'flight',
          title: 'Flight EWR → KEF',
          date: '2026-09-13',
          startMinutes: 17 * 60,
          durationMinutes: 6 * 60 + 15,
          flight: {
            airline: 'Icelandair',
            flightNumber: 'FI 623',
            confirmationCode: 'AB2ZQV',
            departureAirport: 'EWR',
            arrivalAirport: 'KEF',
          },
        },
      ],
      expenses: [
        {
          id: 'exp-flight',
          title: 'Flight EWR → KEF',
          amount: 916.46,
          currency: 'USD',
          date: '2026-09-08',
          category: 'flight',
          paidById: 'self',
          splitWithIds: ['self'],
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    });

    expect(normalized).toMatchObject({
      endDate: '2026-09-14',
      itinerary: [
        {
          id: 'outbound',
          title: 'Flight EWR → KEF',
          date: '2026-09-08',
        },
        {
          id: 'return',
          title: 'Flight KEF → EWR',
          date: '2026-09-14',
          flight: {
            flightNumber: 'FI 623',
            departureAirport: 'KEF',
            arrivalAirport: 'EWR',
          },
        },
      ],
      expenses: [{ id: 'exp-flight', title: 'Flights EWR <-> KEF' }],
    });
  });

  it('repairs FI 623 already on Sep 14 with swapped airports', () => {
    const normalized = normalizeTravelPlan({
      ...legacyPlan,
      startDate: '2026-09-08',
      endDate: '2026-09-14',
      itinerary: [
        {
          id: 'return',
          kind: 'flight',
          title: 'Flight EWR → KEF',
          date: '2026-09-14',
          startMinutes: 17 * 60,
          durationMinutes: 6 * 60 + 15,
          flight: {
            airline: 'Icelandair',
            flightNumber: 'FI 623',
            confirmationCode: 'AB2ZQV',
            departureAirport: 'EWR',
            arrivalAirport: 'KEF',
          },
        },
      ],
    });
    expect(normalized?.itinerary[0]).toMatchObject({
      title: 'Flight KEF → EWR',
      date: '2026-09-14',
      startMinutes: 17 * 60,
      durationMinutes: 6 * 60 + 15,
      flight: {
        departureAirport: 'KEF',
        arrivalAirport: 'EWR',
      },
    });
  });

  it('keeps valid trip participants and drops malformed invite records', () => {
    expect(
      normalizeTravelPlan({
        ...legacyPlan,
        participants: [
          { id: 'broken', name: '' },
          {
            id: 'person-1',
            name: '  Sam Rivera  ',
            email: 'sam@example.com',
            inviteCode: '0123456789abcdefabcd',
            invitedAt: '2026-07-27T12:00:00.000Z',
            acceptedAt: '2026-07-27T13:00:00.000Z',
          },
        ],
      })?.participants,
    ).toEqual([
      {
        id: 'person-1',
        name: 'Sam Rivera',
        email: 'sam@example.com',
        inviteCode: '0123456789abcdefabcd',
        invitedAt: '2026-07-27T12:00:00.000Z',
        acceptedAt: '2026-07-27T13:00:00.000Z',
      },
    ]);
  });

  it('ignores invalid cloud records', () => {
    expect(normalizeTravelPlans([legacyPlan, null, { title: 'Missing ID' }])).toHaveLength(1);
  });

  it('restores host ownership when a host plan was mis-tagged as a member copy', () => {
    const normalized = normalizeTravelPlan({
      ...legacyPlan,
      id: 'trip-invite-euneo2',
      chatAccessCode: 'ca11968c4977e8ef06db',
      openJoinCode: '3eb90399d01f9b732186',
      hostTripId: 'trip-invite-1s2yhed',
      hostDisplayName: 'Jordan',
      sharedExpensePeople: [
        { id: 'host', name: 'Alex' },
        { id: 'self', name: 'Alex' },
        { id: 'friend-1', name: 'Jordan Lee' },
      ],
    });
    expect(normalized?.chatAccessCode).toBeUndefined();
    expect(normalized?.openJoinCode).toBe('3eb90399d01f9b732186');
    expect(normalized?.hostTripId).toBe('trip-invite-euneo2');
    expect(normalized?.hostDisplayName).toBeUndefined();
    expect(normalized?.sharedExpensePeople).toEqual([
      { id: 'self', name: 'Alex' },
      { id: 'friend-1', name: 'Jordan Lee' },
    ]);
  });

  it('keeps intentional former-host member copies that cleared open-join', () => {
    expect(
      normalizeTravelPlan({
        ...legacyPlan,
        chatAccessCode: 'aaaaaaaaaaaaaaaaaaaa',
        hostTripId: 'trip-host-1',
        hostDisplayName: 'Sam',
      }),
    ).toMatchObject({
      chatAccessCode: 'aaaaaaaaaaaaaaaaaaaa',
      hostTripId: 'trip-host-1',
      hostDisplayName: 'Sam',
    });
  });

  it('keeps approved open-join member copies as members without host link state', () => {
    const normalized = normalizeTravelPlan({
      ...legacyPlan,
      id: 'trip-invite-member-code',
      chatAccessCode: 'aaaaaaaaaaaaaaaaaaaa',
      hostTripId: 'trip-host-1',
    });

    expect(normalized).toMatchObject({
      chatAccessCode: 'aaaaaaaaaaaaaaaaaaaa',
      hostTripId: 'trip-host-1',
    });
    expect(normalized).not.toHaveProperty('openJoinCode');
  });
});
