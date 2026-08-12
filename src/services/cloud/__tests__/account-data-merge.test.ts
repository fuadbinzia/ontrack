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
