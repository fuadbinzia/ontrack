import { compressResponse } from '@/services/http/compression';
import {
  assertEventsAuthenticated,
  eventCorsHeaders,
  eventError,
  eventOptionsResponse,
  isEventKind,
  isEventSport,
  providerErrorResponse,
  searchProviderTargets,
} from '@/services/events/server';

export function OPTIONS(request: Request) {
  return eventOptionsResponse(request);
}

export async function GET(request: Request) {
  const unauthorized = await assertEventsAuthenticated(request);
  if (unauthorized) return unauthorized;
  const params = new URL(request.url).searchParams;
  const kind = params.get('kind');
  const query = params.get('q')?.trim() ?? '';
  const sport = params.get('sport') ?? 'all';
  if (!isEventKind(kind)) return eventError('Choose Sports or Music.', 400, 'INVALID_KIND');
  if (!isEventSport(sport)) return eventError('Choose a valid sport.', 400, 'INVALID_SPORT');
  if (query.length > 100) return eventError('The follow search is too long.', 400, 'INVALID_SEARCH');
  try {
    const results = await searchProviderTargets(kind, query, sport);
    return compressResponse(request, Response.json({ results }, { headers: eventCorsHeaders }));
  } catch (error) {
    return providerErrorResponse(error);
  }
}
