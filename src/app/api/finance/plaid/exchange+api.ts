import {
  loadPlaidAccounts,
  loadPlaidHoldings,
  syncPlaidTransactionChanges,
} from '@/services/finance/plaid-data';
import {
  deletePlaidLinkSession,
  PlaidServerError,
  plaidApiOptions,
  plaidRequest,
  requirePlaidLinkSession,
  savePlaidItem,
  updatePlaidCursor,
  withPlaidApiAuth,
} from '@/services/finance/plaid-server';
import { apiCorsHeaders } from '@/services/http/cors';

const METHODS = 'POST, OPTIONS';

type LinkSessionResult = {
  public_token?: string;
  institution?: { institution_id?: string; name?: string };
};

type LinkTokenGetBody = {
  link_sessions?: {
    finished_at?: string | null;
    results?: { item_add_results?: LinkSessionResult[] };
    on_success?: {
      public_token?: string;
      metadata?: { institution?: { institution_id?: string; name?: string } };
    };
  }[];
};

function completedLinkResult(body: LinkTokenGetBody): LinkSessionResult | undefined {
  const sessions = [...(body.link_sessions ?? [])].reverse();
  for (const session of sessions) {
    if (!session.finished_at) continue;
    const current = session.results?.item_add_results?.[0];
    if (current?.public_token) return current;
    if (session.on_success?.public_token) {
      return {
        public_token: session.on_success.public_token,
        institution: session.on_success.metadata?.institution,
      };
    }
  }
  return undefined;
}

export function OPTIONS(request: Request) {
  return plaidApiOptions(request, METHODS);
}

export async function POST(request: Request) {
  return withPlaidApiAuth(request, async (request, userId) => {
    const body = await request.json().catch(() => ({})) as { link_token?: string };
    const linkToken = body.link_token?.trim();
    if (!linkToken) {
      return Response.json(
        { error: 'link_token is required.' },
        { status: 400, headers: apiCorsHeaders(request, METHODS) },
      );
    }
    const { purpose } = await requirePlaidLinkSession(linkToken, userId);
    const link = await plaidRequest<LinkTokenGetBody>('/link/token/get', {
      link_token: linkToken,
    });
    const completed = completedLinkResult(link);
    if (!completed?.public_token) {
      throw new PlaidServerError(
        'Plaid Link is still completing. Try again in a moment.',
        'LINK_PENDING',
        409,
      );
    }

    const exchange = await plaidRequest<{ access_token?: string; item_id?: string }>(
      '/item/public_token/exchange',
      { public_token: completed.public_token },
    );
    if (!exchange.access_token || !exchange.item_id) {
      throw new PlaidServerError('Plaid token exchange was incomplete.', 'INVALID_RESPONSE');
    }
    const institutionId = completed.institution?.institution_id;
    const institutionName = completed.institution?.name;
    await savePlaidItem({
      userId,
      itemId: exchange.item_id,
      accessToken: exchange.access_token,
      purpose,
      institutionId,
      institutionName,
      cursor: null,
    });

    let accounts: Awaited<ReturnType<typeof loadPlaidAccounts>> = [];
    let holdings: Awaited<ReturnType<typeof loadPlaidHoldings>>['holdings'] = [];
    let transactions: Awaited<ReturnType<typeof syncPlaidTransactionChanges>>['transactions'] = [];
    let removedExternalIds: string[] = [];
    let syncStatus: 'ready' | 'pending' | 'error' = 'ready';
    let syncError: string | undefined;

    try {
      if (purpose === 'investments') {
        const investmentData = await loadPlaidHoldings(exchange.access_token);
        accounts = investmentData.accounts;
        holdings = investmentData.holdings;
      } else {
        const [linkedAccounts, changes] = await Promise.all([
          loadPlaidAccounts(exchange.access_token),
          syncPlaidTransactionChanges(exchange.access_token, null),
        ]);
        accounts = linkedAccounts;
        transactions = changes.transactions;
        removedExternalIds = changes.removedExternalIds;
        syncStatus = changes.pending ? 'pending' : 'ready';
        await updatePlaidCursor(userId, exchange.item_id, changes.cursor);
      }
    } catch (error) {
      syncStatus = 'error';
      syncError = error instanceof Error ? error.message : 'Initial Plaid sync failed.';
    }

    await deletePlaidLinkSession(linkToken);
    return {
      configured: true,
      item_id: exchange.item_id,
      institution_id: institutionId,
      institution_name: institutionName,
      purpose,
      accounts,
      holdings,
      transactions,
      removed_external_ids: removedExternalIds,
      sync_status: syncStatus,
      sync_error: syncError,
    };
  });
}
