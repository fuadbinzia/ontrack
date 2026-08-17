import {
  abbreviateCountry,
  abbreviateRegion,
  isUsStateName,
} from '@/utils/place-abbreviations';

export type WeatherPlaceLabelDetail = 'full' | 'region' | 'city';

type WeatherPlaceParts = {
  city: string;
  state?: string;
  country?: string;
};

/**
 * “Georgia” is a US state and a country — a bare `City, Georgia` cannot be
 * abbreviated to `GA` without risking `Tbilisi, GA`.
 */
const AMBIGUOUS_STATE_COUNTRY_NAMES = new Set(['georgia']);

function parseWeatherPlaceParts(locationLabel: string): WeatherPlaceParts {
  const parts = locationLabel
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const city = parts[0] ?? locationLabel.trim();
  if (parts.length >= 3) {
    return {
      city,
      state: abbreviateRegion(parts[1]!),
      country: abbreviateCountry(parts[2]!),
    };
  }
  if (parts.length === 2) {
    const second = parts[1]!;
    // A two-part label is ambiguous (`Toronto, Ontario` / `Tbilisi, Georgia`),
    // so never fabricate a US country for it.
    if (
      isUsStateName(second) &&
      !AMBIGUOUS_STATE_COUNTRY_NAMES.has(second.toLocaleLowerCase())
    ) {
      return { city, state: abbreviateRegion(second) };
    }
    return { city, country: abbreviateCountry(second) };
  }
  return { city };
}

/**
 * Place line for weather chrome.
 * `full` → `Brooklyn, NY, US` · `region` → `Brooklyn, NY` · `city` → `Brooklyn`
 */
export function formatWeatherPlaceLabel(
  locationLabel: string,
  options?: { detail?: WeatherPlaceLabelDetail },
): string {
  const detail = options?.detail ?? 'full';
  const { city, state, country } = parseWeatherPlaceParts(locationLabel);
  if (!city) return '';

  if (detail === 'city') return city;

  if (detail === 'region') {
    if (state) return `${city}, ${state}`;
    if (country) return `${city}, ${country}`;
    return city;
  }

  if (state && country) return `${city}, ${state}, ${country}`;
  if (state) return `${city}, ${state}`;
  if (country) return `${city}, ${country}`;
  return city;
}

/** Longest → shortest labels for width-fitting weather chrome. */
export function weatherPlaceLabelLadder(locationLabel: string): string[] {
  const full = formatWeatherPlaceLabel(locationLabel, { detail: 'full' });
  const region = formatWeatherPlaceLabel(locationLabel, { detail: 'region' });
  const city = formatWeatherPlaceLabel(locationLabel, { detail: 'city' });
  return [...new Set([full, region, city].filter(Boolean))];
}

/** Every alias a qualifier part can appear as (raw, region code, country code). */
function qualifierTokens(part: string): string[] {
  return [
    ...new Set([
      part.toLocaleLowerCase(),
      abbreviateRegion(part).toLocaleLowerCase(),
      abbreviateCountry(part).toLocaleLowerCase(),
    ]),
  ];
}

/**
 * True when two place strings name the same city with compatible qualifiers.
 * Label shapes differ per source (`Toronto, Ontario, Canada` from the picker,
 * `Toronto, Ontario` from GPS), so every qualifier of the shorter label must
 * appear — under any alias — among the other label's qualifiers.
 */
export function weatherPlacesMatch(a: string, b: string): boolean {
  const parse = (label: string) => {
    const parts = label
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return {
      city: (parts[0] ?? '').toLocaleLowerCase(),
      qualifiers: parts.slice(1).map(qualifierTokens),
    };
  };
  const left = parse(a);
  const right = parse(b);
  if (!left.city || left.city !== right.city) return false;
  const [fewer, more] =
    left.qualifiers.length <= right.qualifiers.length
      ? [left.qualifiers, right.qualifiers]
      : [right.qualifiers, left.qualifiers];
  // A bare city stays distinct from a qualified one (`Paris` vs `Paris, Texas`).
  if (fewer.length === 0) return more.length === 0;
  const moreTokens = new Set(more.flat());
  return fewer.every((tokens) => tokens.some((token) => moreTokens.has(token)));
}
