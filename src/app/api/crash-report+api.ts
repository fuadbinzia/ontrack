import { deliverCrashReport } from '@/services/crash-report/server';
import { apiOptionsResponse } from '@/services/http/cors';

export function OPTIONS(request: Request) {
  return apiOptionsResponse(request, 'POST, OPTIONS');
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return Response.json({ error: 'Invalid crash report.' }, { status: 400 });
  }
  return deliverCrashReport(
    request,
    payload as { subject?: unknown; report?: unknown },
  );
}
