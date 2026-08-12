import { authenticateApiRequest, isApiRequestBlocked } from '@/services/http/api-auth';
import { apiCorsHeaders, apiOptionsResponse } from '@/services/http/cors';

import { partnerErrorMessage } from './crypto';

type PartnerApiHandler = (request: Request, userId: string) => Promise<unknown | Response>;

export function partnerApiOptions(request: Request, methods: string) {
  return apiOptionsResponse(request, methods);
}

export async function withPartnerUserAuth(
  request: Request,
  config: {
    methods: string;
    unauthorizedMessage: string;
    errorFallback: string;
  },
  handler: PartnerApiHandler,
): Promise<Response> {
  const cors = apiCorsHeaders(request, config.methods);
  const auth = await authenticateApiRequest(request);
  if (isApiRequestBlocked(auth) || auth.status !== 'ok') {
    return Response.json({ error: config.unauthorizedMessage }, { status: 401, headers: cors });
  }
  try {
    const result = await handler(request, auth.userId);
    if (result instanceof Response) return result;
    return Response.json(result, { headers: cors });
  } catch (error) {
    return Response.json(
      { error: partnerErrorMessage(error, config.errorFallback) },
      { status: 503, headers: cors },
    );
  }
}
