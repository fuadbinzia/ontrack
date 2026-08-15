import { createFinanceAccount, createFinanceTransaction } from '../create';
import { analyzeFinanceRewards } from '../rewards-engine';
import type { FinanceRewardCardProfile } from '../rewards-types';

function profile(
  id: string,
  ownership: FinanceRewardCardProfile['ownership'],
  patch: Partial<FinanceRewardCardProfile> = {},
): FinanceRewardCardProfile {
  return {
    id,
    issuer: 'Example Bank',
    name: `Card ${id}`,
    ownership,
    rewardCurrency: 'points',
    pointValueCents: 1,
    baseMultiplier: 1,
    annualFee: 0,
    rules: [],
    benefits: [],
    source: { kind: 'manual', warnings: [] },
    editedFields: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  };
}

function transaction(id: string, patch: Record<string, unknown> = {}) {
  return createFinanceTransaction({
    id,
    amount: 100,
    currency: 'USD',
    date: '2026-01-15',
    merchant: 'Example Merchant',
    categoryId: 'dining',
    entityId: 'personal',
    accountId: 'account-used',
    source: 'plaid',
    sourceCategory: 'FOOD_AND_DRINK_RESTAURANTS',
    ...patch,
  });
}

describe('finance rewards analysis', () => {
  it('compares the card used with wallet and market alternatives', () => {
    const account = createFinanceAccount({
      id: 'account-used',
      name: 'Used Card',
      kind: 'card',
      currency: 'USD',
      linkStatus: 'manual',
      rewardProfileId: 'used',
    });
    const used = profile('used', 'owned');
    const wallet = profile('wallet', 'owned', { baseMultiplier: 2 });
    const market = profile('market', 'market', { baseMultiplier: 3 });
    const result = analyzeFinanceRewards({
      transactions: [transaction('purchase')],
      accounts: [account],
      profiles: [used, wallet, market],
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(result.actualValue).toBe(1);
    expect(result.walletBest?.profileId).toBe('wallet');
    expect(result.marketBest?.profileId).toBe('market');
    expect(result.missedWalletValue).toBe(1);
    expect(result.missedMarketValue).toBe(2);
  });

  it('honors exact Plaid categories, date windows, and shared quarterly caps', () => {
    const rewardProfile = profile('cap-card', 'owned', {
      rules: [
        {
          id: 'dining',
          name: 'Quarterly Dining',
          multiplier: 5,
          categoryIds: ['dining'],
          sourceCategories: ['FOOD_AND_DRINK_RESTAURANTS'],
          startsOn: '2026-01-01',
          endsOn: '2026-03-31',
          capAmount: 150,
          capPeriod: 'quarter',
          capGroup: 'rotating-q1',
          active: true,
        },
        {
          id: 'groceries',
          name: 'Quarterly Groceries',
          multiplier: 5,
          categoryIds: ['groceries'],
          sourceCategories: [],
          capAmount: 150,
          capPeriod: 'quarter',
          capGroup: 'rotating-q1',
          active: true,
        },
      ],
    });
    const result = analyzeFinanceRewards({
      accounts: [],
      profiles: [rewardProfile],
      transactions: [
        transaction('dining', { amount: 100 }),
        transaction('groceries', {
          amount: 100,
          date: '2026-02-01',
          categoryId: 'groceries',
          sourceCategory: undefined,
        }),
        transaction('after-window', { amount: 100, date: '2026-04-01' }),
      ],
      from: '2026-01-01',
      to: '2026-04-30',
    });
    const rows = result.profileResults[0].transactionResults;
    expect(rows[0]).toMatchObject({ multiplier: 5, confidence: 'high', points: 500 });
    expect(rows[1]).toMatchObject({ multiplier: 5, confidence: 'medium', points: 300 });
    expect(rows[2]).toMatchObject({ multiplier: 1, confidence: 'low', points: 100 });
  });

  it('excludes transfers, subtracts refunds, skips other currencies, and values enabled benefits', () => {
    const rewardProfile = profile('annual', 'owned', {
      annualFee: 95,
      benefits: [{ id: 'credit', name: 'Credit', faceValue: 120, userValue: 60, enabled: true }],
    });
    const result = analyzeFinanceRewards({
      accounts: [],
      profiles: [rewardProfile],
      transactions: [
        transaction('purchase'),
        transaction('refund', { amount: 20, activity: 'refund' }),
        transaction('transfer', { amount: 1000, activity: 'transfer' }),
        transaction('foreign', { amount: 50, currency: 'EUR' }),
      ],
      from: '2026-01-01',
      to: '2026-12-31',
    });
    expect(result.profileResults[0]).toMatchObject({ spend: 80, points: 80, value: 0.8 });
    expect(result.profileResults[0].annualValue).toBeCloseTo(-34.2, 5);
    expect(result.skippedTransactionIds).toEqual(['foreign']);
    expect(result.profileResults[0].transactionResults.map((row) => row.transactionId))
      .toEqual(['purchase', 'refund']);
  });

  it('does not apply a rule that still requires activation', () => {
    const rewardProfile = profile('activation', 'owned', {
      rules: [{
        id: 'inactive',
        name: 'Activate First',
        multiplier: 5,
        categoryIds: ['dining'],
        sourceCategories: [],
        requiresActivation: true,
        active: false,
      }],
    });
    const result = analyzeFinanceRewards({
      accounts: [], profiles: [rewardProfile], transactions: [transaction('purchase')],
      from: '2026-01-01', to: '2026-01-31',
    });
    expect(result.profileResults[0].transactionResults[0].multiplier).toBe(1);
  });

  it('tracks actual caps using only purchases made on the linked card', () => {
    const rewardProfile = profile('capped', 'owned', {
      rules: [{
        id: 'dining-cap',
        name: 'Dining',
        multiplier: 5,
        categoryIds: ['dining'],
        sourceCategories: [],
        capAmount: 100,
        capPeriod: 'year',
        active: true,
      }],
    });
    const accounts = [
      createFinanceAccount({
        id: 'linked', name: 'Linked', kind: 'card', currency: 'USD',
        linkStatus: 'manual', rewardProfileId: 'capped',
      }),
      createFinanceAccount({
        id: 'other', name: 'Other', kind: 'card', currency: 'USD', linkStatus: 'manual',
      }),
    ];
    const result = analyzeFinanceRewards({
      profiles: [rewardProfile],
      accounts,
      transactions: [
        transaction('other-spend', { accountId: 'other' }),
        transaction('actual-spend', { accountId: 'linked', date: '2026-01-16' }),
      ],
      from: '2026-01-01',
      to: '2026-12-31',
    });

    expect(result.actualValue).toBe(5);
    expect(result.profileResults[0].value).toBe(6);
  });
});
