import type { TodoList } from '@/store/todos';

import {
  getOrCreateTravelPackingList,
  packingListNameForTrip,
} from '../travel-packing-list';
import type { TravelPlan } from '../types';

const plan: TravelPlan = {
  id: 'trip-1',
  title: 'Iceland',
  destination: 'Reykjavik',
  startDate: '2026-09-08',
  endDate: '2026-09-14',
  itinerary: [],
  participants: [],
  baseCurrency: 'USD',
  expenses: [],
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
};

const list: TodoList = {
  id: 'list-1',
  name: 'Iceland Packing List',
  kind: 'checklist',
  mode: 'private',
  role: 'owner',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
};

describe('travel packing list link', () => {
  it('uses a trip-specific checklist name', () => {
    expect(packingListNameForTrip('  Iceland  ')).toBe('Iceland Packing List');
    expect(packingListNameForTrip('   ')).toBe('Packing List');
  });

  it('returns an existing linked list without creating a duplicate', () => {
    const createList = jest.fn();
    const savePlan = jest.fn();

    const result = getOrCreateTravelPackingList(
      { ...plan, packingListId: list.id },
      { lists: [list], createList, savePlan },
    );

    expect(result).toBe(list);
    expect(createList).not.toHaveBeenCalled();
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('creates a checklist and persists its id on the trip', () => {
    const createList = jest.fn(() => list);
    const savePlan = jest.fn(() => true);

    const result = getOrCreateTravelPackingList(plan, {
      lists: [],
      createList,
      savePlan,
      now: () => '2026-08-12T12:00:00.000Z',
    });

    expect(result).toBe(list);
    expect(createList).toHaveBeenCalledWith('Iceland Packing List', 'checklist');
    expect(savePlan).toHaveBeenCalledWith({
      ...plan,
      packingListId: list.id,
      updatedAt: '2026-08-12T12:00:00.000Z',
    });
  });

  it('replaces a stale link when its checklist was deleted', () => {
    const replacement = { ...list, id: 'list-2' };
    const savePlan = jest.fn(() => true);

    expect(getOrCreateTravelPackingList(
      { ...plan, packingListId: 'deleted-list' },
      {
        lists: [],
        createList: () => replacement,
        savePlan,
        now: () => '2026-08-12T12:00:00.000Z',
      },
    )).toBe(replacement);
    expect(savePlan).toHaveBeenCalledWith(expect.objectContaining({
      packingListId: replacement.id,
    }));
  });
});
