import {
  DESTINATION_ICONIC_DRAW_SUFFIXES,
  resolveIconicCoverQueries,
} from '@/features/travel/destination-cover-icons';
import {
  DESTINATION_COVER_MAX,
  hasDestinationLandmarkIntent,
  isAllowedDestinationCoverImageUrl,
  isDirectClientCoverUrl,
  isUsableDestinationPhotoUrl,
} from '@/features/travel/destination-cover-lookup';
import {
  persistTravelMomentPhotos,
  resolveTravelPhotoUris,
} from '@/features/travel/travel-moment-media';
import type { TravelPlan } from '@/features/travel/types';


export function isLocalTravelPhotoUri(uri: string): boolean {
  const lower = uri.trim().toLowerCase();
  return (
    lower.startsWith('file:') ||
    lower.startsWith('content:') ||
    lower.startsWith('ph://') ||
    lower.startsWith('assets-library:')
  );
}

/** Drop tracking query noise that can break native image loaders. */
export function normalizeCoverUri(uri: string): string {
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

export function pushUniqueUri(out: string[], uri: string | undefined): void {
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


/** Max user-uploaded covers on a trip card / edit field. */
export const TRIP_COVER_UPLOAD_MAX = DESTINATION_COVER_MAX;

/**
 * True for Unsplash / Wikimedia / cover-proxy URLs. These are live destination
 * plates — never treat them as user-uploaded carousel pages.
 */
export function isRemoteDestinationCoverUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
  if (trimmed.includes('/api/destination-cover-image')) return true;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return (
    isDirectClientCoverUrl(trimmed) || isAllowedDestinationCoverImageUrl(trimmed)
  );
}

/**
 * User-uploaded covers only (resolved, capped). Never includes destination
 * placeholders, remote live plates, or moment itinerary photos — those must
 * not enter the upload carousel.
 */
export function uploadedTripCoverUris(plan: TravelPlan): string[] {
  const raw =
    Array.isArray(plan.coverUris) && plan.coverUris.length > 0
      ? plan.coverUris
      : plan.coverUri
        ? [plan.coverUri]
        : [];
  return resolveTravelPhotoUris(raw)
    .filter((uri) => !isRemoteDestinationCoverUri(uri))
    .slice(0, TRIP_COVER_UPLOAD_MAX);
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


