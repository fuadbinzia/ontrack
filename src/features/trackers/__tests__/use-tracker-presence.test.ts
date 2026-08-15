import { renderHook } from '@testing-library/react-native';

import type { FinanceTransaction } from '@/features/finance/types';
import { useFinance } from '@/store/finance';

import { useTrackerPresenceInput } from '../use-tracker-presence';

const ledgerRow: FinanceTransaction = {
  id: 'tx-presence-1',
  amount: 12,
  currency: 'USD',
  date: '2026-08-15',
  merchant: 'Cafe Example',
  categoryId: 'dining',
  entityId: 'personal',
  source: 'manual',
  createdAt: '2026-08-15T12:00:00.000Z',
  updatedAt: '2026-08-15T12:00:00.000Z',
};

describe('useTrackerPresenceInput finance boundary', () => {
  beforeEach(() => {
    useFinance.getState().reset();
  });

  it('stays idle when the finance ledger is empty', () => {
    const { result } = renderHook(() => useTrackerPresenceInput());
    expect(result.current.financeRecordCount).toBe(0);
  });

  it('counts finance store rows so idle Finance can appear in More', () => {
    useFinance.setState({ transactions: [ledgerRow] });
    const { result } = renderHook(() => useTrackerPresenceInput());
    expect(result.current.financeRecordCount).toBe(1);
  });
});
