import type {
  DestinationCurrentWeather,
  TemperatureUnit,
  TravelWeather,
  TravelWeatherDay,
} from '@/features/travel/weather';
/** Deep import — weather barrel pulls RN card UI into this util. */
import { unitSymbol } from '@/features/travel/weather/temperature-unit';
import { addDays, todayKey } from '@/utils/date';

export { unitSymbol };

/** Open-Meteo daily forecast length used by travel weather provider. */
export const HOME_WEATHER_FORECAST_DAYS = 16;
/**
 * How far back Today can show daily weather.
 * Keep in sync with `OPEN_METEO_PAST_DAYS_MAX` in the weather provider (0–92).
 * Value import from the weather barrel would pull RN UI into this util — don’t.
 */
export const HOME_WEATHER_PAST_DAYS = 92;

export type HomeWeatherSnapshot = {
  /** Live temp when `isLive`, otherwise the daily high. */
  temperature: number;
  temperatureLow?: number;
  temperatureHigh?: number;
  temperatureUnit: TemperatureUnit;
  condition: string;
  weatherCode: number;
  locationLabel: string;
  timezone?: string;
  /** True when `temperature` is the live reading (today). */
  isLive: boolean;
};

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

function hasTemperatureRange(
  weather: HomeWeatherSnapshot,
): weather is HomeWeatherSnapshot & { temperatureHigh: number; temperatureLow: number } {
  return (
    typeof weather.temperatureHigh === 'number' &&
    typeof weather.temperatureLow === 'number'
  );
}

/** Primary chrome line: live temp + condition, or daily H/L + condition. */
export function formatHomeWeatherPrimaryLabel(weather: HomeWeatherSnapshot): string {
  const unit = unitSymbol(weather.temperatureUnit);
  if (weather.isLive) {
    return `${weather.temperature}${unit} · ${weather.condition}`;
  }
  if (hasTemperatureRange(weather)) {
    return `H ${weather.temperatureHigh}${unit} · L ${weather.temperatureLow}${unit} · ${weather.condition}`;
  }
  return `${weather.temperature}${unit} · ${weather.condition}`;
}

/**
 * Secondary chrome line for live days with a forecast range.
 * Uses bare ° so it stays lighter under the primary unit.
 */
export function formatHomeWeatherRangeLabel(weather: HomeWeatherSnapshot): string | undefined {
  if (!weather.isLive || !hasTemperatureRange(weather)) return undefined;
  return `H ${weather.temperatureHigh}° · L ${weather.temperatureLow}°`;
}

/** Accessibility / assert string covering primary + optional range. */
export function formatHomeWeatherTemperatureLabel(weather: HomeWeatherSnapshot): string {
  const primary = formatHomeWeatherPrimaryLabel(weather);
  const range = formatHomeWeatherRangeLabel(weather);
  return range ? `${primary} · ${range}` : primary;
}

export function homeWeatherForecastThrough(today = todayKey()): string {
  return addDays(today, HOME_WEATHER_FORECAST_DAYS - 1);
}

export function homeWeatherHistoryFrom(today = todayKey()): string {
  return addDays(today, -HOME_WEATHER_PAST_DAYS);
}

/** True while the selected day is inside the Open-Meteo past→forecast window. */
export function isHomeWeatherDateInWindow(date: string, today = todayKey()): boolean {
  return date >= homeWeatherHistoryFrom(today) && date <= homeWeatherForecastThrough(today);
}

function snapshotFromDay(
  day: TravelWeatherDay,
  temperatureUnit: TemperatureUnit,
  locationLabel: string,
  timezone?: string,
): HomeWeatherSnapshot {
  return {
    temperature: day.temperatureMax,
    temperatureHigh: day.temperatureMax,
    temperatureLow: day.temperatureMin,
    temperatureUnit,
    condition: day.condition,
    weatherCode: day.weatherCode,
    locationLabel,
    timezone,
    isLive: false,
  };
}

function snapshotFromCurrent(
  current: DestinationCurrentWeather,
  day?: TravelWeatherDay,
): HomeWeatherSnapshot {
  return {
    temperature: current.temperature,
    temperatureHigh: day?.temperatureMax,
    temperatureLow: day?.temperatureMin,
    temperatureUnit: current.temperatureUnit,
    condition: current.condition,
    weatherCode: current.weatherCode,
    locationLabel: current.locationLabel,
    timezone: current.timezone,
    isLive: true,
  };
}

/**
 * Resolve chrome weather for a Today date key.
 * Outside the Open-Meteo past/forecast window → undefined.
 * Today prefers live conditions (+ daily H/L when the forecast day exists).
 */
export function resolveHomeWeatherForDate({
  date,
  current,
  forecast,
  today = todayKey(),
}: {
  date: string;
  current?: DestinationCurrentWeather;
  forecast?: TravelWeather;
  today?: string;
}): HomeWeatherSnapshot | undefined {
  if (!isHomeWeatherDateInWindow(date, today)) return undefined;

  const locationLabel =
    current?.locationLabel ?? forecast?.locationLabel ?? '';
  const timezone = current?.timezone ?? forecast?.timezone;
  const unit =
    current?.temperatureUnit ?? forecast?.temperatureUnit ?? 'fahrenheit';
  const day = forecast?.days.find((entry) => entry.date === date);

  if (date === today) {
    if (current) return snapshotFromCurrent(current, day);
    return day ? snapshotFromDay(day, unit, locationLabel, timezone) : undefined;
  }

  return day ? snapshotFromDay(day, unit, locationLabel, timezone) : undefined;
}
