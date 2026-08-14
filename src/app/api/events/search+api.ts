import { compressResponse } from '@/services/http/compression';
import {
  assertEventsAuthenticated,
  eventCorsHeaders,
  eventError,
  eventOptionsResponse,
  isEventKind,
  isEventSport,
  providerErrorResponse,
  searchProviderEvents,
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
  const page = Number(params.get('page') ?? '0');
  const sport = params.get('sport') ?? 'all';
  if (!isEventKind(kind)) return eventError('Choose Sports or Music.', 400, 'INVALID_KIND');
  if (!isEventSport(sport)) return eventError('Choose a valid sport.', 400, 'INVALID_SPORT');
  if (query.length > 100 || !Number.isInteger(page) || page < 0 || page > 20) {
    return eventError('The event search is invalid.', 400, 'INVALID_SEARCH');
  }
  try {
    const results = await searchProviderEvents(kind, query, page, sport);
    return compressResponse(request, Response.json({
      results,
      page,
      hasMore: kind === 'concert' && results.length === 20,
    }, { headers: eventCorsHeaders }));
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[events] search route failed', {
        kind,
        sport,
        hasQuery: Boolean(query),
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorCode: error instanceof Error ? error.message : 'UNKNOWN',
      });
    }
    return providerErrorResponse(error);
  }
}
