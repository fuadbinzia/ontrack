import { ingestFlowAnalytics } from '@/services/analytics/flow-server';
import { apiOptionsResponse } from '@/services/http/cors';

export function OPTIONS(request: Request) {
  return apiOptionsResponse(request, 'POST, OPTIONS');
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  return ingestFlowAnalytics(request, payload);
}
