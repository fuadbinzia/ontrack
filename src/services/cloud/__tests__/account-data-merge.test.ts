import {
    mergeDomainPayload,
    mergeEntityArrays,
    mergeKeyedRecords,
} from '@/services/cloud/account-data-merge';

describe('mergeEntityArrays', () => {
  it('keeps cloud items and appends device-only ids', () => {
    expect(
      mergeEntityArrays(
        [{ id: 'a', title: 'Cloud' }],
        [
          { id: 'a', title: 'Device clash' },
          { id: 'b', title: 'Device only' },
        ],
      ),
    ).toEqual([
      { id: 'a', title: 'Cloud' },
      { id: 'b', title: 'Device only' },
    ]);
  });
});

describe('mergeKeyedRecords', () => {
  it('keeps cloud values and adds device-only keys', () => {
    expect(
      mergeKeyedRecords({ a: 1 }, { a: 9, b: 2 }),
    ).toEqual({ a: 1, b: 2 });
  });
});

describe('mergeDomainPayload', () => {
  it('leaves preferences as cloud', () => {
    expect(
      mergeDomainPayload('preferences', { name: 'Cloud' }, { name: 'Device' }),
    ).toEqual({ name: 'Cloud' });
  });

  it('unions travel plans by id', () => {
    expect(
      mergeDomainPayload(
        'travel',
        { plans: [{ id: 'iceland', name: 'Iceland' }] },
        { plans: [{ id: 'guest', name: 'Guest trip' }, { id: 'iceland', name: 'Other' }] },
      ),
    ).toEqual({
      plans: [
        { id: 'iceland', name: 'Iceland' },
        { id: 'guest', name: 'Guest trip' },
      ],
    });
  });

  it('merges event details by activityId and unions provider suppressions', () => {
    expect(mergeDomainPayload(
      'schedule',
      {
        eventDetails: [{ activityId: 'cloud-event', providerEventId: 'one' }],
        suppressedExternalEvents: ['thesportsdb:one'],
      },
      {
        eventDetails: [
          { activityId: 'cloud-event', providerEventId: 'device-clash' },
          { activityId: 'device-event', providerEventId: 'two' },
        ],
        suppressedExternalEvents: ['thesportsdb:one', 'ticketmaster:two'],
      },
    )).toMatchObject({
      eventDetails: [
        { activityId: 'cloud-event', providerEventId: 'one' },
        { activityId: 'device-event', providerEventId: 'two' },
      ],
      suppressedExternalEvents: ['thesportsdb:one', 'ticketmaster:two'],
    });
  });

  it('unions Google Calendar deletion tombstones by activity id', () => {
    expect(
      mergeDomainPayload(
        'schedule',
        {
          googleCalendarDeletions: [
            { activityId: 'cloud', calendarId: 'primary', eventId: 'c1', origin: 'google' },
          ],
        },
        {
          googleCalendarDeletions: [
            { activityId: 'cloud', calendarId: 'primary', eventId: 'clash', origin: 'ontrack' },
            { activityId: 'device', calendarId: 'primary', eventId: 'd1', origin: 'ontrack' },
          ],
        },
      ),
    ).toMatchObject({
      googleCalendarDeletions: [
        { activityId: 'cloud', eventId: 'c1' },
        { activityId: 'device', eventId: 'd1' },
      ],
    });
  });

  it('keeps device-only finance reward profiles and dismissed subscriptions on merge', () => {
    expect(
      mergeDomainPayload(
        'finance',
        {
          transactions: [{ id: 'cloud-txn', amount: 10 }],
          rewardProfiles: [],
          dismissedSubscriptions: [],
          creditScore: {},
        },
        {
          transactions: [{ id: 'guest-txn', amount: 18 }],
          rewardProfiles: [{ id: 'guest-card', name: 'Guest Card' }],
          dismissedSubscriptions: [{ candidateId: 'sub-1', materialFingerprint: 'abc' }],
          creditScore: { current: { score: 720, asOf: '2026-08-01' }, history: [] },
          customHandoffUrl: 'https://example.com/tax',
        },
      ),
    ).toMatchObject({
      transactions: [{ id: 'cloud-txn', amount: 10 }, { id: 'guest-txn', amount: 18 }],
      rewardProfiles: [{ id: 'guest-card', name: 'Guest Card' }],
      dismissedSubscriptions: [{ candidateId: 'sub-1' }],
      creditScore: { current: { score: 720, asOf: '2026-08-01' } },
      customHandoffUrl: 'https://example.com/tax',
    });
  });

  it('keeps device-only checklist categories when merging todo data', () => {
    expect(
      mergeDomainPayload(
        'todos',
        {
          lists: [{ id: 'list', name: 'Cloud list' }],
          categories: [],
          tasks: [{ id: 'task', title: 'Cloud task' }],
          recipes: [],
        },
        {
          lists: [{ id: 'list', name: 'Device list' }],
          categories: [{ id: 'finance', listId: 'list', name: 'Finance' }],
          tasks: [{ id: 'task', title: 'Device task' }],
          recipes: [],
        },
      ),
    ).toMatchObject({
      categories: [{ id: 'finance', listId: 'list', name: 'Finance' }],
    });
  });
});
