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
  name: 'Iceland Checklist',
  kind: 'checklist',
  mode: 'private',
  role: 'owner',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
};

describe('travel packing list link', () => {
  it('uses a trip-specific checklist name', () => {
    expect(packingListNameForTrip('  Iceland  ')).toBe('Iceland Checklist');
    expect(packingListNameForTrip('New   York')).toBe('New York Checklist');
    expect(packingListNameForTrip('   ')).toBe('Checklist');
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
    expect(createList).toHaveBeenCalledWith('Iceland Checklist', 'checklist');
    expect(savePlan).toHaveBeenCalledWith({
      ...plan,
      packingListId: list.id,
      updatedAt: '2026-08-12T12:00:00.000Z',
    });
  });

  it('links an existing trip checklist instead of creating a duplicate', () => {
    const createList = jest.fn();
    const savePlan = jest.fn(() => true);

    expect(getOrCreateTravelPackingList(plan, {
      lists: [list],
      createList,
      savePlan,
      now: () => '2026-08-12T12:00:00.000Z',
    })).toBe(list);
    expect(createList).not.toHaveBeenCalled();
    expect(savePlan).toHaveBeenCalledWith({
      ...plan,
      packingListId: list.id,
      updatedAt: '2026-08-12T12:00:00.000Z',
    });
  });

  it('does not create a duplicate when the existing checklist link cannot be saved', () => {
    const createList = jest.fn();

    expect(getOrCreateTravelPackingList(plan, {
      lists: [{ ...list, name: '  iceland   checklist  ' }],
      createList,
      savePlan: () => false,
    })).toBeUndefined();
    expect(createList).not.toHaveBeenCalled();
  });

  it('moves a legacy generated link to an existing trip checklist', () => {
    const legacyList = {
      ...list,
      id: 'legacy-list',
      name: 'Iceland Packing List',
    };
    const savePlan = jest.fn(() => true);

    expect(getOrCreateTravelPackingList(
      { ...plan, packingListId: legacyList.id },
      { lists: [legacyList, list], createList: jest.fn(), savePlan },
    )).toBe(list);
    expect(savePlan).toHaveBeenCalledWith(expect.objectContaining({
      packingListId: list.id,
    }));
  });

  it('keeps a deliberately linked custom checklist', () => {
    const customList = { ...list, id: 'custom-list', name: 'Winter Gear' };
    const savePlan = jest.fn();

    expect(getOrCreateTravelPackingList(
      { ...plan, packingListId: customList.id },
      { lists: [customList, list], createList: jest.fn(), savePlan },
    )).toBe(customList);
    expect(savePlan).not.toHaveBeenCalled();
  });

  it('does not link a grocery list with the trip checklist name', () => {
    const grocery = { ...list, id: 'grocery-list', kind: 'grocery' as const };
    const created = { ...list, id: 'created-list' };
    const createList = jest.fn(() => created);

    expect(getOrCreateTravelPackingList(plan, {
      lists: [grocery],
      createList,
      savePlan: () => true,
    })).toBe(created);
    expect(createList).toHaveBeenCalledWith('Iceland Checklist', 'checklist');
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
