import {
  advanceBillDue,
  bucketProgress,
  bucketSavedAmount,
  categoryBreakdown,
  groupTransactionsByTaxBucket,
  monthlySpendSeries,
  sumAmounts,
  sumAssetBalances,
  taxYearReadiness,
  transactionsInMonth,
  upcomingBills,
} from '../model';
import type {
  FinanceAccount,
  FinanceBucket,
  FinanceRecurringBill,
  FinanceTaxYear,
  FinanceTransaction,
} from '../types';

function txn(
  partial: Partial<FinanceTransaction> & Pick<FinanceTransaction, 'id' | 'amount' | 'date'>,
): FinanceTransaction {
  return {
    currency: 'USD',
    merchant: 'Shop',
    categoryId: 'groceries',
    entityId: 'personal',
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('finance model', () => {
  it('sums and breaks down month spend', () => {
    const rows = [
      txn({ id: '1', amount: 10, date: '2026-08-01', categoryId: 'groceries' }),
      txn({ id: '2', amount: 20, date: '2026-08-02', categoryId: 'dining' }),
      txn({ id: '3', amount: 5, date: '2026-07-31', categoryId: 'dining' }),
    ];
    const month = transactionsInMonth(rows, 2026, 7);
    expect(sumAmounts(month)).toBe(30);
    expect(categoryBreakdown(month).map((r) => r.categoryId)).toEqual([
      'dining',
      'groceries',
    ]);
  });

  it('builds a monthly series and upcoming bills', () => {
    const series = monthlySpendSeries(
      [txn({ id: '1', amount: 40, date: '2026-08-10' })],
      2,
      new Date('2026-08-12T12:00:00'),
    );
    expect(series).toHaveLength(2);
    expect(series[1]?.amount).toBe(40);

    const bills: FinanceRecurringBill[] = [
      {
        id: 'b1',
        name: 'Netflix',
        amount: 15,
        currency: 'USD',
        cadence: 'monthly',
        nextDue: '2026-08-20',
        categoryId: 'subscription',
        entityId: 'personal',
        kind: 'subscription',
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    expect(upcomingBills(bills, 30, new Date('2026-08-12')).map((b) => b.id)).toEqual([
      'b1',
    ]);
    expect(advanceBillDue('monthly', '2026-08-20')).toBe('2026-09-20');
  });

  it('tracks bucket progress and tax readiness', () => {
    const bucket: FinanceBucket = {
      id: 'k1',
      name: 'Travel',
      goalAmount: 1000,
      currency: 'USD',
      contributions: [
        { id: 'c1', amount: 250, date: '2026-08-01' },
        { id: 'c2', amount: 250, date: '2026-08-10' },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(bucketSavedAmount(bucket)).toBe(500);
    expect(bucketProgress(bucket)).toBe(0.5);

    const taxYear: FinanceTaxYear = {
      id: 't1',
      year: 2026,
      entityIds: [],
      checklist: {
        entities_scoped: true,
        income_docs: true,
      },
      documentIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(taxYearReadiness(taxYear)).toBeCloseTo(0.4);

    const grouped = groupTransactionsByTaxBucket([
      txn({ id: '1', amount: 12, date: '2026-08-01', categoryId: 'office' }),
    ]);
    expect(grouped[0]?.bucket).toBe('office');
  });

  it('sums asset balances and ignores cards', () => {
    const accounts: FinanceAccount[] = [
      {
        id: 'c1',
        name: 'Visa',
        kind: 'card',
        currency: 'USD',
        linkStatus: 'manual',
        balance: 2000,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'b1',
        name: 'Checking',
        kind: 'bank',
        currency: 'USD',
        linkStatus: 'manual',
        balance: 1500,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'r1',
        name: '401k',
        kind: 'retirement_401k',
        currency: 'USD',
        linkStatus: 'linked',
        balance: 8000,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    expect(sumAssetBalances(accounts)).toBe(9500);
  });
});
