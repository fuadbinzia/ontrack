import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

import { useFinance } from '@/store/finance';

import { createFinanceAccount, createFinanceBill, createFinanceTransaction } from '../create';
import { refreshLocalSubscriptionCandidates } from '../refresh-subscription-candidates';
import {
  categorizeRecurringExpense,
  detectLocalSubscriptionCandidates,
  editRecurringExpense,
  monthlyRecurringAmount,
  monthlySubscriptionAmount,
} from '../subscriptions';
import type { FinanceSubscriptionCandidate } from '../types';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

function linkedAccount(id = 'account-local') {
  return createFinanceAccount({
    id,
    name: 'Everyday Card',
    kind: 'card',
    currency: 'USD',
    linkStatus: 'linked',
    provider: 'plaid',
    connectionId: 'item-1',
  });
}

function expense(accountId: string, id: string, date: string, amount = 12, merchant = 'Stream Box') {
  return createFinanceTransaction({
    id,
    amount,
    date,
    merchant,
    categoryId: 'other',
    entityId: 'personal',
    accountId,
    source: 'plaid',
    externalId: id,
    sourceCategory: 'ENTERTAINMENT_SUBSCRIPTION',
  });
}

function candidate(overrides: Partial<FinanceSubscriptionCandidate> = {}): FinanceSubscriptionCandidate {
  return {
    id: 'subscription:plaid:item-1:stream-1',
    source: 'plaid',
    status: 'pending',
    provider: 'plaid',
    connectionId: 'item-1',
    externalStreamId: 'stream-1',
    name: 'Stream Box',
    amount: 12,
    currency: 'USD',
    cadence: 'monthly',
    nextDue: '2026-09-01',
    accountId: 'account-local',
    categoryHint: 'ENTERTAINMENT_SUBSCRIPTION',
    suggestedKind: 'subscription',
    confidence: 0.98,
    active: true,
    materialFingerprint: '1200:monthly:active',
    detectedAt: '2026-08-14T12:00:00.000Z',
    ...overrides,
  };
}

describe('Finance subscription detection', () => {
  it('detects stable monthly linked charges and keeps account identity', () => {
    const account = linkedAccount();
    const result = detectLocalSubscriptionCandidates([
      expense(account.id, 'one', '2026-05-01'),
      expense(account.id, 'two', '2026-06-01', 13),
      expense(account.id, 'three', '2026-07-01', 12.5),
      expense(account.id, 'four', '2026-08-01', 12),
    ], [account], [], '2026-08-14');

    expect(result).toEqual([expect.objectContaining({
      source: 'local',
      provider: 'plaid',
      accountId: account.id,
      cadence: 'monthly',
      nextDue: '2026-09-01',
      active: true,
      suggestedKind: 'subscription',
    })]);
  });

  it('detects bill-like and two-charge patterns while rejecting unstable, generic single, refunded, and transferred patterns', () => {
    const account = linkedAccount();
    const variable = [
      expense(account.id, 'v1', '2026-05-01', 10, 'Variable Club'),
      expense(account.id, 'v2', '2026-06-01', 30, 'Variable Club'),
      expense(account.id, 'v3', '2026-07-01', 8, 'Variable Club'),
    ];
    const rent = ['2026-05-02', '2026-06-02', '2026-07-02'].map((date, index) =>
      expense(account.id, `r${index}`, date, 1200, 'Rent Payment'),
    );
    const refund = { ...expense(account.id, 'refund', '2026-08-02'), activity: 'refund' as const };
    const transfer = { ...expense(account.id, 'transfer', '2026-08-03'), activity: 'transfer' as const };

    const detected = detectLocalSubscriptionCandidates([
      ...variable,
      ...rent,
      expense(account.id, 'only-1', '2026-06-10', 7, 'Two Charges'),
      expense(account.id, 'only-2', '2026-07-10', 7, 'Two Charges'),
      {
        ...expense(account.id, 'generic-single', '2026-08-04', 18, 'Corner Shop'),
        sourceCategory: 'GENERAL_MERCHANDISE',
      },
      refund,
      transfer,
    ], [account], [], '2026-08-14');

    expect(detected).toEqual([
      expect.objectContaining({ name: 'Rent Payment', suggestedKind: 'bill' }),
      expect.objectContaining({ name: 'Two Charges', suggestedKind: 'subscription' }),
    ]);
  });

  it('suggests a single charge only when its category explicitly identifies a recurring expense', () => {
    const account = linkedAccount();
    const insurance = {
      ...expense(account.id, 'insurance', '2026-08-05', 140, 'Coverage Co'),
      sourceCategory: 'INSURANCE',
    };

    expect(detectLocalSubscriptionCandidates(
      [insurance],
      [account],
      [],
      '2026-08-14',
    )).toEqual([
      expect.objectContaining({
        name: 'Coverage Co',
        cadence: 'monthly',
        suggestedKind: 'insurance',
        confidence: 0.55,
      }),
    ]);
  });

  it('keeps same-named subscriptions on separate accounts distinct and defers to Plaid streams', () => {
    const first = linkedAccount('account-one');
    const second = linkedAccount('account-two');
    const rows = [first, second].flatMap((account) => [
      expense(account.id, `${account.id}-1`, '2026-05-01'),
      expense(account.id, `${account.id}-2`, '2026-06-01'),
      expense(account.id, `${account.id}-3`, '2026-07-01'),
    ]);
    const detected = detectLocalSubscriptionCandidates(rows, [first, second], [{
      name: 'Stream Box', accountId: first.id, currency: 'USD',
    }], '2026-08-14');

    expect(detected).toHaveLength(1);
    expect(detected[0]?.accountId).toBe(second.id);
  });

  it('normalizes active subscription cadences to a monthly total', () => {
    expect(monthlySubscriptionAmount([
      { amount: 12, cadence: 'monthly', active: true },
      { amount: 120, cadence: 'yearly', active: true },
      { amount: 5, cadence: 'weekly', active: false },
    ])).toBe(22);
  });

  it('normalizes bills and subscriptions together without counting inactive or one-time items', () => {
    expect(monthlyRecurringAmount([
      { amount: 120, cadence: 'yearly', active: true },
      { amount: 30, cadence: 'monthly', active: true },
      { amount: 15, cadence: 'monthly', active: false },
      { amount: 400, cadence: 'once', active: true },
    ])).toBe(40);
  });

  it('reclassifies a linked subscription as a bill without losing its financial data identity', () => {
    const linked = {
      ...createFinanceBill({
        id: 'geico',
        name: 'GEICO',
        amount: 83.41,
        currency: 'USD',
        cadence: 'monthly',
        nextDue: '2026-08-24',
        entityId: 'personal',
        kind: 'subscription',
      }),
      subscriptionLink: {
        candidateId: 'candidate-geico',
        source: 'plaid' as const,
        provider: 'plaid' as const,
        connectionId: 'item-1',
        materialFingerprint: '8341:monthly:active',
        lastSyncedAt: '2026-08-14T00:00:00.000Z',
      },
    };

    expect(categorizeRecurringExpense(linked, 'insurance')).toEqual(expect.objectContaining({
      id: 'geico',
      kind: 'insurance',
      categoryId: 'insurance',
      amount: 83.41,
      nextDue: '2026-08-24',
      subscriptionLink: linked.subscriptionLink,
    }));
  });

  it('reclassifies a bill as a subscription and clears bill-only APR metadata', () => {
    const loan = createFinanceBill({
      id: 'loan',
      name: 'Auto Loan',
      amount: 450,
      currency: 'USD',
      cadence: 'monthly',
      nextDue: '2026-09-01',
      entityId: 'personal',
      kind: 'loan',
      aprPercent: 4.5,
    });

    expect(categorizeRecurringExpense(loan, 'subscription')).toEqual(expect.objectContaining({
      id: 'loan',
      kind: 'subscription',
      categoryId: 'subscription',
      aprPercent: undefined,
    }));
  });

  it('edits a recurring expense name while preserving its linked identity', () => {
    const linked = createFinanceBill({
      id: 'cloud-storage',
      name: 'Original Name',
      amount: 2.99,
      currency: 'USD',
      cadence: 'monthly',
      nextDue: '2026-09-01',
      entityId: 'personal',
      kind: 'subscription',
    });

    expect(editRecurringExpense(linked, {
      name: '  Cloud Storage  ',
      kind: 'subscription',
    })).toEqual(expect.objectContaining({
      id: 'cloud-storage',
      name: 'Cloud Storage',
      amount: 2.99,
      nextDue: '2026-09-01',
      kind: 'subscription',
    }));
    expect(editRecurringExpense(linked, { name: '   ', kind: 'subscription' }).name)
      .toBe('Original Name');
  });
});

describe('Finance subscription reconciliation', () => {
  beforeEach(() => useFinance.getState().reset());

  it('confirms once, preserves identity, and refreshes provider fields only', () => {
    useFinance.getState().reconcileSubscriptionCandidates('plaid', 'item-1', [candidate()]);
    useFinance.getState().confirmSubscriptionCandidate(candidate().id);
    const confirmed = useFinance.getState().bills[0]!;
    useFinance.getState().reconcileSubscriptionCandidates('plaid', 'item-1', [candidate({
      amount: 15,
      nextDue: '2026-10-01',
      materialFingerprint: '1500:monthly:active',
    })]);

    expect(useFinance.getState().bills).toEqual([expect.objectContaining({
      id: confirmed.id,
      name: 'Stream Box',
      amount: 15,
      nextDue: '2026-10-01',
      kind: 'subscription',
    })]);
    expect(useFinance.getState().subscriptionCandidates).toEqual([]);
  });

  it('lets the reviewer override a detected recurring expense recommendation', () => {
    useFinance.getState().reconcileSubscriptionCandidates('plaid', 'item-1', [candidate({
      suggestedKind: 'bill',
    })]);

    useFinance.getState().confirmSubscriptionCandidate(candidate().id, 'subscription');

    expect(useFinance.getState().bills).toEqual([
      expect.objectContaining({ kind: 'subscription', categoryId: 'subscription' }),
    ]);
  });

  it('keeps dismissed candidates hidden until a material detail changes', () => {
    const original = candidate();
    useFinance.getState().reconcileSubscriptionCandidates('plaid', 'item-1', [original]);
    useFinance.getState().dismissSubscriptionCandidate(original.id);
    useFinance.getState().reconcileSubscriptionCandidates('plaid', 'item-1', [original]);
    expect(useFinance.getState().subscriptionCandidates).toEqual([]);

    useFinance.getState().reconcileSubscriptionCandidates('plaid', 'item-1', [candidate({
      amount: 16,
      materialFingerprint: '1600:monthly:active',
    })]);
    expect(useFinance.getState().subscriptionCandidates).toHaveLength(1);
    expect(useFinance.getState().dismissedSubscriptions).toEqual([]);
  });

  it('does not deactivate confirmed or manual subscriptions after a transient empty sync', () => {
    useFinance.getState().reconcileSubscriptionCandidates('plaid', 'item-1', [candidate()]);
    useFinance.getState().confirmSubscriptionCandidate(candidate().id);
    const personalId = useFinance.getState().entities[0]!.id;
    useFinance.getState().saveBill(createFinanceBill({
      id: 'manual-subscription',
      name: 'Manual Club',
      amount: 8,
      currency: 'USD',
      cadence: 'monthly',
      nextDue: '2026-09-05',
      entityId: personalId,
      kind: 'subscription',
    }));

    useFinance.getState().reconcileSubscriptionCandidates('plaid', 'item-1', []);

    expect(useFinance.getState().bills).toEqual(expect.arrayContaining([
      expect.objectContaining({ subscriptionLink: expect.any(Object), active: true }),
      expect.objectContaining({ id: 'manual-subscription', amount: 8, active: true }),
    ]));
  });

  it('continues refreshing a confirmed local candidate instead of deduplicating it away', () => {
    const account = linkedAccount();
    useFinance.getState().saveAccount(account);
    useFinance.getState().saveTransactions([
      expense(account.id, 'one', '2026-05-01'),
      expense(account.id, 'two', '2026-06-01'),
      expense(account.id, 'three', '2026-07-01'),
      expense(account.id, 'four', '2026-08-01'),
    ]);
    refreshLocalSubscriptionCandidates();
    const detected = useFinance.getState().subscriptionCandidates[0]!;
    useFinance.getState().confirmSubscriptionCandidate(detected.id);
    useFinance.getState().saveTransaction(expense(account.id, 'five', '2026-09-01'));

    refreshLocalSubscriptionCandidates();

    expect(useFinance.getState().bills).toEqual([
      expect.objectContaining({
        subscriptionLink: expect.objectContaining({ source: 'local' }),
        nextDue: '2026-10-01',
      }),
    ]);
    expect(useFinance.getState().subscriptionCandidates).toEqual([]);
  });

  it('does not rediscover a confirmed Plaid bill through fallback detection', () => {
    const account = linkedAccount();
    useFinance.getState().saveAccount(account);
    useFinance.getState().reconcileSubscriptionCandidates('plaid', 'item-1', [candidate({
      name: 'Rent Payment',
      suggestedKind: 'bill',
      accountId: account.id,
    })]);
    useFinance.getState().confirmSubscriptionCandidate(candidate().id);
    useFinance.getState().saveTransactions([
      expense(account.id, 'rent-one', '2026-05-01', 1200, 'Rent Payment'),
      expense(account.id, 'rent-two', '2026-06-01', 1200, 'Rent Payment'),
      expense(account.id, 'rent-three', '2026-07-01', 1200, 'Rent Payment'),
    ]);

    refreshLocalSubscriptionCandidates();

    expect(useFinance.getState().bills).toEqual([
      expect.objectContaining({ kind: 'bill', name: 'Rent Payment' }),
    ]);
    expect(useFinance.getState().subscriptionCandidates).toEqual([]);
  });
});
