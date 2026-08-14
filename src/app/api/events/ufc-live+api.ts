import { compressResponse } from '@/services/http/compression';
import {
  assertEventsAuthenticated,
  eventCorsHeaders,
  eventError,
  eventOptionsResponse,
  liveUfcEvents,
  providerErrorResponse,
} from '@/services/events/server';

export function OPTIONS(request: Request) {
  return eventOptionsResponse(request);
}

export async function GET(request: Request) {
  const unauthorized = await assertEventsAuthenticated(request);
  if (unauthorized) return unauthorized;
  const date = new URL(request.url).searchParams.get('date')?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return eventError('Choose a valid event date.', 400, 'INVALID_DATE');
  }
  try {
    const results = await liveUfcEvents(date);
    return compressResponse(request, Response.json({
      results,
      syncedAt: new Date().toISOString(),
    }, { headers: eventCorsHeaders }));
  } catch (error) {
    return providerErrorResponse(error);
  }
}
