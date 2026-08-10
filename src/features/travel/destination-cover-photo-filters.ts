/**
 * Destination cover photo URL filters — people/text stock rejection,
 * host allowlists, and search query bias.
 */

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

export function rememberUnsplashCoverColor(uri: string | undefined, color: unknown) {
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
export function photoSearchQuery(place: string): string {
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
