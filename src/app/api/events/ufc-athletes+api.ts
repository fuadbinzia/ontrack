import { compressResponse } from '@/services/http/compression';
import {
  assertEventsAuthenticated,
  eventCorsHeaders,
  eventError,
  eventOptionsResponse,
  providerErrorResponse,
  ufcAthleteProfiles,
} from '@/services/events/server';

export function OPTIONS(request: Request) {
  return eventOptionsResponse(request);
}

export async function GET(request: Request) {
  const unauthorized = await assertEventsAuthenticated(request);
  if (unauthorized) return unauthorized;
  const ids = [...new Set(
    (new URL(request.url).searchParams.get('ids') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )];
  if (ids.length === 0 || ids.length > 2 || ids.some((id) => !/^\d{1,12}$/.test(id))) {
    return eventError('Choose one or two valid fighters.', 400, 'INVALID_FIGHTERS');
  }
  try {
    return compressResponse(request, Response.json({
      profiles: await ufcAthleteProfiles(ids),
    }, { headers: eventCorsHeaders }));
  } catch (error) {
    return providerErrorResponse(error);
  }
}
