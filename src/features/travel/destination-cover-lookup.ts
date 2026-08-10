/**
 * Destination cover lookup — Unsplash landscape first (scenic, people-light),
 * then Wikipedia/Wikivoyage page lead images. Commons/Openverse search was
 * dropped: city queries pulled museum/exhibit portraits (Austin → LBJ Music
 * America guitar plates, etc.).
 * Shared by the Expo API route (proper User-Agent) and the travel client.
 */

import { fetchWithTimeout } from '@/services/http/fetch-with-timeout';

export const DESTINATION_COVER_UA =
  'onTrack/1.0 (travel destination covers; https://ontrack.app)';

/** How many heroes the trip-card carousel shows at once. */
export const DESTINATION_COVER_MAX = 3;
/** Larger landmark pool so each open can rotate a different trio. */
export const DESTINATION_COVER_POOL_MAX = 12;

export {
  destinationPhotoSuggestsPeople,
  destinationPhotoSuggestsText,
  enlargeWikimediaThumb,
  hasDestinationLandmarkIntent,
  isAllowedDestinationCoverImageUrl,
  isDirectClientCoverUrl,
  isUsableDestinationPhotoUrl,
  peekUnsplashCoverColor,
  pickDestinationPhotoUrl,
  pickPeopleFreeDestinationPhotoUrl,
} from './destination-cover-photo-filters';

import {
  isDirectClientCoverUrl,
  isUsableDestinationPhotoUrl,
  photoSearchQuery,
  pickPeopleFreeDestinationPhotoUrl,
  rememberUnsplashCoverColor,
} from './destination-cover-photo-filters';

function normalizeLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit)) return 1;
  return Math.max(1, Math.min(DESTINATION_COVER_POOL_MAX, Math.floor(limit)));
}

function pushUniqueUrl(out: string[], url: string | undefined): void {
  if (!url) return;
  const key = url.toLowerCase();
  if (out.some((existing) => existing.toLowerCase() === key)) return;
  out.push(url);
}

type WikiSummary = {
  type?: string;
  title?: string;
  description?: string;
  extract?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
};

async function fetchJson(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 8_000,
): Promise<unknown | undefined> {
  try {
    const response = await fetchWithTimeout(url, { headers }, timeoutMs);
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  }
}

async function fetchWikiSummaryCover(
  host: 'en.wikipedia.org' | 'en.wikivoyage.org',
  place: string,
  headers: Record<string, string>,
): Promise<string | undefined> {
  const title = encodeURIComponent(place.replace(/ /g, '_'));
  const body = (await fetchJson(
    `https://${host}/api/rest_v1/page/summary/${title}`,
    headers,
  )) as WikiSummary | undefined;
  if (!body || (body.type && body.type !== 'standard')) return undefined;
  return pickPeopleFreeDestinationPhotoUrl(
    [body.title, body.description, body.extract],
    body.originalimage?.source,
    body.thumbnail?.source,
  );
}

async function fetchUnsplashCovers(
  place: string,
  headers: Record<string, string>,
  limit: number,
): Promise<string[]> {
  const url = `https://unsplash.com/napi/search/photos?${new URLSearchParams({
    query: photoSearchQuery(place),
    per_page: String(Math.max(10, limit * 4)),
    orientation: 'landscape',
    // Prefer safer scenic results over lifestyle/portrait stock.
    content_filter: 'high',
  }).toString()}`;
  const body = (await fetchJson(url, headers)) as
    | {
        results?: Array<{
          plus?: boolean;
          premium?: boolean;
          width?: number;
          height?: number;
          color?: string;
          description?: string | null;
          alt_description?: string | null;
          tags?: Array<{ title?: string }>;
          urls?: { regular?: string; small?: string };
        }>;
      }
    | undefined;
  if (!body) return [];
  const out: string[] = [];
  for (const hit of body.results ?? []) {
    if (out.length >= limit) break;
    if (hit.plus || hit.premium) continue;
    // Portrait lifestyle shots slip past keyword filters — require landscape.
    if (
      typeof hit.width === 'number' &&
      typeof hit.height === 'number' &&
      hit.height > hit.width
    ) {
      continue;
    }
    const tagText = (hit.tags ?? [])
      .map((tag) => tag.title)
      .filter(Boolean)
      .join(' ');
    const photoUrl = pickPeopleFreeDestinationPhotoUrl(
      [hit.description, hit.alt_description, tagText],
      hit.urls?.regular,
      hit.urls?.small,
    );
    if (!photoUrl) continue;
    rememberUnsplashCoverColor(photoUrl, hit.color);
    pushUniqueUrl(out, photoUrl);
  }
  return out;
}

function coverHeaders(userAgent?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Api-User-Agent': userAgent ?? DESTINATION_COVER_UA,
  };
  if (userAgent) headers['User-Agent'] = userAgent;
  return headers;
}

/**
 * Merge Unsplash-first results with Wiki lead-image fallbacks.
 * Prefers direct-loadable CDN URLs so trip cards still paint without the
 * Wikimedia image proxy.
 */
export function mergeDestinationCoverUrls(
  preferred: string[],
  fallback: string[],
  limit: number,
): string[] {
  const capped = normalizeLimit(limit);
  const out: string[] = [];
  const append = (url: string | undefined) => {
    if (!url || out.length >= capped) return;
    pushUniqueUrl(out, url);
  };

  const preferredUsable = preferred.filter(isUsableDestinationPhotoUrl);
  const fallbackUsable = fallback.filter(isUsableDestinationPhotoUrl);
  // Lead with Unsplash (or other direct CDN) when present.
  const directFirst = [
    ...preferredUsable.filter(isDirectClientCoverUrl),
    ...preferredUsable.filter((url) => !isDirectClientCoverUrl(url)),
  ];
  for (const url of directFirst) append(url);
  for (const url of fallbackUsable) append(url);
  return out.slice(0, capped);
}

/**
 * Up to `limit` destination-relevant landscape URLs.
 * Unsplash scenic stock first; Wikipedia/Wikivoyage lead images fill gaps.
 */
export async function lookupDestinationCoverUrls(
  place: string,
  options?: { userAgent?: string; limit?: number },
): Promise<string[]> {
  const trimmed = place.trim();
  if (!trimmed) return [];

  const limit = normalizeLimit(options?.limit);
  const headers = coverHeaders(options?.userAgent);

  // Unsplash landscape is the primary people-light scenic provider.
  const unsplash = await fetchUnsplashCovers(trimmed, headers, limit);
  if (unsplash.length >= limit) return unsplash.slice(0, limit);

  // Wiki page lead images are usually skylines / landmarks — not Commons search.
  const wiki: string[] = [];
  pushUniqueUrl(
    wiki,
    await fetchWikiSummaryCover('en.wikipedia.org', trimmed, headers),
  );
  if (unsplash.length + wiki.length < limit) {
    pushUniqueUrl(
      wiki,
      await fetchWikiSummaryCover('en.wikivoyage.org', trimmed, headers),
    );
  }
  return mergeDestinationCoverUrls(unsplash, wiki, limit);
}

/** Single cover URL for a place name (server should pass a real User-Agent). */
export async function lookupDestinationCoverUrl(
  place: string,
  options?: { userAgent?: string },
): Promise<string | undefined> {
  const urls = await lookupDestinationCoverUrls(place, {
    ...options,
    limit: 1,
  });
  return urls[0];
}
