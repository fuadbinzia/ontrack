import { authenticateApiRequest, isApiRequestBlocked } from '@/services/http/api-auth';
import { buildApiUsageSnapshot } from '@/services/http/api-usage';
import { apiCorsHeaders, apiOptionsResponse } from '@/services/http/cors';

export function OPTIONS(request: Request) {
  return apiOptionsResponse(request, 'GET, OPTIONS');
}

/** Dev-facing snapshot of third-party services and in-process app rate limits. */
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (isApiRequestBlocked(auth)) {
    return Response.json(
      { error: 'Sign in to view API usage.' },
      { status: 401, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
    );
  }
  const snapshot = await buildApiUsageSnapshot(request);
  return Response.json(snapshot, {
    headers: apiCorsHeaders(request, 'GET, OPTIONS'),
  });
}
