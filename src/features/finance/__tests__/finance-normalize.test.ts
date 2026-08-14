import {
  normalizeAccount,
  normalizeCreditScore,
  normalizeFinanceSnapshot,
  normalizeHolding,
  normalizeTransaction,
} from '../normalize';

describe('finance normalize', () => {
  it('ensures a personal entity exists', () => {
    const snap = normalizeFinanceSnapshot({});
    expect(snap.entities.some((e) => e.kind === 'personal')).toBe(true);
    expect(snap.baseCurrency).toBe('USD');
    expect(snap.holdings).toEqual([]);
  });

  it('drops invalid transactions', () => {
    expect(normalizeTransaction({ amount: 10, date: 'nope' })).toBeUndefined();
    const legacy = normalizeTransaction({
        amount: 10,
        date: '2026-08-01',
        entityId: 'e1',
        merchant: 'Cafe',
      });
    expect(legacy?.source).toBe('manual');
    expect(legacy?.activity).toBe('expense');
    const replenishment = normalizeTransaction({
      amount: 25,
      date: '2026-08-02',
      entityId: 'e1',
      source: 'ezpass',
      activity: 'transfer',
      activityTime: '16:25:15',
      categoryId: 'transport',
    });
    expect(replenishment?.activity).toBe('transfer');
    expect(replenishment?.categoryId).toBe('ezpass_replenishment');
    expect(replenishment?.activityTime).toBe('16:25:15');
    expect(normalizeTransaction({
      amount: 25,
      date: '2026-08-02',
      entityId: 'e1',
      activityTime: '4:25 PM',
    })?.activityTime).toBeUndefined();

    const tagged = normalizeTransaction({
      amount: 8,
      date: '2026-08-03',
      entityId: 'e1',
      source: 'ezpass',
      ezPassFriendId: 'friend-synthetic',
      ezPassFriendName: 'Sample Friend',
    });
    expect(tagged).toEqual(expect.objectContaining({
      ezPassFriendId: 'friend-synthetic',
      ezPassFriendName: 'Sample Friend',
    }));
    expect(normalizeTransaction({
      amount: 8,
      date: '2026-08-03',
      entityId: 'e1',
      source: 'manual',
      ezPassFriendId: 'friend-synthetic',
      ezPassFriendName: 'Sample Friend',
    })).toEqual(expect.objectContaining({
      ezPassFriendId: undefined,
      ezPassFriendName: undefined,
    }));
  });

  it('keeps investment account kinds and balances', () => {
    const account = normalizeAccount({
      id: 'a1',
      name: 'Fidelity 401k',
      kind: 'retirement_401k',
      balance: 12500.5,
      balanceAsOf: '2026-08-12',
    });
    expect(account?.kind).toBe('retirement_401k');
    expect(account?.balance).toBe(12500.5);
  });

  it('normalizes holdings and credit snapshots', () => {
    expect(
      normalizeHolding({
        accountId: 'a1',
        name: 'VTI',
        value: 1000,
        asOf: '2026-08-12',
      })?.name,
    ).toBe('VTI');
    expect(normalizeHolding({ accountId: 'a1', value: 10 })).toBeUndefined();

    const credit = normalizeCreditScore({
      current: {
        score: 740,
        bureau: 'equifax',
        model: 'vantage_4',
        asOf: '2026-08-01',
      },
      history: [
        { score: 720, bureau: 'equifax', model: 'vantage_4', asOf: '2026-07-01' },
        { score: 90, bureau: 'equifax', model: 'vantage_4', asOf: '2026-06-01' },
      ],
    });
    expect(credit?.current?.score).toBe(740);
    expect(credit?.history).toHaveLength(1);
  });
});
