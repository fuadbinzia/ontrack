/** US state / DC names → postal codes for compact weather chrome. */
const US_STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  'district of columbia': 'DC',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
};

/** Common country names → ISO-ish 2-letter codes for weather chrome. */
const COUNTRY_ABBREVIATIONS: Record<string, string> = {
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  us: 'US',
  canada: 'CA',
  mexico: 'MX',
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
  france: 'FR',
  germany: 'DE',
  spain: 'ES',
  italy: 'IT',
  portugal: 'PT',
  netherlands: 'NL',
  belgium: 'BE',
  switzerland: 'CH',
  austria: 'AT',
  ireland: 'IE',
  australia: 'AU',
  'new zealand': 'NZ',
  japan: 'JP',
  china: 'CN',
  india: 'IN',
  brazil: 'BR',
  argentina: 'AR',
  chile: 'CL',
  colombia: 'CO',
  'south korea': 'KR',
  'korea, republic of': 'KR',
  singapore: 'SG',
  'hong kong': 'HK',
  taiwan: 'TW',
  thailand: 'TH',
  vietnam: 'VN',
  philippines: 'PH',
  indonesia: 'ID',
  malaysia: 'MY',
  'united arab emirates': 'AE',
  'saudi arabia': 'SA',
  israel: 'IL',
  turkey: 'TR',
  greece: 'GR',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  poland: 'PL',
  'czech republic': 'CZ',
  czechia: 'CZ',
  'south africa': 'ZA',
  egypt: 'EG',
  morocco: 'MA',
};

function abbreviateRegion(region: string): string {
  const trimmed = region.trim();
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  return US_STATE_ABBREVIATIONS[trimmed.toLocaleLowerCase()] ?? trimmed;
}

function abbreviateCountry(country: string): string {
  const trimmed = country.trim();
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  return COUNTRY_ABBREVIATIONS[trimmed.toLocaleLowerCase()] ?? trimmed;
}

function isUsStateName(value: string): boolean {
  const trimmed = value.trim();
  if (/^[A-Z]{2}$/.test(trimmed)) {
    return Object.values(US_STATE_ABBREVIATIONS).includes(trimmed);
  }
  return Boolean(US_STATE_ABBREVIATIONS[trimmed.toLocaleLowerCase()]);
}

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
