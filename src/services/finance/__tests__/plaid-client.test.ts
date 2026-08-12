import {
  completePlaidLink,
  createPlaidLinkToken,
  disconnectPlaidItem,
  FinanceServiceError,
  openPlaidHostedLink,
  syncPlaidItem,
} from '../plaid';

const mockApiRequest = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();

jest.mock('@/services/http/api-client', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));
jest.mock('@/services/http/api-url', () => ({
  resolveExpoApiUrl: (path: string) => path,
}));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
}));

describe('Plaid client service', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('creates an authenticated Hosted Link session for the requested product', async () => {
    mockApiRequest.mockResolvedValueOnce({
      link_token: 'link-token',
      hosted_link_url: 'https://secure.plaid.test/link',
      completion_redirect_uri: 'ontrack://plaid/complete',
    });

    await expect(createPlaidLinkToken('investments')).resolves.toEqual({
      ok: true,
      linkToken: 'link-token',
      hostedLinkUrl: 'https://secure.plaid.test/link',
      completionRedirectUri: 'ontrack://plaid/complete',
    });
    expect(mockApiRequest).toHaveBeenCalledWith(expect.objectContaining({
      url: '/api/finance/plaid/link-token',
      authenticate: true,
      body: { purpose: 'investments', native: true },
    }));
  });

  it('does not claim success when Hosted Link returns an incomplete response', async () => {
    mockApiRequest.mockResolvedValueOnce({ configured: true });

    await expect(createPlaidLinkToken()).resolves.toEqual({
      ok: false,
      configured: true,
      error: 'Plaid did not return a Hosted Link session.',
    });
  });

  it.each(['cancel', 'dismiss'] as const)(
    'reports a %s browser result as cancellation',
    async (type) => {
      mockOpenAuthSessionAsync.mockResolvedValueOnce({ type });

      await expect(openPlaidHostedLink({
        ok: true,
        linkToken: 'link-token',
        hostedLinkUrl: 'https://secure.plaid.test/link',
        completionRedirectUri: 'ontrack://plaid/complete',
      })).rejects.toMatchObject({ code: 'CANCELLED' });
    },
  );

  it('requires an explicit successful Hosted Link completion', async () => {
    mockOpenAuthSessionAsync.mockResolvedValueOnce({ type: 'locked' });

    await expect(openPlaidHostedLink({
      ok: true,
      linkToken: 'link-token',
      hostedLinkUrl: 'https://secure.plaid.test/link',
      completionRedirectUri: 'ontrack://plaid/complete',
    })).rejects.toMatchObject({ code: 'LINK_INCOMPLETE' });
  });

  it('retries a temporarily pending Hosted Link exchange and then normalizes the result', async () => {
    jest.useFakeTimers();
    mockApiRequest
      .mockRejectedValueOnce(new FinanceServiceError('Still finishing', 'LINK_PENDING', 409))
      .mockResolvedValueOnce({
        item_id: 'item-1',
        purpose: 'transactions',
        accounts: [{ accountId: 'account-1', name: 'Checking', type: 'depository' }],
        transactions: [],
        holdings: [],
        removed_external_ids: [],
        sync_status: 'pending',
      });

    const completion = completePlaidLink('link-token');
    await jest.runAllTimersAsync();

    await expect(completion).resolves.toEqual(expect.objectContaining({
      ok: true,
      itemId: 'item-1',
      syncStatus: 'pending',
      accounts: [expect.objectContaining({ accountId: 'account-1', kind: 'bank' })],
    }));
    expect(mockApiRequest).toHaveBeenCalledTimes(2);
    expect(mockApiRequest).toHaveBeenLastCalledWith(expect.objectContaining({
      body: { link_token: 'link-token' },
    }));
  });

  it('syncs and disconnects using only the server-owned Item id', async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        purpose: 'transactions',
        accounts: [],
        holdings: [],
        transactions: [],
        removed_external_ids: ['removed-1'],
        sync_status: 'ready',
      })
      .mockResolvedValueOnce({ ok: true });

    await expect(syncPlaidItem('item-1')).resolves.toEqual(expect.objectContaining({
      ok: true,
      removedExternalIds: ['removed-1'],
    }));
    await expect(disconnectPlaidItem('item-1')).resolves.toBeUndefined();

    expect(mockApiRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({
      url: '/api/finance/plaid/sync',
      body: { item_id: 'item-1' },
      authenticate: true,
    }));
    expect(mockApiRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      url: '/api/finance/plaid/disconnect',
      body: { item_id: 'item-1' },
      authenticate: true,
    }));
    const serializedCalls = JSON.stringify(mockApiRequest.mock.calls);
    expect(serializedCalls).not.toContain('access_token');
    expect(serializedCalls).not.toContain('accessToken');
  });

  it('distinguishes an unconfigured server from a temporary sync failure', async () => {
    mockApiRequest
      .mockRejectedValueOnce(new FinanceServiceError('Not configured', 'NOT_CONFIGURED', 503))
      .mockRejectedValueOnce(new FinanceServiceError('Temporary outage', 'UPSTREAM', 503));

    await expect(syncPlaidItem('item-1')).resolves.toEqual({
      ok: false,
      configured: false,
      error: 'Not configured',
    });
    await expect(syncPlaidItem('item-1')).resolves.toEqual({
      ok: false,
      configured: true,
      error: 'Temporary outage',
    });
  });
});
