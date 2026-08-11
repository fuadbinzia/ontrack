import { fetchWithTimeout } from '@/services/http/fetch-with-timeout';

const LOOKUP_TIMEOUT_MS = 8_000;
const MIN_QUERY_LENGTH = 3;
const MAX_RESULTS = 6;

export interface AddressSuggestion {
  id: string;
  label: string;
  secondary?: string;
  countryName?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
}

interface PhotonProperties {
  osm_id?: unknown;
  osm_type?: unknown;
  name?: unknown;
  housenumber?: unknown;
  street?: unknown;
  postcode?: unknown;
  city?: unknown;
  town?: unknown;
  village?: unknown;
  locality?: unknown;
  district?: unknown;
  county?: unknown;
  state?: unknown;
  country?: unknown;
  countrycode?: unknown;
  type?: unknown;
}

interface PhotonFeature {
  properties?: PhotonProperties;
  geometry?: { coordinates?: unknown };
}

interface PhotonResponse {
  features?: unknown;
}

function asTrimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function uniqueParts(parts: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    const key = part.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(part);
  }
  return result;
}

/** Build a readable street-first label from Photon properties. */
export function formatAddressSuggestion(
  properties: PhotonProperties,
  coordinates?: unknown,
): AddressSuggestion | undefined {
  const name = asTrimmed(properties.name);
  const housenumber = asTrimmed(properties.housenumber);
  const street = asTrimmed(properties.street);
  const postcode = asTrimmed(properties.postcode);
  const city =
    asTrimmed(properties.city) ??
    asTrimmed(properties.town) ??
    asTrimmed(properties.village) ??
    asTrimmed(properties.locality) ??
    asTrimmed(properties.district);
  const state = asTrimmed(properties.state) ?? asTrimmed(properties.county);
  const country = asTrimmed(properties.country);
  const countryCode = asTrimmed(properties.countrycode)?.toUpperCase();
  const point = Array.isArray(coordinates) ? coordinates : [];
  const longitude =
    typeof point[0] === 'number' && Number.isFinite(point[0]) ? point[0] : undefined;
  const latitude =
    typeof point[1] === 'number' && Number.isFinite(point[1]) ? point[1] : undefined;

  const streetLine =
    housenumber && street
      ? `${housenumber} ${street}`
      : street ?? housenumber;

  const localityLine = uniqueParts([postcode, city, state, country]).join(', ');

  // Prefer "Venue, 12 Street" when both exist; otherwise street or place name.
  const primaryParts = uniqueParts([
    name && streetLine && name.toLocaleLowerCase() !== streetLine.toLocaleLowerCase()
      ? name
      : undefined,
    streetLine || name,
  ]);
  const primary = primaryParts.join(', ') || localityLine;
  if (!primary) return undefined;

  const secondary =
    localityLine && localityLine.toLocaleLowerCase() !== primary.toLocaleLowerCase()
      ? localityLine
      : undefined;

  const osmType = asTrimmed(properties.osm_type) ?? 'place';
  const osmId = typeof properties.osm_id === 'number' ? String(properties.osm_id) : primary;

  return {
    id: `${osmType}:${osmId}:${primary}`,
    label: primary,
    ...(secondary ? { secondary } : {}),
    ...(country ? { countryName: country } : {}),
    ...(countryCode && /^[A-Z]{2}$/.test(countryCode) ? { countryCode } : {}),
    ...(latitude !== undefined && latitude >= -90 && latitude <= 90 ? { latitude } : {}),
    ...(longitude !== undefined && longitude >= -180 && longitude <= 180
      ? { longitude }
      : {}),
  };
}

export function normalizeAddressSuggestions(body: unknown): AddressSuggestion[] {
  if (!body || typeof body !== 'object') return [];
  const features = (body as PhotonResponse).features;
  if (!Array.isArray(features)) return [];

  const seen = new Set<string>();
  const results: AddressSuggestion[] = [];
  for (const feature of features) {
    if (!feature || typeof feature !== 'object') continue;
    const photonFeature = feature as PhotonFeature;
    const suggestion = formatAddressSuggestion(
      (photonFeature.properties ?? {}) as PhotonProperties,
      photonFeature.geometry?.coordinates,
    );
    if (!suggestion) continue;
    const key = `${suggestion.label}|${suggestion.secondary ?? ''}`.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(suggestion);
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('limit', String(MAX_RESULTS));
  url.searchParams.set('lang', 'en');

  try {
    const response = await fetchWithTimeout(
      url.toString(),
      { headers: { Accept: 'application/json' } },
      LOOKUP_TIMEOUT_MS,
    );
    if (!response.ok) return [];
    return normalizeAddressSuggestions(await response.json());
  } catch {
    return [];
  }
}

export async function searchAddressesInCountry(
  query: string,
  countryName: string,
  countryCode: string,
): Promise<AddressSuggestion[]> {
  const results = await searchAddresses(`${query.trim()}, ${countryName.trim()}`);
  const expected = countryCode.trim().toUpperCase();
  return results.filter((result) => result.countryCode === expected);
}

export async function reverseGeocodeAddress(
  latitude: number,
  longitude: number,
): Promise<AddressSuggestion | undefined> {
  const url = new URL('https://photon.komoot.io/reverse');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  try {
    const response = await fetchWithTimeout(
      url.toString(),
      { headers: { Accept: 'application/json' } },
      LOOKUP_TIMEOUT_MS,
    );
    if (!response.ok) return undefined;
    return normalizeAddressSuggestions(await response.json())[0];
  } catch {
    return undefined;
  }
}

export const ADDRESS_LOOKUP_MIN_QUERY = MIN_QUERY_LENGTH;
