import {
  loadPlaidHoldings,
  mapPlaidAccounts,
  syncPlaidTransactionChanges,
} from '../plaid-data';

function plaidResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Plaid transaction sync', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.PLAID_CLIENT_ID = 'client-test';
    process.env.PLAID_SECRET = 'secret-test';
    process.env.PLAID_ENV = 'sandbox';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('paginates, preserves account identity, and excludes inflows from expenses', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        plaidResponse({
          added: [
            {
              transaction_id: 'expense-1',
              account_id: 'account-checking',
              amount: 42.5,
              date: '2026-08-10',
              merchant_name: 'Market',
              iso_currency_code: 'USD',
            },
            {
              transaction_id: 'deposit-1',
              account_id: 'account-checking',
              amount: -1000,
              date: '2026-08-10',
              name: 'Payroll',
            },
          ],
          modified: [],
          removed: [],
          next_cursor: 'cursor-1',
          has_more: true,
        }),
      )
      .mockResolvedValueOnce(
        plaidResponse({
          added: [
            {
              transaction_id: 'expense-2',
              account_id: 'account-card',
              amount: 9.25,
              date: '2026-08-11',
              merchant_name: 'Cafe',
              iso_currency_code: 'USD',
            },
          ],
          modified: [],
          removed: [{ transaction_id: 'old-pending' }],
          next_cursor: 'cursor-2',
          has_more: false,
        }),
      );

    const result = await syncPlaidTransactionChanges('server-token', null);

    expect(result.cursor).toBe('cursor-2');
    expect(result.transactions).toEqual([
      expect.objectContaining({ externalId: 'expense-1', accountId: 'account-checking', amount: 42.5 }),
      expect.objectContaining({ externalId: 'expense-2', accountId: 'account-card', amount: 9.25 }),
    ]);
    expect(result.removedExternalIds).toEqual(
      expect.arrayContaining(['deposit-1', 'old-pending']),
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('restarts the entire cursor page set after a mutation error', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        plaidResponse({ added: [], next_cursor: 'page-2', has_more: true }),
      )
      .mockResolvedValueOnce(
        plaidResponse(
          {
            error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION',
            error_message: 'retry from original cursor',
          },
          400,
        ),
      )
      .mockResolvedValueOnce(
        plaidResponse({ added: [], next_cursor: 'stable-2', has_more: true }),
      )
      .mockResolvedValueOnce(
        plaidResponse({ added: [], next_cursor: 'stable-final', has_more: false }),
      );

    await expect(syncPlaidTransactionChanges('server-token', 'original')).resolves.toMatchObject({
      cursor: 'stable-final',
    });
    const bodies = (global.fetch as jest.Mock).mock.calls.map(([, init]) =>
      JSON.parse(String(init.body)),
    );
    expect(bodies[0].cursor).toBe('original');
    expect(bodies[2].cursor).toBe('original');
  });

  it('lets later modifications and removals win across cursor pages', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        plaidResponse({
          added: [
            {
              transaction_id: 'changed-1',
              account_id: 'account-card',
              amount: 20,
              date: '2026-08-10',
              name: 'Original merchant',
            },
            {
              transaction_id: 'removed-1',
              account_id: 'account-card',
              amount: 30,
              date: '2026-08-10',
              name: 'Removed later',
            },
          ],
          next_cursor: 'page-2',
          has_more: true,
        }),
      )
      .mockResolvedValueOnce(
        plaidResponse({
          modified: [
            {
              transaction_id: 'changed-1',
              account_id: 'account-card',
              amount: 25,
              date: '2026-08-11',
              merchant_name: 'Updated merchant',
            },
          ],
          removed: [{ transaction_id: 'removed-1' }],
          next_cursor: 'final',
          has_more: false,
        }),
      );

    const result = await syncPlaidTransactionChanges('server-token', 'starting-cursor');

    expect(result.transactions).toEqual([
      expect.objectContaining({
        externalId: 'changed-1',
        amount: 25,
        date: '2026-08-11',
        merchant: 'Updated merchant',
      }),
    ]);
    expect(result.removedExternalIds).toEqual(['removed-1']);
  });

  it('removes an existing expense when Plaid modifies it into an inflow or refund', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      plaidResponse({
        modified: [
          {
            transaction_id: 'refund-1',
            account_id: 'account-card',
            amount: -14.5,
            date: '2026-08-12',
            name: 'Refund',
          },
        ],
        next_cursor: 'after-refund',
        has_more: false,
      }),
    );

    await expect(syncPlaidTransactionChanges('server-token', 'before-refund')).resolves.toEqual({
      transactions: [],
      removedExternalIds: ['refund-1'],
      cursor: 'after-refund',
      pending: false,
    });
  });

  it('marks an empty initial cursor response pending but not a later empty sync', async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve(
        plaidResponse({ added: [], modified: [], removed: [], next_cursor: '', has_more: false }),
      ),
    );

    await expect(syncPlaidTransactionChanges('server-token', null)).resolves.toMatchObject({
      pending: true,
    });
    await expect(syncPlaidTransactionChanges('server-token', 'existing')).resolves.toMatchObject({
      pending: false,
    });
  });

  it('rejects a sync response without a cursor instead of reporting false success', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      plaidResponse({ added: [], modified: [], removed: [], has_more: false }),
    );

    await expect(syncPlaidTransactionChanges('server-token', null)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('stops after three unstable pagination attempts', async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve(
        plaidResponse(
          {
            error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION',
            error_message: 'unstable cursor',
          },
          400,
        ),
      ),
    );

    await expect(syncPlaidTransactionChanges('server-token', 'original')).rejects.toMatchObject({
      code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION',
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

describe('Plaid account and holding mapping', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.PLAID_CLIENT_ID = 'client-test';
    process.env.PLAID_SECRET = 'secret-test';
    process.env.PLAID_ENV = 'sandbox';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses official account names, finite balances, and unofficial currencies', () => {
    expect(
      mapPlaidAccounts([
        {
          account_id: 'account-1',
          name: 'Fallback name',
          official_name: 'Official checking',
          type: 'depository',
          subtype: 'checking',
          balances: { current: 120.5, unofficial_currency_code: 'POINTS' },
        },
        {
          account_id: 'account-2',
          name: 'Bad balance',
          type: 'credit',
          balances: { current: Number.NaN, iso_currency_code: 'USD' },
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        accountId: 'account-1',
        name: 'Official checking',
        kind: 'bank',
        balance: 120.5,
        currency: 'POINTS',
      }),
      expect.objectContaining({
        accountId: 'account-2',
        name: 'Bad balance',
        kind: 'card',
        balance: undefined,
        currency: 'USD',
      }),
    ]);
  });

  it('filters malformed holdings while preserving account identity and currency fallback', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      plaidResponse({
        accounts: [
          {
            account_id: 'brokerage-1',
            name: 'Brokerage',
            type: 'investment',
            subtype: 'brokerage',
            balances: { current: 5000, iso_currency_code: 'USD' },
          },
        ],
        securities: [{ security_id: 'security-1', ticker_symbol: 'VTI' }],
        holdings: [
          {
            account_id: 'brokerage-1',
            security_id: 'security-1',
            quantity: 2,
            institution_value: 600,
            unofficial_currency_code: 'UNITS',
          },
          {
            account_id: 'brokerage-1',
            security_id: 'missing-value',
          },
        ],
      }),
    );

    const result = await loadPlaidHoldings('server-token');

    expect(result.accounts).toEqual([
      expect.objectContaining({ accountId: 'brokerage-1', kind: 'brokerage' }),
    ]);
    expect(result.holdings).toEqual([
      expect.objectContaining({
        accountId: 'brokerage-1',
        externalId: 'brokerage-1:security-1',
        symbol: 'VTI',
        quantity: 2,
        value: 600,
        currency: 'UNITS',
      }),
    ]);
  });
});
