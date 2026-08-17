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
    if (isUsStateName(second)) {
      return { city, state: abbreviateRegion(second), country: 'US' };
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

/** True when two place strings resolve to the same weather chrome label. */
export function weatherPlacesMatch(a: string, b: string): boolean {
  const left = formatWeatherPlaceLabel(a.trim(), { detail: 'full' }).toLocaleLowerCase();
  const right = formatWeatherPlaceLabel(b.trim(), { detail: 'full' }).toLocaleLowerCase();
  return Boolean(left) && left === right;
}
