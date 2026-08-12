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
    expect(
      normalizeTransaction({
        amount: 10,
        date: '2026-08-01',
        entityId: 'e1',
        merchant: 'Cafe',
      })?.source,
    ).toBe('manual');
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
