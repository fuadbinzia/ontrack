import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { subscribeGuestDirtyStores } from '@/features/auth/auth-guest-dirty';
import {
  isGuestDirtyTrackingSuppressed,
  withoutGuestDirtyTracking,
} from '@/features/auth/guest-dirty-tracking';
import { createFinanceTransaction } from '@/features/finance/create';
import { useAuthAccess } from '@/store/auth-access';
import { useFinance } from '@/store/finance';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('guest edit tracking', () => {
  beforeEach(() => {
    useAuthAccess.getState().resetAccess();
  });

  it('marks edits only after guest access is active', () => {
    useAuthAccess.getState().markGuestDataDirty();
    expect(useAuthAccess.getState().guestDataDirty).toBe(false);

    useAuthAccess.getState().enterGuest();
    useAuthAccess.getState().markGuestDataDirty();
    expect(useAuthAccess.getState().guestDataDirty).toBe(true);
  });

  it('marks guest finance edits so sign-in can offer a merge instead of restoring cloud', () => {
    useFinance.getState().reset();
    useAuthAccess.getState().enterGuest();
    const stop = subscribeGuestDirtyStores();
    expect(useAuthAccess.getState().guestDataDirty).toBe(false);

    useFinance.getState().saveTransaction(createFinanceTransaction({
      amount: 12,
      date: '2026-08-18',
      merchant: 'Cafe',
      categoryId: 'dining',
      entityId: 'personal',
    }));

    expect(useAuthAccess.getState().guestDataDirty).toBe(true);
    stop();
    useFinance.getState().reset();
  });

  it('suppresses seed and migration writes without leaking suppression state', () => {
    expect(isGuestDirtyTrackingSuppressed()).toBe(false);
    withoutGuestDirtyTracking(() => {
      expect(isGuestDirtyTrackingSuppressed()).toBe(true);
    });
    expect(isGuestDirtyTrackingSuppressed()).toBe(false);
  });
});
