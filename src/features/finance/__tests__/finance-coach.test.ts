import { buildFinanceCoachInsights } from '../coach';
import type { FinanceAccount, FinanceRecurringBill, FinanceTransaction } from '../types';

describe('finance coach', () => {
  it('prioritizes high-APR cards', () => {
    const accounts: FinanceAccount[] = [
      {
        id: 'a1',
        name: 'Chase Sapphire',
        kind: 'card',
        aprPercent: 24.9,
        currency: 'USD',
        linkStatus: 'manual',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const insights = buildFinanceCoachInsights({
      transactions: [],
      bills: [],
      buckets: [],
      accounts,
      now: new Date('2026-08-12'),
    });
    expect(insights.some((i) => i.id === 'apr-card')).toBe(true);
    expect(insights.some((i) => i.id === 'rate-context')).toBe(true);
  });

  it('flags subscription clutter', () => {
    const bills: FinanceRecurringBill[] = [1, 2, 3].map((n) => ({
      id: `s${n}`,
      name: `Sub ${n}`,
      amount: 10,
      currency: 'USD',
      cadence: 'monthly' as const,
      nextDue: '2026-09-01',
      categoryId: 'subscription',
      entityId: 'personal',
      kind: 'subscription' as const,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    const txns: FinanceTransaction[] = [];
    const insights = buildFinanceCoachInsights({
      transactions: txns,
      bills,
      buckets: [],
      accounts: [],
      now: new Date('2026-08-12'),
    });
    expect(insights.some((i) => i.id === 'subs')).toBe(true);
  });
});
