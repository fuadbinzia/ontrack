import fs from 'fs';
import path from 'path';

import {
  trackerRouteHasPresence,
  visibleMoreRoutes,
} from '../tracker-presence';

const hookSource = fs.readFileSync(
  path.resolve(__dirname, '../use-tracker-presence.ts'),
  'utf8',
);

const empty = {
  mealCount: 0,
  gymActivityCount: 0,
  plantCount: 0,
  travelPlanCount: 0,
  visionItemCount: 0,
  vehicleCount: 0,
  healthEntryCount: 0,
  financeRecordCount: 0,
  journalBlockCount: 0,
};

describe('tracker presence', () => {
  it('keeps core sections visible when they have no data', () => {
    expect(trackerRouteHasPresence('overview', empty)).toBe(true);
    expect(trackerRouteHasPresence('(today)', empty)).toBe(true);
    expect(trackerRouteHasPresence('to-do', empty)).toBe(true);
    expect(trackerRouteHasPresence('profile', empty)).toBe(true);
  });

  it('hides idle add-on sections until they have data', () => {
    expect(trackerRouteHasPresence('food', empty)).toBe(false);
    expect(trackerRouteHasPresence('travel', empty)).toBe(false);
    expect(trackerRouteHasPresence('games', empty)).toBe(false);
    expect(trackerRouteHasPresence('finance', empty)).toBe(false);
    expect(
      trackerRouteHasPresence('food', { ...empty, mealCount: 1 }),
    ).toBe(true);
    expect(
      trackerRouteHasPresence('journal', { ...empty, journalBlockCount: 2 }),
    ).toBe(true);
    expect(
      trackerRouteHasPresence('finance', { ...empty, financeRecordCount: 1 }),
    ).toBe(true);
  });

  it('filters More to core plus sections with presence', () => {
    expect(
      visibleMoreRoutes(
        ['profile', 'travel', 'food', 'social'],
        { ...empty, travelPlanCount: 1 },
      ),
    ).toEqual(['profile', 'travel', 'social']);
  });

  it('counts finance ledger records from the finance store', () => {
    expect(hookSource).toContain("from '@/store/finance'");
    expect(hookSource).toContain('useFinance((state) => state.bills)');
    expect(hookSource).toContain('useFinance((state) => state.transactions)');
    expect(hookSource).toContain('useFinance((state) => state.accounts)');
    expect(hookSource).toContain('useFinance((state) => state.buckets)');
    expect(hookSource).toContain(
      'bills.length + transactions.length + accounts.length + buckets.length',
    );
    expect(
      visibleMoreRoutes(['finance', 'games'], { ...empty, financeRecordCount: 3 }),
    ).toEqual(['finance']);
  });
});
