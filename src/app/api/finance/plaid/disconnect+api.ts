import {
  deletePlaidItemRecord,
  loadPlaidItem,
  PlaidServerError,
  plaidApiOptions,
  plaidRequest,
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
    try {
      await plaidRequest('/item/remove', { access_token: item.accessToken });
    } catch (error) {
      if (!(error instanceof PlaidServerError) || error.code !== 'ITEM_NOT_FOUND') throw error;
    }
    await deletePlaidItemRecord(userId, itemId);
    return { ok: true, item_id: itemId };
  }, { rateLimit: false });
}
