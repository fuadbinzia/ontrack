import { loadTellerEnrollmentData, mapTellerTransaction } from '../teller-data';
import { tellerGatewayRequest } from '../teller-server';

jest.mock('../teller-server', () => ({
  TellerServerError: class TellerServerError extends Error {},
  tellerGatewayRequest: jest.fn(),
}));

const gateway = tellerGatewayRequest as jest.MockedFunction<typeof tellerGatewayRequest>;

describe('Teller data mapping', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps debit spending and excludes credits, invalid amounts, and incomplete rows', () => {
    expect(mapTellerTransaction({
      id: 'txn-1', account_id: 'acc-1', amount: '42.75', date: '2026-08-10',
      description: 'RAW MARKET', details: { counterparty: { name: 'Market' }, category: 'groceries' },
    })).toMatchObject({ externalId: 'txn-1', amount: 42.75, merchant: 'Market' });
    expect(mapTellerTransaction({
      id: 'credit', account_id: 'acc-1', amount: '-100', date: '2026-08-10',
    })).toBeUndefined();
    expect(mapTellerTransaction({
      id: 'invalid', account_id: 'acc-1', amount: 'NaN', date: '2026-08-10',
    })).toBeUndefined();
    expect(mapTellerTransaction({ amount: '10', date: '2026-08-10' })).toBeUndefined();
  });

  it('maps multiple open accounts, optional balances, and all-history transactions', async () => {
    gateway
      .mockResolvedValueOnce([
        {
          id: 'acc_checking', name: 'Checking', last_four: '1234', currency: 'USD',
          type: 'depository', subtype: 'checking', status: 'open',
          institution: { name: 'Example Bank' }, links: { balances: '/b', transactions: '/t' },
        },
        {
          id: 'acc_card', name: 'Card', currency: 'USD', type: 'credit',
          subtype: 'credit_card', status: 'open', links: { transactions: '/t' },
        },
        { id: 'acc_closed', status: 'closed' },
      ] as never)
      .mockResolvedValueOnce({ ledger: '1000.50', available: '900' } as never)
      .mockResolvedValueOnce([
        { id: 'txn-1', account_id: 'acc_checking', amount: '25', date: '2026-08-01', description: 'Shop' },
      ] as never)
      .mockResolvedValueOnce([
        { id: 'txn-2', account_id: 'acc_card', amount: '40', date: '2026-08-02', description: 'Cafe' },
      ] as never);

    const result = await loadTellerEnrollmentData({
      enrollmentId: 'enr-1', accessToken: 'server-token', institutionName: undefined,
    });

    expect(result.refreshedFrom).toBeUndefined();
    expect(result.institutionName).toBe('Example Bank');
    expect(result.accounts).toEqual([
      expect.objectContaining({ accountId: 'acc_checking', kind: 'bank', balance: 1000.5 }),
      expect.objectContaining({ accountId: 'acc_card', kind: 'card', balance: undefined }),
    ]);
    expect(result.transactions.map((row) => row.externalId)).toEqual(['txn-1', 'txn-2']);
    expect(gateway).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'transactions', query: { count: '500' },
    }));
  });

  it('refreshes a ten-day overlap after the first successful sync', async () => {
    gateway
      .mockResolvedValueOnce([{
        id: 'acc_checking', name: 'Checking', status: 'open', links: { transactions: '/t' },
      }] as never)
      .mockResolvedValueOnce([] as never);

    const result = await loadTellerEnrollmentData({
      enrollmentId: 'enr-1', accessToken: 'server-token', lastSyncedAt: '2026-08-14T12:00:00Z',
    });

    expect(result.refreshedFrom).toBe('2026-08-04');
    expect(gateway).toHaveBeenLastCalledWith(expect.objectContaining({
      query: { count: '500', start_date: '2026-08-04' },
    }));
  });
});
