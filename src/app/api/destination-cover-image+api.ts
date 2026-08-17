import {
    DESTINATION_COVER_UA,
    isAllowedDestinationCoverImageUrl,
} from '@/features/travel/destination-cover-lookup';
import { gatePublicApiRequest } from '@/services/http/api-gate';
import { apiCorsHeaders, apiOptionsResponse } from '@/services/http/cors';
import { fetchWithTimeout } from '@/services/http/fetch-with-timeout';

const MAX_BYTES = 4_500_000;
const FETCH_TIMEOUT_MS = 12_000;
const PROXY_WIDTH = 1200;

export function OPTIONS(request: Request) {
  return apiOptionsResponse(request, 'GET, OPTIONS');
}

/**
 * Convert upload.wikimedia.org original/thumb URLs into a bounded FilePath
 * resize. Direct /thumb/ URLs often 400; full originals can be 30MB+.
 */
export function rewriteDestinationCoverFetchUrl(
  src: string,
  width = PROXY_WIDTH,
): string {
  try {
    const parsed = new URL(src);
    const host = parsed.hostname.toLowerCase();
    if (
      !host.endsWith('upload.wikimedia.org') &&
      !host.endsWith('commons.wikimedia.org') &&
      !host.endsWith('wikipedia.org')
    ) {
      return src;
    }
    if (parsed.pathname.includes('/Special:FilePath/')) {
      parsed.searchParams.set('width', String(width));
      return parsed.toString();
    }
    const segments = parsed.pathname.split('/').filter(Boolean);
    let filename = segments[segments.length - 1] ?? '';
    const thumbName = filename.match(/^\d+px-(.+)$/);
    if (thumbName) filename = thumbName[1] ?? filename;
    if (!filename) return src;
    const decoded = decodeURIComponent(filename);
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decoded)}?width=${width}`;
  } catch {
    return src;
  }
}

/**
 * Proxy destination cover bytes with a proper Wikimedia User-Agent.
 * RN Image cannot set UA, so upload.wikimedia.org often fails without this.
 */
export async function GET(request: Request) {
  const gate = await gatePublicApiRequest(request);
  if (gate === 'rate_limited') {
    return Response.json(
      { error: 'Too many image lookups. Try again later.' },
      { status: 429, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
    );
  }
  const src = new URL(request.url).searchParams.get('src')?.trim() ?? '';
  if (!src || !isAllowedDestinationCoverImageUrl(src)) {
    return Response.json(
      { error: 'Unsupported destination image URL.' },
      { status: 400, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
    );
  }

  const upstreamUrl = rewriteDestinationCoverFetchUrl(src);

  try {
    const upstream = await fetchWithTimeout(
      upstreamUrl,
      {
        headers: {
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'User-Agent': DESTINATION_COVER_UA,
          'Api-User-Agent': DESTINATION_COVER_UA,
        },
      },
      FETCH_TIMEOUT_MS,
    );
    if (!upstream.ok) {
      return Response.json(
        { error: 'Upstream destination image unavailable.' },
        { status: 502, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
      );
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return Response.json(
        { error: 'Upstream response was not an image.' },
        { status: 502, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
      );
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) {
      return Response.json(
        { error: 'Upstream destination image size rejected.' },
        { status: 502, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
      );
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        ...apiCorsHeaders(request, 'GET, OPTIONS'),
        'Content-Type': contentType.split(';')[0] || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return Response.json(
      { error: 'Failed to fetch destination image.' },
      { status: 502, headers: apiCorsHeaders(request, 'GET, OPTIONS') },
    );
  }
}
