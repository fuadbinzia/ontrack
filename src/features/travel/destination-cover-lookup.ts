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

/**
 * True when the query already seeks an iconic travel draw (landmark, nature
 * wonder, famous site) — skip appending another draw suffix.
 */
export function hasDestinationLandmarkIntent(query: string): boolean {
  return /\b(landmark|monument|attraction|architecture|cathedral|temple|church|castle|palace|tower|bridge|waterfall|volcano|arch|skyline|iconic|famous|ruins?|aurora|northern\s+lights|glacier|geyser|lagoon|canyon|beach|mountain|scenic|geothermal|pyramid|colosseum|fuji|machu\s+picchu|must\s+see)\b/i.test(
    query.trim(),
  );
}

/** Hosts the cover-image proxy is allowed to fetch (Wikimedia / Openverse). */
const DESTINATION_COVER_IMAGE_HOST_SUFFIXES = [
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'wikipedia.org',
  'wikimedia.org',
  'openverse.org',
  'wordpress.com',
] as const;

/**
 * Hosts RN Image can usually load without the Wikimedia User-Agent proxy.
 * Prefer at least one of these in hero carousels so cards still show photos
 * when `/api/destination-cover-image` is unavailable.
 */
const DIRECT_CLIENT_COVER_HOST_SUFFIXES = [
  'images.unsplash.com',
  'unsplash.com',
  'wordpress.com',
  'wp.com',
  'staticflickr.com',
] as const;

/** Dominant plate colors from Unsplash search hits (uri / photo-id → #hex). */
const unsplashCoverColorByUri = new Map<string, string>();

function unsplashPhotoId(uri: string): string | undefined {
  const match = uri.match(/photo-([a-zA-Z0-9_-]+)/);
  return match?.[1];
}

/** Average / dominant Unsplash color when the URI was resolved via search. */
export function peekUnsplashCoverColor(uri: string): string | undefined {
  const key = uri.trim();
  if (!key) return undefined;
  const direct = unsplashCoverColorByUri.get(key);
  if (direct) return direct;
  const photoId = unsplashPhotoId(key);
  return photoId ? unsplashCoverColorByUri.get(`id:${photoId}`) : undefined;
}

function rememberUnsplashCoverColor(uri: string | undefined, color: unknown) {
  const nextUri = uri?.trim();
  const nextColor = typeof color === 'string' ? color.trim() : '';
  if (!nextUri || !/^#[0-9a-fA-F]{3,8}$/.test(nextColor)) return;
  unsplashCoverColorByUri.set(nextUri, nextColor);
  const photoId = unsplashPhotoId(nextUri);
  if (photoId) unsplashCoverColorByUri.set(`id:${photoId}`, nextColor);
}

/**
 * Metadata / filename signals that the photo is stock of people (tourists,
 * portraits, crowds) rather than the destination itself.
 */
const DESTINATION_PEOPLE_PHOTO_TERMS = [
  'people',
  'persons?',
  'tourists?',
  'travellers?',
  'travelers?',
  'selfie',
  'selfies',
  'portrait',
  'portraits',
  'crowd',
  'crowds',
  'couple',
  'couples',
  'family',
  'families',
  'wedding',
  'bride',
  'groom',
  'model',
  'models',
  'hiker',
  'hikers',
  'backpacker',
  'backpackers',
  'swimmer',
  'swimmers',
  'bather',
  'bathers',
  'surfer',
  'surfers',
  'skier',
  'skiers',
  'man',
  'men',
  'woman',
  'women',
  'boy',
  'girl',
  'child',
  'children',
  'kid',
  'kids',
  'human',
  'humans',
  'face',
  'faces',
  'smiling',
  'smiles',
  'laughing',
  'pose',
  'posing',
  'adults?',
  'someone',
  'somebody',
  'figure',
  'figures',
  'standing',
  'watching',
  'wearing',
  'beanie',
  'jacket',
  'coat',
  'hoodie',
  'flashlight',
  'photographer',
  'photographing',
  'from behind',
  'rear view',
  'back view',
  // Lifestyle / friend-portrait stock often omits “people” in the title.
  'friend',
  'friends',
  'guy',
  'guys',
  'duo',
  'mates?',
  'buddy',
  'buddies',
  'lifestyle',
  'fashion',
  'street style',
  'looking at',
  'together',
  // Indoor exhibit / object plates (Commons city-month categories).
  'exhibition',
  'exhibit',
  'memorabilia',
  'museum',
  'guitar',
  'guitars',
  'synthesizer',
  'costume',
  'costumes',
  'clothing',
] as const;

const DESTINATION_PEOPLE_PHOTO_RE = new RegExp(
  `\\b(${DESTINATION_PEOPLE_PHOTO_TERMS.join('|')})\\b`,
  'i',
);

/**
 * Metadata / filename signals that the photo is typography-forward (signs,
 * posters, overlays, AI lettering) rather than a clean scenic plate.
 * Word-bounded so “Texas” never matches “text”.
 */
const DESTINATION_TEXT_PHOTO_TERMS = [
  'text',
  'texts',
  'typography',
  'typeface',
  'lettering',
  'letters?',
  'font',
  'fonts',
  'sign',
  'signs',
  'signage',
  'neon',
  'billboard',
  'billboards',
  'poster',
  'posters',
  'banner',
  'banners',
  'plaque',
  'plaques',
  'graffiti',
  'inscription',
  'inscriptions',
  'watermark',
  'watermarks',
  'caption',
  'captions',
  'subtitle',
  'subtitles',
  'overlay',
  'overlays',
  'infographic',
  'infographics',
  'screenshot',
  'screenshots',
  'meme',
  'memes',
  'quote',
  'quotes',
  'saying',
  'sayings',
  'slogan',
  'slogans',
  'handwriting',
  'handwritten',
  'chalkboard',
  'blackboard',
  'newspaper',
  'magazine',
  'headline',
  'headlines',
  'logo',
  'logos',
  'sticker',
  'stickers',
  'label',
  'labels',
  // Diagram / labeled cartography fights header copy the same way signs do.
  'map',
  'maps',
] as const;

const DESTINATION_TEXT_PHOTO_RE = new RegExp(
  `\\b(${DESTINATION_TEXT_PHOTO_TERMS.join('|')})\\b`,
  'i',
);

/** Phrases that mark AI/error lettering plates even without a lone “text” token. */
const DESTINATION_TEXT_PHOTO_PHRASES = [
  'precise name for your image',
  'choose a more precise',
  'with text',
  'text overlay',
  'overlay text',
  'text on',
] as const;

/** Query operators that bias Unsplash / Openverse / Commons away from people stock. */
const PHOTO_SEARCH_PEOPLE_EXCLUDES = [
  'people',
  'person',
  'man',
  'woman',
  'human',
  'tourist',
  'portrait',
  'selfie',
  'hiker',
  'standing',
  'wearing',
  'friend',
  'friends',
  'couple',
  'lifestyle',
  'fashion',
] as const;

/** Bias search away from typography / signage stock that fights header copy. */
const PHOTO_SEARCH_TEXT_EXCLUDES = [
  'text',
  'typography',
  'sign',
  'signage',
  'poster',
  'billboard',
  'watermark',
  'graffiti',
  'caption',
  'neon',
  'plaque',
  'overlay',
  'screenshot',
  'meme',
  'quote',
  'lettering',
  'map',
] as const;

function destinationPhotoMetaHaystack(
  ...parts: Array<string | undefined | null>
): string {
  return parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    // Filenames use _/-; treat them as word breaks for \b matching.
    .map((part) => part.replace(/[_/-]+/g, ' '))
    .join(' ');
}

/** True when title/alt/URL text suggests a people-forward stock photo. */
export function destinationPhotoSuggestsPeople(
  ...parts: Array<string | undefined | null>
): boolean {
  const haystack = destinationPhotoMetaHaystack(...parts);
  if (!haystack) return false;
  // LBJ Library Flickr dumps use DIG##### filenames — almost never scenery.
  if (/\bdig\d{4,}\b/i.test(haystack)) return true;
  return DESTINATION_PEOPLE_PHOTO_RE.test(haystack);
}

/** True when title/alt/URL suggests typography, signage, or lettering stock. */
export function destinationPhotoSuggestsText(
  ...parts: Array<string | undefined | null>
): boolean {
  const haystack = destinationPhotoMetaHaystack(...parts);
  if (!haystack) return false;
  const lower = haystack.toLowerCase();
  if (DESTINATION_TEXT_PHOTO_PHRASES.some((phrase) => lower.includes(phrase))) {
    return true;
  }
  return DESTINATION_TEXT_PHOTO_RE.test(haystack);
}

/** Skip flags/maps, people/text stock, non-HTTPS assets, and Unsplash+ watermarks. */
export function isUsableDestinationPhotoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed.toLowerCase().startsWith('https://')) return false;
  const lower = trimmed.toLowerCase();
  if (lower.includes('.svg')) return false;
  if (/(^|\/)flag[_-]|coat_of_arms|locator_map|location_map/i.test(lower)) {
    return false;
  }
  // Unsplash+ / premium previews ship with visible watermarks — never use them.
  if (
    lower.includes('plus.unsplash.com') ||
    lower.includes('premium_photo-') ||
    lower.includes('unsplash-premium-photos')
  ) {
    return false;
  }
  if (destinationPhotoSuggestsPeople(trimmed)) return false;
  if (destinationPhotoSuggestsText(trimmed)) return false;
  return true;
}

/** True when the cover-image proxy may fetch this remote URL. */
export function isAllowedDestinationCoverImageUrl(url: string): boolean {
  if (!isUsableDestinationPhotoUrl(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return DESTINATION_COVER_IMAGE_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

/** True when the native image loader can fetch this URL without our proxy. */
export function isDirectClientCoverUrl(url: string): boolean {
  if (!isUsableDestinationPhotoUrl(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return DIRECT_CLIENT_COVER_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

/** Prefer a sharper Wikimedia thumb when the summary returns a tiny one. */
export function enlargeWikimediaThumb(url: string, width = 800): string {
  return url.replace(/\/\d+px-/, `/${width}px-`);
}

export function pickDestinationPhotoUrl(
  ...candidates: Array<string | undefined | null>
): string | undefined {
  for (const candidate of candidates) {
    const next = candidate?.trim();
    if (!next || !isUsableDestinationPhotoUrl(next)) continue;
    return enlargeWikimediaThumb(next);
  }
  return undefined;
}

/**
 * Pick a cover URL only when neither the URL nor metadata suggests people or
 * typography/signage stock.
 */
export function pickPeopleFreeDestinationPhotoUrl(
  meta: Array<string | undefined | null>,
  ...candidates: Array<string | undefined | null>
): string | undefined {
  if (destinationPhotoSuggestsPeople(...meta, ...candidates)) return undefined;
  if (destinationPhotoSuggestsText(...meta, ...candidates)) return undefined;
  return pickDestinationPhotoUrl(...candidates);
}

/** Unsplash / Openverse: push landscape landmarks, exclude people/text stock. */
function photoSearchQuery(place: string): string {
  const trimmed = place.trim();
  // Bias unknown places toward architecture/skyline — lifestyle portraits often
  // rank for bare city + “iconic” alone.
  const base = hasDestinationLandmarkIntent(trimmed)
    ? trimmed
    : `${trimmed} architecture landmark`;
  const excludes = [
    ...PHOTO_SEARCH_PEOPLE_EXCLUDES,
    ...PHOTO_SEARCH_TEXT_EXCLUDES,
  ]
    .map((term) => `-${term}`)
    .join(' ');
  return `${base} landscape ${excludes}`;
}

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
