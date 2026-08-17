import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Checklist } from '@/store/todos';

import {
  getOrCreateTravelPackingList,
  packingListNameCandidatesForTrip,
  packingListNameForTrip,
  preserveTravelPackingListIds,
  resetTravelPackingListMemory,
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

const list: Checklist = {
  id: 'list-1',
  name: 'Iceland Checklist',
  kind: 'checklist',
  mode: 'private',
  role: 'owner',
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
};

describe('travel packing list link', () => {
  beforeEach(() => {
    resetTravelPackingListMemory();
  });
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

  it('opens an existing trip checklist even when the trip link cannot be saved', () => {
    const createList = jest.fn();

    expect(getOrCreateTravelPackingList(plan, {
      lists: [{ ...list, name: '  iceland   checklist  ' }],
      createList,
      savePlan: () => false,
    })?.id).toBe(list.id);
    expect(createList).not.toHaveBeenCalled();
  });

  it('keeps a linked packing list instead of switching to a later empty checklist', () => {
    const legacyList = {
      ...list,
      id: 'legacy-list',
      name: 'Iceland Packing List',
      createdAt: '2026-08-10T00:00:00.000Z',
    };
    const emptyChecklist = {
      ...list,
      createdAt: '2026-08-16T00:00:00.000Z',
    };
    const savePlan = jest.fn(() => true);

    expect(getOrCreateTravelPackingList(
      { ...plan, packingListId: emptyChecklist.id },
      { lists: [legacyList, emptyChecklist], createList: jest.fn(), savePlan },
    )).toBe(legacyList);
    expect(savePlan).toHaveBeenCalledWith(expect.objectContaining({
      packingListId: legacyList.id,
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

  it('opens an existing packing list instead of creating a second checklist', () => {
    const legacyList = {
      ...list,
      id: 'legacy-list',
      name: 'Iceland Packing List',
    };
    const createList = jest.fn();
    const savePlan = jest.fn(() => true);

    expect(getOrCreateTravelPackingList(plan, {
      lists: [legacyList],
      createList,
      savePlan,
      now: () => '2026-08-12T12:00:00.000Z',
    })).toBe(legacyList);
    expect(createList).not.toHaveBeenCalled();
    expect(savePlan).toHaveBeenCalledWith(expect.objectContaining({
      packingListId: legacyList.id,
    }));
  });

  it('opens the original packing list instead of a later empty checklist', () => {
    const legacyList = {
      ...list,
      id: 'legacy-list',
      name: 'Iceland Packing List',
      createdAt: '2026-08-10T00:00:00.000Z',
    };
    const emptyChecklist = {
      ...list,
      createdAt: '2026-08-16T00:00:00.000Z',
    };
    const createList = jest.fn();

    expect(getOrCreateTravelPackingList(plan, {
      lists: [legacyList, emptyChecklist],
      createList,
      savePlan: () => true,
    })).toBe(legacyList);
    expect(createList).not.toHaveBeenCalled();
  });

  it('renames a leftover packing list to Checklist when that name is free', () => {
    const legacyList = {
      ...list,
      id: 'legacy-list',
      name: 'Iceland Packing List',
    };
    const renameList = jest.fn();

    expect(getOrCreateTravelPackingList(plan, {
      lists: [legacyList],
      createList: jest.fn(),
      renameList,
      savePlan: () => true,
    })).toEqual({ ...legacyList, name: 'Iceland Checklist' });
    expect(renameList).toHaveBeenCalledWith(legacyList.id, 'Iceland Checklist');
  });

  it('does not rename a packing list onto an existing Checklist name', () => {
    const legacyList = {
      ...list,
      id: 'legacy-list',
      name: 'Iceland Packing List',
      createdAt: '2026-08-10T00:00:00.000Z',
    };
    const renameList = jest.fn();

    expect(getOrCreateTravelPackingList(plan, {
      lists: [legacyList, list],
      createList: jest.fn(),
      renameList,
      savePlan: () => true,
    })).toBe(legacyList);
    expect(renameList).not.toHaveBeenCalled();
  });

  it('opens a destination-named checklist instead of creating a duplicate', () => {
    const destinationList = {
      ...list,
      id: 'destination-list',
      name: 'Reykjavik Checklist',
    };
    const createList = jest.fn();
    const savePlan = jest.fn(() => true);

    expect(getOrCreateTravelPackingList(plan, {
      lists: [destinationList],
      createList,
      savePlan,
      now: () => '2026-08-12T12:00:00.000Z',
    })).toBe(destinationList);
    expect(createList).not.toHaveBeenCalled();
  });

  it('matches a stored name truncated to the checklist name limit', () => {
    const longTitle = `Iceland ${'Northern Lights '.repeat(8).trim()}`;
    const longPlan = { ...plan, title: longTitle };
    const truncated = {
      ...list,
      id: 'truncated-list',
      name: packingListNameCandidatesForTrip(longPlan)[0]!,
    };
    const createList = jest.fn();

    expect(truncated.name.length).toBeLessThanOrEqual(80);
    expect(getOrCreateTravelPackingList(longPlan, {
      lists: [truncated],
      createList,
      savePlan: () => true,
    })).toBe(truncated);
    expect(createList).not.toHaveBeenCalled();
  });

  it('keeps a local packing-list link when a sync payload omits it', () => {
    expect(preserveTravelPackingListIds(
      [{ ...plan, updatedAt: '2026-08-13T00:00:00.000Z' }],
      [{ ...plan, packingListId: list.id }],
    )).toEqual([
      expect.objectContaining({
        id: plan.id,
        packingListId: list.id,
        updatedAt: '2026-08-13T00:00:00.000Z',
      }),
    ]);
  });

  it('does not restore a packing-list link the incoming plan already set', () => {
    expect(preserveTravelPackingListIds(
      [{ ...plan, packingListId: 'incoming-list' }],
      [{ ...plan, packingListId: list.id }],
    )[0]?.packingListId).toBe('incoming-list');
  });

  it('resolves the trip checklist from live store state instead of a stale plan copy', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/travel/travel-plan-trip-tools.tsx'),
      'utf8',
    );
    expect(source).toContain('travelPackingListStoreDeps()');
    expect(source).toContain('getLists: () => useChecklists.getState().lists');
    expect(source).toContain('useTravel.getState().plans.find');
    expect(source).toContain('openChecklist(list.id)');
    expect(source).toContain('ensureList:');
    expect(source).toContain('listsWithItems:');
    expect(source).toContain('renameList:');
    expect(source).not.toContain('pathname: "/(tabs)/to-do/[id]"');
  });

  it('opens the same checklist on a second tap even when the list snapshot is empty', () => {
    const createList = jest.fn(() => list);
    const savePlan = jest.fn(() => true);

    expect(getOrCreateTravelPackingList(plan, {
      lists: [],
      createList,
      savePlan,
    })?.id).toBe(list.id);

    expect(getOrCreateTravelPackingList(plan, {
      lists: [],
      createList,
      savePlan: jest.fn(() => true),
    })?.id).toBe(list.id);
    expect(createList).toHaveBeenCalledTimes(1);
  });

  it('does not mint a second checklist when sync dropped the remembered list', () => {
    const createList = jest.fn();
    const ensureList = jest.fn();
    const other = { ...list, id: 'other-list', name: 'Groceries run' };

    expect(getOrCreateTravelPackingList(plan, {
      lists: [],
      createList: jest.fn(() => list),
      savePlan: () => true,
    })?.id).toBe(list.id);

    expect(getOrCreateTravelPackingList(plan, {
      lists: [other],
      createList,
      ensureList,
      savePlan: () => true,
    })?.id).toBe(list.id);
    expect(createList).not.toHaveBeenCalled();
    expect(ensureList).toHaveBeenCalledWith(list);
  });

  it('opens the older Iceland Checklist when a later empty duplicate exists', () => {
    const original = {
      ...list,
      createdAt: '2026-08-10T00:00:00.000Z',
    };
    const duplicate = {
      ...list,
      id: 'list-2',
      createdAt: '2026-08-16T00:00:00.000Z',
    };

    expect(getOrCreateTravelPackingList(
      { ...plan, packingListId: duplicate.id },
      { lists: [duplicate, original], createList: jest.fn(), savePlan: () => true },
    )).toBe(original);
  });

  it('links the populated Iceland Checklist instead of the empty duplicate', () => {
    const packed = {
      ...list,
      id: 'packed-list',
      createdAt: '2026-08-10T00:00:00.000Z',
    };
    const empty = {
      ...list,
      id: 'empty-list',
      createdAt: '2026-08-08T00:00:00.000Z',
    };
    const savePlan = jest.fn(() => true);

    expect(getOrCreateTravelPackingList(
      { ...plan, packingListId: empty.id },
      {
        lists: [empty, packed],
        listsWithItems: new Set([packed.id]),
        createList: jest.fn(),
        savePlan,
      },
    )).toBe(packed);
    expect(savePlan).toHaveBeenCalledWith(expect.objectContaining({
      packingListId: packed.id,
    }));
  });

  it('opens the original packing list even if this session remembered a later checklist', () => {
    const emptyChecklist = {
      ...list,
      createdAt: '2026-08-16T00:00:00.000Z',
    };
    const legacyList = {
      ...list,
      id: 'legacy-list',
      name: 'Iceland Packing List',
      createdAt: '2026-08-10T00:00:00.000Z',
    };

    expect(getOrCreateTravelPackingList(plan, {
      lists: [emptyChecklist],
      createList: jest.fn(),
      savePlan: () => true,
    })?.id).toBe(emptyChecklist.id);

    expect(getOrCreateTravelPackingList(plan, {
      lists: [emptyChecklist, legacyList],
      createList: jest.fn(),
      savePlan: () => true,
    })).toBe(legacyList);
  });
});
