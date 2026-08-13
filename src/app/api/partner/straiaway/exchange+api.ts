import { apiCorsHeaders, apiOptionsResponse } from '@/services/http/cors';
import { partnerErrorMessage } from '@/services/partner/crypto';
import { exchangeStraiAwayCode } from '@/services/partner/straiaway-server';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) {
  return apiOptionsResponse(request, METHODS);
}

export async function POST(request: Request) {
  const cors = apiCorsHeaders(request, METHODS);
  try {
    const body = await request.json().catch(() => ({})) as {
      code?: string;
      partnerUserId?: string;
      partnerDisplayName?: string;
    };
    const result = await exchangeStraiAwayCode(request, body);
    return Response.json(result, { headers: cors });
  } catch (error) {
    const message = partnerErrorMessage(error, 'StraiAway exchange failed.');
    const status = /secret is invalid/i.test(message) ? 401 : /expired|already used|invalid/i.test(message) ? 400 : 503;
    return Response.json({ error: message }, { status, headers: cors });
  }
}
