import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    DESTINATION_ICONIC_DRAW_SUFFIXES,
    resolveIconicCoverQueries,
} from '@/features/travel/destination-cover-icons';
import {
    DESTINATION_COVER_MAX,
    DESTINATION_COVER_POOL_MAX,
    hasDestinationLandmarkIntent,
    isAllowedDestinationCoverImageUrl,
    isDirectClientCoverUrl,
    isUsableDestinationPhotoUrl,
    lookupDestinationCoverUrls,
} from '@/features/travel/destination-cover-lookup';
import {
    persistTravelMomentPhotos,
    resolveTravelPhotoUris,
} from '@/features/travel/travel-moment-media';
import type { TravelPlan } from '@/features/travel/types';
import { resolveExpoApiUrl } from '@/services/http/api-url';
import { fetchWithTimeout } from '@/services/http/fetch-with-timeout';

const COVER_FETCH_TIMEOUT_MS = 8_000;
/** Brief negative cache so timeouts/offline blips can retry without hammering. */
const COVER_MISS_TTL_MS = 60_000;
/** Bump when cover provider/filters change so stale people plates leave rotation. */
const HERO_RECENT_STORAGE_KEY = '@ontrack/travel-destination-hero-recent-v3';
const HERO_RECENT_LIMIT = 36;
type CoverCacheEntry =
  | { kind: 'hit'; uri: string }
  | { kind: 'miss'; expiresAt: number };
type HeroCacheEntry =
  | { kind: 'hit'; uris: string[] }
  | { kind: 'miss'; expiresAt: number };
const coverCache = new Map<string, CoverCacheEntry>();
const heroCache = new Map<string, HeroCacheEntry>();
const inflight = new Map<string, Promise<string | undefined>>();
const heroInflight = new Map<string, Promise<string[]>>();

export {
    DESTINATION_COVER_MAX,
    DESTINATION_COVER_POOL_MAX,
    destinationPhotoSuggestsPeople,
    destinationPhotoSuggestsText,
    enlargeWikimediaThumb,
    hasDestinationLandmarkIntent,
    isAllowedDestinationCoverImageUrl,
    isDirectClientCoverUrl,
    isUsableDestinationPhotoUrl,
    mergeDestinationCoverUrls
} from '@/features/travel/destination-cover-lookup';

export type FetchDestinationHeroOptions = {
  /** Session salt so remounts/focus rotate even when the pool is cached. */
  salt?: number;
  /** Injected recent URI history (tests); defaults to AsyncStorage. */
  recentKeys?: readonly string[];
  /** Persist shown URIs into recent history (default true). */
  persistRecent?: boolean;
};

/**
 * Pick `count` URIs from a landmark pool, preferring ones not shown recently.
 * Unseen URIs always lead; salt only rotates within the unseen band (or within
 * the full pool once everything has been shown).
 */
export function pickRotatingHeroUris(
  pool: readonly string[],
  recentKeys: readonly string[],
  count: number,
  salt = 0,
): string[] {
  const want = Math.max(
    0,
    Math.min(count, pool.length, DESTINATION_COVER_MAX),
  );
  if (want === 0) return [];

  const recent = recentKeys
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean);
  const recentSet = new Set(recent);
  const fresh = pool.filter((uri) => !recentSet.has(uri.toLowerCase()));
  const seen = pool
    .filter((uri) => recentSet.has(uri.toLowerCase()))
    .sort((a, b) => {
      // Older history entries (higher index) first when wrapping.
      return (
        recent.indexOf(b.toLowerCase()) - recent.indexOf(a.toLowerCase())
      );
    });

  const out: string[] = [];
  if (fresh.length > 0) {
    // Rotate only inside the unseen band so salt never skips a fresh plate.
    const start = Math.abs(salt) % fresh.length;
    for (let i = 0; i < fresh.length && out.length < want; i += 1) {
      pushUniqueUri(out, fresh[(start + i) % fresh.length]);
    }
    for (const uri of seen) {
      if (out.length >= want) break;
      pushUniqueUri(out, uri);
    }
    return out;
  }

  if (seen.length === 0) return [];
  const start = Math.abs(salt) % seen.length;
  for (let i = 0; i < seen.length && out.length < want; i += 1) {
    pushUniqueUri(out, seen[(start + i) % seen.length]);
  }
  return out;
}

async function loadHeroRecentKeys(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HERO_RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

async function saveHeroRecentKeys(keys: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      HERO_RECENT_STORAGE_KEY,
      JSON.stringify(keys.slice(0, HERO_RECENT_LIMIT)),
    );
  } catch {
    // Rotation still works in-memory for the session.
  }
}

function rememberHeroRecentKeys(
  previous: readonly string[],
  shown: readonly string[],
): string[] {
  let next = [...previous];
  for (const uri of [...shown].reverse()) {
    const trimmed = uri.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    next = [trimmed, ...next.filter((key) => key.toLowerCase() !== lower)];
  }
  return next.slice(0, HERO_RECENT_LIMIT);
}

/** Max user-uploaded covers on a trip card / edit field. */
export const TRIP_COVER_UPLOAD_MAX = DESTINATION_COVER_MAX;

/**
 * User-uploaded covers only (resolved, capped). Never includes destination
 * placeholders or moment itinerary photos — those must not enter the carousel.
 */
export function uploadedTripCoverUris(plan: TravelPlan): string[] {
  const raw =
    Array.isArray(plan.coverUris) && plan.coverUris.length > 0
      ? plan.coverUris
      : plan.coverUri
        ? [plan.coverUri]
        : [];
  return resolveTravelPhotoUris(raw).slice(0, TRIP_COVER_UPLOAD_MAX);
}

/**
 * First uploaded cover, else first photo on a moment stop.
 * Flight/stay confirmation screenshots must not become the trip hero.
 */
export function localTripCoverUri(plan: TravelPlan): string | undefined {
  const uploaded = uploadedTripCoverUris(plan)[0];
  if (uploaded) return uploaded;
  for (const item of plan.itinerary ?? []) {
    if (item.kind !== 'moment') continue;
    const photos = resolveTravelPhotoUris(item.photoUris);
    if (photos[0]) return photos[0];
  }
  return undefined;
}

/** Persist a picked cover into durable documents storage. */
export async function persistTravelCoverPhoto(
  uri: string,
  planId: string,
): Promise<string> {
  const [next] = await persistTravelCoverPhotos([uri], planId);
  if (!next) throw new Error('Could not save trip cover photo.');
  return next;
}

/** Persist up to {@link TRIP_COVER_UPLOAD_MAX} cover picks. */
export async function persistTravelCoverPhotos(
  uris: readonly string[],
  planId: string,
): Promise<string[]> {
  const capped = uris
    .map((uri) => uri.trim())
    .filter(Boolean)
    .slice(0, TRIP_COVER_UPLOAD_MAX);
  if (capped.length === 0) return [];
  return persistTravelMomentPhotos(capped, `cover-${planId}`);
}

/**
 * Place names / iconic draws to try for a cover, most specific first.
 * Curated “why people go” queries lead (aurora, famous peaks, lagoons…);
 * generic iconic suffixes fill gaps; bare place names stay for Wiki titles.
 */
export function destinationCoverCandidates(plan: TravelPlan): string[] {
  const out: string[] = [];
  const add = (value: string | undefined) => {
    const next = value?.trim();
    if (!next) return;
    if (out.some((existing) => existing.toLowerCase() === next.toLowerCase())) {
      return;
    }
    out.push(next);
  };
  /** Iconic travel-draw queries, then the bare place for Wiki titles. */
  const addPlace = (value: string | undefined) => {
    const next = value?.trim();
    if (!next) return;
    if (!hasDestinationLandmarkIntent(next)) {
      for (const suffix of DESTINATION_ICONIC_DRAW_SUFFIXES) {
        add(`${next} ${suffix}`);
      }
    }
    add(next);
  };

  const destination = plan.destination.trim();
  const title = plan.title.trim();
  for (const iconic of resolveIconicCoverQueries(destination, title)) {
    add(iconic);
  }

  if (destination) {
    const parts = destination
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      addPlace(parts[0]);
      addPlace(destination);
      for (const part of parts.slice(1)) addPlace(part);
    } else {
      addPlace(destination);
    }
  }
  addPlace(title);
  return out;
}

function coverApiUrl(place: string, limit = 1): string | undefined {
  try {
    const params = new URLSearchParams({ q: place });
    if (limit > 1) params.set('limit', String(limit));
    return resolveExpoApiUrl(`/api/destination-cover?${params.toString()}`, {
      configuredBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      createNotConfiguredError: () => new Error('missing'),
    });
  } catch {
    return undefined;
  }
}

function isLocalTravelPhotoUri(uri: string): boolean {
  const lower = uri.trim().toLowerCase();
  return (
    lower.startsWith('file:') ||
    lower.startsWith('content:') ||
    lower.startsWith('ph://') ||
    lower.startsWith('assets-library:')
  );
}

/** Drop tracking query noise that can break native image loaders. */
function normalizeCoverUri(uri: string): string {
  const trimmed = uri.trim();
  if (isLocalTravelPhotoUri(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.hostname.endsWith('wikimedia.org') ||
      parsed.hostname.endsWith('wikipedia.org')
    ) {
      parsed.search = '';
      return parsed.toString();
    }
  } catch {
    // Keep original when URL parsing fails.
  }
  return trimmed;
}

/**
 * RN Image cannot send Wikimedia's required User-Agent, so route remote covers
 * through the Expo API proxy. Cache still stores the raw upstream HTTPS URL.
 */
export function proxyDestinationCoverImageUrl(
  remoteUri: string,
): string | undefined {
  const normalized = normalizeCoverUri(remoteUri);
  if (!isAllowedDestinationCoverImageUrl(normalized)) return undefined;
  try {
    return resolveExpoApiUrl(
      `/api/destination-cover-image?src=${encodeURIComponent(normalized)}`,
      {
        configuredBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
        createNotConfiguredError: () => new Error('missing'),
      },
    );
  } catch {
    return undefined;
  }
}

function toClientDisplayCoverUri(uri: string): string {
  if (isLocalTravelPhotoUri(uri)) return uri;
  // Unsplash / Flickr / WP can load in RN without a User-Agent proxy.
  if (isDirectClientCoverUrl(uri)) return uri;
  return proxyDestinationCoverImageUrl(uri) ?? uri;
}

/** Prefer direct-loadable remotes so cards survive a missing image proxy. */
function orderHeroUrisForClient(uris: string[]): string[] {
  const direct: string[] = [];
  const proxied: string[] = [];
  for (const uri of uris) {
    if (isLocalTravelPhotoUri(uri) || isDirectClientCoverUrl(uri)) {
      direct.push(uri);
    } else {
      proxied.push(uri);
    }
  }
  return [...direct, ...proxied];
}

function pushUniqueUri(out: string[], uri: string | undefined): void {
  const trimmed = uri?.trim();
  if (!trimmed) return;
  // Local custom/moment covers are file URIs; remotes must stay https-only.
  if (!isLocalTravelPhotoUri(trimmed) && !isUsableDestinationPhotoUrl(trimmed)) {
    return;
  }
  const normalized = normalizeCoverUri(trimmed);
  const key = normalized.toLowerCase();
  if (out.some((existing) => existing.toLowerCase() === key)) return;
  out.push(normalized);
}

/** Prefer Expo API (server User-Agent) then direct Openverse fallback. */
async function resolveRemoteCover(place: string): Promise<string | undefined> {
  const urls = await resolveRemoteCovers(place, 1);
  return urls[0];
}

async function resolveRemoteCovers(
  place: string,
  limit: number,
): Promise<string[]> {
  const capped = Math.max(1, Math.min(DESTINATION_COVER_POOL_MAX, limit));
  const apiUrl = coverApiUrl(place, capped);
  if (apiUrl) {
    try {
      const response = await fetchWithTimeout(
        apiUrl,
        { headers: { Accept: 'application/json' } },
        COVER_FETCH_TIMEOUT_MS,
      );
      if (response.ok) {
        const body = (await response.json()) as {
          uri?: string;
          uris?: string[];
        };
        const out: string[] = [];
        for (const candidate of body.uris ?? []) {
          pushUniqueUri(out, candidate?.trim());
          if (out.length >= capped) return out;
        }
        pushUniqueUri(out, body.uri?.trim());
        if (out.length > 0) return out.slice(0, capped);
      }
    } catch {
      // Fall through to direct lookup.
    }
  }

  try {
    return await Promise.race([
      lookupDestinationCoverUrls(place, { limit: capped }),
      new Promise<string[]>((resolve) => {
        setTimeout(() => resolve([]), COVER_FETCH_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return [];
  }
}

/**
 * Place-name candidates for a stay thumbnail: hotel title first, then address
 * parts (skip generic titles like "Demo Stay" / "Stay").
 */
export function stayCoverCandidates(
  title?: string,
  address?: string,
): string[] {
  const out: string[] = [];
  const add = (value: string | undefined) => {
    const next = value?.trim();
    if (!next || next.length < 2) return;
    if (out.some((existing) => existing.toLowerCase() === next.toLowerCase())) {
      return;
    }
    out.push(next);
  };

  const name = title?.trim();
  if (name && !/^(demo\s+)?stay$/i.test(name)) {
    add(name);
  }

  const location = address?.trim();
  if (location) {
    const parts = location
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    // Prefer city/region chunks — skip street lines that include house numbers.
    for (const part of parts) {
      if (!/\d/.test(part)) add(part);
    }
    add(location);
  }

  return out;
}

/** Resolve a remote place photo URL from ordered query candidates (cached). */
export async function fetchPlaceCoverUri(
  candidates: string[],
): Promise<string | undefined> {
  const uris = await fetchPlaceCoverUris(candidates, 1);
  return uris[0];
}

/**
 * Resolve up to `limit` remote place photos across ordered query candidates.
 * Used by Travel home atmosphere so each open can pick a different scene.
 */
export async function fetchPlaceCoverUris(
  candidates: string[],
  limit: number = DESTINATION_COVER_POOL_MAX,
): Promise<string[]> {
  const places = candidates.map((c) => c.trim()).filter((c) => c.length >= 2);
  const capped = Math.max(
    1,
    Math.min(DESTINATION_COVER_POOL_MAX, Math.floor(limit)),
  );
  if (!places.length) return [];

  const key = `place-pool-v6|${capped}|${places.join('|').toLowerCase()}`;
  const cached = heroCache.get(key);
  if (cached?.kind === 'hit') {
    return orderHeroUrisForClient(cached.uris).map(toClientDisplayCoverUri);
  }
  if (cached?.kind === 'miss') {
    if (cached.expiresAt > Date.now()) return [];
    heroCache.delete(key);
  }

  const pending = heroInflight.get(key);
  if (pending) {
    const uris = await pending;
    return orderHeroUrisForClient(uris).map(toClientDisplayCoverUri);
  }

  const request = (async () => {
    const collected: string[] = [];
    try {
      for (const place of places) {
        if (collected.length >= capped) break;
        const next = await resolveRemoteCovers(place, capped - collected.length);
        for (const uri of next) pushUniqueUri(collected, uri);
      }
      if (collected.length > 0) {
        heroCache.set(key, { kind: 'hit', uris: collected });
      } else {
        heroCache.set(key, {
          kind: 'miss',
          expiresAt: Date.now() + COVER_MISS_TTL_MS,
        });
      }
      return collected;
    } catch {
      return collected;
    } finally {
      heroInflight.delete(key);
    }
  })();

  heroInflight.set(key, request);
  const uris = await request;
  return orderHeroUrisForClient(uris).map(toClientDisplayCoverUri);
}

/** Resolve a remote destination cover URL (cached per destination query). */
export async function fetchDestinationCoverUri(
  plan: TravelPlan,
): Promise<string | undefined> {
  const local = localTripCoverUri(plan);
  if (local) return local;

  return fetchPlaceCoverUri(destinationCoverCandidates(plan));
}

/**
 * Build / cache a large landmark photo pool for a destination (not the
 * carousel trio — callers rotate a subset via `pickRotatingHeroUris`).
 */
async function resolveDestinationHeroPool(
  places: string[],
): Promise<string[]> {
  const key = `hero-pool-v13|${places.join('|').toLowerCase()}`;
  const cached = heroCache.get(key);
  if (cached?.kind === 'hit') return cached.uris;
  if (cached?.kind === 'miss') {
    if (cached.expiresAt > Date.now()) return [];
    heroCache.delete(key);
  }

  const pending = heroInflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const collected: string[] = [];
      // Pass 1 — one photo per query for landmark variety.
      for (const place of places) {
        if (collected.length >= DESTINATION_COVER_POOL_MAX) break;
        const next = await resolveRemoteCovers(place, 1);
        for (const uri of next) pushUniqueUri(collected, uri);
      }
      // Pass 2 — deepen the pool so later opens can rotate.
      if (collected.length < DESTINATION_COVER_POOL_MAX) {
        for (const place of places) {
          if (collected.length >= DESTINATION_COVER_POOL_MAX) break;
          const next = await resolveRemoteCovers(
            place,
            DESTINATION_COVER_POOL_MAX - collected.length,
          );
          for (const uri of next) {
            pushUniqueUri(collected, uri);
            if (collected.length >= DESTINATION_COVER_POOL_MAX) break;
          }
        }
      }
      if (collected.length > 0) {
        heroCache.set(key, { kind: 'hit', uris: collected });
      } else {
        heroCache.set(key, {
          kind: 'miss',
          expiresAt: Date.now() + COVER_MISS_TTL_MS,
        });
      }
      return collected;
    } catch {
      return [];
    } finally {
      heroInflight.delete(key);
    }
  })();

  heroInflight.set(key, request);
  return request;
}

/**
 * Up to 3 destination landmark URIs for callers that still want a remote pool.
 * Travel Home carousel pages use {@link uploadedTripCoverUris} only — do not
 * mix these remotes into the live slide set.
 */
export async function fetchDestinationHeroUris(
  plan: TravelPlan,
  limit: number = DESTINATION_COVER_MAX,
  options?: FetchDestinationHeroOptions,
): Promise<string[]> {
  const capped = Math.max(1, Math.min(DESTINATION_COVER_MAX, limit));
  const out: string[] = [];

  const places = destinationCoverCandidates(plan)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2);
  if (!places.length) return out.map(toClientDisplayCoverUri);

  const pool = await resolveDestinationHeroPool(places);
  if (pool.length === 0) {
    return out.map(toClientDisplayCoverUri);
  }

  const recentKeys =
    options?.recentKeys ?? (await loadHeroRecentKeys());
  const salt = options?.salt ?? Date.now();
  const remoteSlots = capped - out.length;
  const picked = pickRotatingHeroUris(pool, recentKeys, remoteSlots, salt);
  for (const uri of picked) {
    pushUniqueUri(out, uri);
    if (out.length >= capped) break;
  }

  if (options?.persistRecent !== false && picked.length > 0) {
    const nextRecent = rememberHeroRecentKeys(recentKeys, picked);
    void saveHeroRecentKeys(nextRecent);
  }

  // Keep rotation order. Promoting Unsplash ahead of Wikimedia undoes salt /
  // recent picks (Guatemala kept opening on the same direct-load plate).
  // Failed proxied loads drop via the carousel onError path.
  return out.map(toClientDisplayCoverUri);
}
