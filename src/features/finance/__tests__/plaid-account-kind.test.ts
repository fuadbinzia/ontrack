import { mapPlaidLinkedHoldings } from '../plaid-holdings';
import { mapPlaidAccountKind } from '../plaid-account-kind';

describe('plaid account kind', () => {
  it('maps retirement and brokerage subtypes', () => {
    expect(mapPlaidAccountKind('investment', '401k')).toBe('retirement_401k');
    expect(mapPlaidAccountKind('investment', 'roth 401k')).toBe('retirement_401k');
    expect(mapPlaidAccountKind('investment', 'ira')).toBe('ira');
    expect(mapPlaidAccountKind('investment', 'brokerage')).toBe('brokerage');
    expect(mapPlaidAccountKind('investment', 'hsa')).toBe('hsa');
    expect(mapPlaidAccountKind('depository', 'checking')).toBe('bank');
    expect(mapPlaidAccountKind('credit', 'credit card')).toBe('card');
    expect(mapPlaidAccountKind('cryptocurrency', 'crypto exchange')).toBe('crypto');
  });
});

describe('plaid holdings map', () => {
  it('joins holdings to securities', () => {
    const rows = mapPlaidLinkedHoldings(
      [
        {
          account_id: 'acc-1',
          security_id: 'sec-1',
          quantity: 10,
          institution_value: 2500,
          iso_currency_code: 'USD',
        },
      ],
      [{ security_id: 'sec-1', ticker_symbol: 'VTI', name: 'Vanguard Total' }],
      '2026-08-12',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.symbol).toBe('VTI');
    expect(rows[0]?.value).toBe(2500);
    expect(rows[0]?.externalId).toBe('acc-1:sec-1');
  });
});
