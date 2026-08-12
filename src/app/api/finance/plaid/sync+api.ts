import {
  loadPlaidAccounts,
  loadPlaidHoldings,
  syncPlaidTransactionChanges,
} from '@/services/finance/plaid-data';
import {
  loadPlaidItem,
  plaidApiOptions,
  updatePlaidCursor,
  withPlaidApiAuth,
} from '@/services/finance/plaid-server';
import { apiCorsHeaders } from '@/services/http/cors';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) {
  return plaidApiOptions(request, METHODS);
}

export async function POST(request: Request) {
  return withPlaidApiAuth(request, async (request, userId) => {
    const body = await request.json().catch(() => ({})) as { item_id?: string };
    const itemId = body.item_id?.trim();
    if (!itemId) {
      return Response.json(
        { error: 'item_id is required.' },
        { status: 400, headers: apiCorsHeaders(request, METHODS) },
      );
    }
    const item = await loadPlaidItem(userId, itemId);
    if (item.purpose === 'investments') {
      const result = await loadPlaidHoldings(item.accessToken);
      return {
        configured: true,
        purpose: item.purpose,
        accounts: result.accounts,
        holdings: result.holdings,
        transactions: [],
        removed_external_ids: [],
        sync_status: 'ready',
      };
    }

    const [accounts, changes] = await Promise.all([
      loadPlaidAccounts(item.accessToken),
      syncPlaidTransactionChanges(item.accessToken, item.cursor),
    ]);
    await updatePlaidCursor(userId, itemId, changes.cursor);
    return {
      configured: true,
      purpose: item.purpose,
      accounts,
      holdings: [],
      transactions: changes.transactions,
      removed_external_ids: changes.removedExternalIds,
      sync_status: changes.pending ? 'pending' : 'ready',
    };
  });
}
