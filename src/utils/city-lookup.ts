import { fetchWithTimeout } from '@/services/http/fetch-with-timeout';
import { formatOpenMeteoPlaceLabel } from '@/utils/open-meteo-place-label';

const LOOKUP_TIMEOUT_MS = 8_000;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 6;

export type CitySuggestion = {
  id: string;
  /** "City, State, Country" — no street / postal. */
  label: string;
};

type OpenMeteoGeocodeResult = {
  id?: unknown;
  name?: unknown;
  admin1?: unknown;
  country?: unknown;
  country_code?: unknown;
  feature_code?: unknown;
  population?: unknown;
};

type OpenMeteoGeocodeResponse = {
  results?: unknown;
};

function asTrimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/** City / region / country only — never street or postal. */
export function formatCitySuggestion(
  result: OpenMeteoGeocodeResult,
): CitySuggestion | undefined {
  const name = asTrimmed(result.name);
  if (!name) return undefined;

  const state = asTrimmed(result.admin1);
  const country = asTrimmed(result.country);
  const label = formatOpenMeteoPlaceLabel([name, state, country]);
  if (!label) return undefined;

  const id =
    typeof result.id === 'number' || typeof result.id === 'string'
      ? String(result.id)
      : label;

  return { id, label };
}

/**
 * Keep cities (PPL*), countries / territories (PCL*), and admin localities (ADM1–4).
 * Drop POIs / airports / parks when feature_code is present.
 * Unknown codes still pass — Open-Meteo search is place-oriented.
 */
export function isCityLikeFeatureCode(code: unknown): boolean {
  if (typeof code !== 'string' || !code.trim()) return true;
  const upper = code.trim().toUpperCase();
  // Populated places (cities, towns, capitals, …)
  if (upper.startsWith('PPL')) return true;
  // Countries & dependent political entities (Iceland, France, …) — GeoNames PCL*
  if (upper.startsWith('PCL') || upper === 'TERR') return true;
  // Regions / admin seats with a place name (states, counties, …)
  if (upper === 'ADM1' || upper === 'ADM2' || upper === 'ADM3' || upper === 'ADM4') {
    return true;
  }
  return false;
}

export function normalizeCitySuggestions(body: unknown): CitySuggestion[] {
  if (!body || typeof body !== 'object') return [];
  const results = (body as OpenMeteoGeocodeResponse).results;
  if (!Array.isArray(results)) return [];

  const ranked = results
    .filter((row): row is OpenMeteoGeocodeResult => !!row && typeof row === 'object')
    .filter((row) => isCityLikeFeatureCode(row.feature_code))
    .map((row, index) => ({
      row,
      index,
      population: typeof row.population === 'number' ? row.population : 0,
    }))
    .sort((a, b) => b.population - a.population || a.index - b.index);

  const seen = new Set<string>();
  const out: CitySuggestion[] = [];
  for (const { row } of ranked) {
    const suggestion = formatCitySuggestion(row);
    if (!suggestion) continue;
    const key = suggestion.label.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(suggestion);
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

/** Open-Meteo Geocoding — free, no API key, city / region / country. */
export async function searchCities(query: string): Promise<CitySuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', trimmed);
  url.searchParams.set('count', String(MAX_RESULTS * 2));
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  try {
    const response = await fetchWithTimeout(
      url.toString(),
      { headers: { Accept: 'application/json' } },
      LOOKUP_TIMEOUT_MS,
    );
    if (!response.ok) return [];
    return normalizeCitySuggestions(await response.json());
  } catch {
    return [];
  }
}

export const CITY_LOOKUP_MIN_QUERY = MIN_QUERY_LENGTH;
