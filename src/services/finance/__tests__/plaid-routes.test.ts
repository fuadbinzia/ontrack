import * as disconnectRoute from '../../../app/api/finance/plaid/disconnect+api';
import * as exchangeRoute from '../../../app/api/finance/plaid/exchange+api';
import * as linkTokenRoute from '../../../app/api/finance/plaid/link-token+api';
import * as syncRoute from '../../../app/api/finance/plaid/sync+api';
import { PlaidServerError } from '../plaid-server';

const mockPlaidRequest = jest.fn();
const mockStorePlaidLinkSession = jest.fn();
const mockRequirePlaidLinkSession = jest.fn();
const mockDeletePlaidLinkSession = jest.fn();
const mockSavePlaidItem = jest.fn();
const mockLoadPlaidItem = jest.fn();
const mockUpdatePlaidCursor = jest.fn();
const mockDeletePlaidItemRecord = jest.fn();
const mockLoadPlaidAccounts = jest.fn();
const mockLoadPlaidHoldings = jest.fn();
const mockSyncPlaidTransactionChanges = jest.fn();

jest.mock('../plaid-server', () => {
  class PlaidServerError extends Error {
    code?: string;
    status: number;

    constructor(
      message: string,
      errorCode?: string,
      httpStatus = 502,
    ) {
      super(message);
      this.name = 'PlaidServerError';
      this.code = errorCode;
      this.status = httpStatus;
    }
  }
  return {
    PlaidServerError,
    plaidApiOptions: jest.fn(() => new Response(null, { status: 204 })),
    plaidRequest: (...args: unknown[]) => mockPlaidRequest(...args),
    storePlaidLinkSession: (...args: unknown[]) => mockStorePlaidLinkSession(...args),
    requirePlaidLinkSession: (...args: unknown[]) => mockRequirePlaidLinkSession(...args),
    deletePlaidLinkSession: (...args: unknown[]) => mockDeletePlaidLinkSession(...args),
    savePlaidItem: (...args: unknown[]) => mockSavePlaidItem(...args),
    loadPlaidItem: (...args: unknown[]) => mockLoadPlaidItem(...args),
    updatePlaidCursor: (...args: unknown[]) => mockUpdatePlaidCursor(...args),
    deletePlaidItemRecord: (...args: unknown[]) => mockDeletePlaidItemRecord(...args),
    withPlaidApiAuth: (request: Request, handler: (request: Request, userId: string) => unknown) =>
      handler(request, 'user-1'),
  };
});

jest.mock('../plaid-data', () => ({
  loadPlaidAccounts: (...args: unknown[]) => mockLoadPlaidAccounts(...args),
  loadPlaidHoldings: (...args: unknown[]) => mockLoadPlaidHoldings(...args),
  syncPlaidTransactionChanges: (...args: unknown[]) => mockSyncPlaidTransactionChanges(...args),
}));

function request(path: string, body: unknown): Request {
  return new Request(`https://ontrack.example${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Plaid API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorePlaidLinkSession.mockResolvedValue(undefined);
    mockDeletePlaidLinkSession.mockResolvedValue(undefined);
    mockSavePlaidItem.mockResolvedValue(undefined);
    mockUpdatePlaidCursor.mockResolvedValue(undefined);
    mockDeletePlaidItemRecord.mockResolvedValue(undefined);
  });

  it('binds Hosted Link to the authenticated user and stores its ownership session', async () => {
    mockPlaidRequest.mockResolvedValueOnce({
      link_token: 'link-token',
      hosted_link_url: 'https://secure.plaid.test/link',
      expiration: '2026-08-12T18:00:00.000Z',
    });

    const result = await linkTokenRoute.POST(request('/link-token', {
      purpose: 'transactions',
      native: true,
    })) as unknown as Record<string, unknown>;

    expect(mockPlaidRequest).toHaveBeenCalledWith('/link/token/create', expect.objectContaining({
      user: { client_user_id: 'user-1' },
      products: ['investments'],
      hosted_link: expect.objectContaining({
        completion_redirect_uri: 'ontrack://plaid/complete',
        is_mobile_app: true,
      }),
    }));
    expect(mockStorePlaidLinkSession).toHaveBeenCalledWith({
      linkToken: 'link-token',
      userId: 'user-1',
      purpose: 'investments',
      expiration: '2026-08-12T18:00:00.000Z',
    });
    expect(result).toMatchObject({ link_token: 'link-token', configured: true });
  });

  it('rejects exchange requests without a Link token before contacting Plaid', async () => {
    const response = await exchangeRoute.POST(request('/exchange', {}));

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'link_token is required.' });
    expect(mockPlaidRequest).not.toHaveBeenCalled();
    expect(mockSavePlaidItem).not.toHaveBeenCalled();
  });

  it('stores the exchanged token before loading data and persists the transaction cursor', async () => {
    mockRequirePlaidLinkSession.mockResolvedValueOnce({ purpose: 'transactions' });
    mockPlaidRequest
      .mockResolvedValueOnce({
        link_sessions: [{
          finished_at: '2026-08-12T12:00:00.000Z',
          results: { item_add_results: [{
            public_token: 'public-token',
            institution: { institution_id: 'ins-1', name: 'Example Bank' },
          }] },
        }],
      })
      .mockResolvedValueOnce({ access_token: 'server-access-token', item_id: 'item-1' });
    mockLoadPlaidAccounts.mockResolvedValueOnce([
      { accountId: 'account-1', name: 'Checking', kind: 'bank' },
    ]);
    mockSyncPlaidTransactionChanges.mockResolvedValueOnce({
      transactions: [],
      removedExternalIds: [],
      cursor: 'cursor-1',
      pending: false,
    });

    const result = await exchangeRoute.POST(request('/exchange', {
      link_token: 'link-token',
    })) as unknown as Record<string, unknown>;

    expect(mockRequirePlaidLinkSession).toHaveBeenCalledWith('link-token', 'user-1');
    expect(mockSavePlaidItem).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      itemId: 'item-1',
      accessToken: 'server-access-token',
      purpose: 'transactions',
    }));
    expect(mockSavePlaidItem.mock.invocationCallOrder[0]).toBeLessThan(
      mockSyncPlaidTransactionChanges.mock.invocationCallOrder[0]!,
    );
    expect(mockUpdatePlaidCursor).toHaveBeenCalledWith('user-1', 'item-1', 'cursor-1');
    expect(mockDeletePlaidLinkSession).toHaveBeenCalledWith('link-token');
    expect(result).toMatchObject({
      item_id: 'item-1',
      institution_name: 'Example Bank',
      sync_status: 'ready',
    });
  });

  it('returns an error sync status without losing the securely stored Item', async () => {
    mockRequirePlaidLinkSession.mockResolvedValueOnce({ purpose: 'transactions' });
    mockPlaidRequest
      .mockResolvedValueOnce({
        link_sessions: [{
          finished_at: '2026-08-12T12:00:00.000Z',
          on_success: { public_token: 'public-token' },
        }],
      })
      .mockResolvedValueOnce({ access_token: 'server-access-token', item_id: 'item-1' });
    mockLoadPlaidAccounts.mockRejectedValueOnce(new Error('Accounts unavailable'));
    mockSyncPlaidTransactionChanges.mockResolvedValueOnce({
      transactions: [], removedExternalIds: [], cursor: '', pending: true,
    });

    const result = await exchangeRoute.POST(request('/exchange', {
      link_token: 'link-token',
    })) as unknown as Record<string, unknown>;

    expect(mockSavePlaidItem).toHaveBeenCalledTimes(1);
    expect(mockDeletePlaidLinkSession).toHaveBeenCalledWith('link-token');
    expect(result).toMatchObject({
      item_id: 'item-1',
      sync_status: 'error',
      sync_error: 'Accounts unavailable',
    });
  });

  it('rejects legacy Plaid transaction syncs so banks migrate to Teller', async () => {
    mockLoadPlaidItem.mockResolvedValueOnce({
      itemId: 'item-1',
      accessToken: 'server-access-token',
      purpose: 'transactions',
      cursor: 'cursor-before',
    });
    await expect(syncRoute.POST(request('/sync', {
      item_id: 'item-1',
      access_token: 'malicious-client-token',
    }))).rejects.toMatchObject({ code: 'PROVIDER_MIGRATION_REQUIRED', status: 409 });

    expect(mockLoadPlaidItem).toHaveBeenCalledWith('user-1', 'item-1');
    expect(mockSyncPlaidTransactionChanges).not.toHaveBeenCalled();
    expect(mockUpdatePlaidCursor).not.toHaveBeenCalled();
  });

  it('loads an investment snapshot without using the transaction cursor endpoint', async () => {
    mockLoadPlaidItem.mockResolvedValueOnce({
      itemId: 'item-investments',
      accessToken: 'server-access-token',
      purpose: 'investments',
      cursor: null,
    });
    mockLoadPlaidHoldings.mockResolvedValueOnce({
      accounts: [{ accountId: 'brokerage-1', name: 'Brokerage', kind: 'brokerage' }],
      holdings: [{
        accountId: 'brokerage-1', externalId: 'holding-1', name: 'Fund', value: 100,
        currency: 'USD', asOf: '2026-08-12',
      }],
    });

    const result = await syncRoute.POST(request('/sync', {
      item_id: 'item-investments',
    })) as unknown as Record<string, unknown>;

    expect(mockLoadPlaidHoldings).toHaveBeenCalledWith('server-access-token');
    expect(mockSyncPlaidTransactionChanges).not.toHaveBeenCalled();
    expect(mockUpdatePlaidCursor).not.toHaveBeenCalled();
    expect(result).toMatchObject({ purpose: 'investments', sync_status: 'ready' });
  });

  it('revokes the server-owned token before deleting the Item record', async () => {
    mockLoadPlaidItem.mockResolvedValueOnce({
      itemId: 'item-1',
      accessToken: 'server-access-token',
      purpose: 'transactions',
      cursor: null,
    });
    mockPlaidRequest.mockResolvedValueOnce({ removed: true });

    const result = await disconnectRoute.POST(request('/disconnect', {
      item_id: 'item-1',
      access_token: 'malicious-client-token',
    })) as unknown as Record<string, unknown>;

    expect(mockPlaidRequest).toHaveBeenCalledWith('/item/remove', {
      access_token: 'server-access-token',
    });
    expect(mockPlaidRequest.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeletePlaidItemRecord.mock.invocationCallOrder[0]!,
    );
    expect(mockDeletePlaidItemRecord).toHaveBeenCalledWith('user-1', 'item-1');
    expect(result).toEqual({ ok: true, item_id: 'item-1' });
  });

  it('cleans up an already-revoked Item but retains the record after other Plaid failures', async () => {
    mockLoadPlaidItem.mockResolvedValue({
      itemId: 'item-1',
      accessToken: 'server-access-token',
      purpose: 'transactions',
      cursor: null,
    });
    mockPlaidRequest
      .mockRejectedValueOnce(new PlaidServerError('Already gone', 'ITEM_NOT_FOUND', 502))
      .mockRejectedValueOnce(new PlaidServerError('Plaid unavailable', 'INTERNAL_SERVER_ERROR', 503));

    await expect(disconnectRoute.POST(request('/disconnect', { item_id: 'item-1' })))
      .resolves.toEqual({ ok: true, item_id: 'item-1' });
    expect(mockDeletePlaidItemRecord).toHaveBeenCalledTimes(1);

    await expect(disconnectRoute.POST(request('/disconnect', { item_id: 'item-1' })))
      .rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    expect(mockDeletePlaidItemRecord).toHaveBeenCalledTimes(1);
  });
});
