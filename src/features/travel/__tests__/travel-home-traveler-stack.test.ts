import {
  TRAVEL_HOME_TRAVELER_PAIR_SLOTS,
  travelHomeTravelerStackSplit,
} from '@/features/travel/travel-home-traveler-stack';

describe('travelHomeTravelerStackSplit', () => {
  it('shows both faces for a pair; 3+ collapses to self +N', () => {
    expect(TRAVEL_HOME_TRAVELER_PAIR_SLOTS).toBe(2);
    expect(travelHomeTravelerStackSplit(0)).toEqual({ visible: 0, overflow: 0 });
    expect(travelHomeTravelerStackSplit(1)).toEqual({ visible: 1, overflow: 0 });
    expect(travelHomeTravelerStackSplit(2)).toEqual({ visible: 2, overflow: 0 });
    expect(travelHomeTravelerStackSplit(3)).toEqual({ visible: 1, overflow: 2 });
    expect(travelHomeTravelerStackSplit(4)).toEqual({ visible: 1, overflow: 3 });
    expect(travelHomeTravelerStackSplit(5)).toEqual({ visible: 1, overflow: 4 });
  });
});
