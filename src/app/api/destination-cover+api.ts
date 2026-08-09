import { apiCorsHeaders, apiOptionsResponse } from '@/services/http/cors';
import {
  DESTINATION_COVER_POOL_MAX,
  DESTINATION_COVER_UA,
  lookupDestinationCoverUrl,
  lookupDestinationCoverUrls,
} from '@/features/travel/destination-cover-lookup';

export function OPTIONS(request: Request) {
  return apiOptionsResponse(request, 'GET, OPTIONS');
}

/** Destination cover(s) for travel heroes — Unsplash scenic, Wiki lead fallback. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2 || query.length > 120) {
    return Response.json(
      { error: 'Destination must be between 2 and 120 characters.' },
      { status: 400, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
    );
  }

  const rawLimit = Number(url.searchParams.get('limit') ?? '1');
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(DESTINATION_COVER_POOL_MAX, Math.floor(rawLimit)))
    : 1;

  if (limit === 1) {
    const uri = await lookupDestinationCoverUrl(query, {
      userAgent: DESTINATION_COVER_UA,
    });
    if (!uri) {
      return Response.json(
        { error: 'No destination photo found.' },
        { status: 404, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
      );
    }
    return Response.json(
      { uri, uris: [uri] },
      {
        headers: {
          ...apiCorsHeaders(request, 'GET, OPTIONS'),
          'Cache-Control': 'public, max-age=86400',
        },
      },
    );
  }

  const uris = await lookupDestinationCoverUrls(query, {
    userAgent: DESTINATION_COVER_UA,
    limit,
  });
  if (uris.length === 0) {
    return Response.json(
      { error: 'No destination photo found.' },
      { status: 404, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
    );
  }

  return Response.json(
    { uri: uris[0], uris },
    {
      headers: {
        ...apiCorsHeaders(request, 'GET, OPTIONS'),
        'Cache-Control': 'public, max-age=86400',
      },
    },
  );
}
