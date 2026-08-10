import type { AppIconName } from '@/design-system';
import { fetchWithTimeout } from '@/services/http/fetch-with-timeout';
import { addDays, todayKey } from '@/utils/date';
import { formatOpenMeteoPlaceLabel } from '@/utils/open-meteo-place-label';

import type {
    DestinationCurrentWeather,
    TemperatureUnit,
    TravelWeather,
    TravelWeatherDay,
} from './types';

/** Open-Meteo daily forecast length (docs: up to 16). */
export const WEATHER_FORECAST_DAYS = 16;
/** Open-Meteo forecast `past_days` / start_date floor (docs: 0–92). */
export const OPEN_METEO_PAST_DAYS_MAX = 92;
export const WEATHER_UNAVAILABLE_MESSAGE = 'Weather is temporarily unavailable.';
const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 30 * 60 * 1000;

export function weatherFetchErrorMessage(
  reason: unknown,
  fallback = WEATHER_UNAVAILABLE_MESSAGE,
): string {
  return reason instanceof Error ? reason.message : fallback;
}

export type TravelWeatherFetchOptions = {
  /** Include up to N calendar days before today (capped at OPEN_METEO_PAST_DAYS_MAX). */
  pastDays?: number;
};

interface GeocodingResult {
  name?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  country?: unknown;
  admin1?: unknown;
}

interface GeocodingResponse {
  results?: unknown;
}

interface ForecastResponse {
  timezone?: unknown;
  daily?: {
    time?: unknown;
    weather_code?: unknown;
    temperature_2m_min?: unknown;
    temperature_2m_max?: unknown;
    precipitation_probability_max?: unknown;
  };
}

interface CurrentForecastResponse {
  timezone?: unknown;
  current?: {
    temperature_2m?: unknown;
    weather_code?: unknown;
    is_day?: unknown;
  };
}

interface ForecastWindow {
  availability: TravelWeather['availability'];
  requestStart?: string;
  requestEnd?: string;
  availableOn?: string;
  availableThrough?: string;
}

interface CacheEntry {
  expiresAt: number;
  promise: Promise<TravelWeather>;
}

const cache = new Map<string, CacheEntry>();
const currentCache = new Map<string, { expiresAt: number; promise: Promise<DestinationCurrentWeather> }>();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  try {
    const response = await fetchWithTimeout(url, { signal }, REQUEST_TIMEOUT_MS);
    if (!response.ok) throw new Error(`Weather service returned ${response.status}.`);
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Weather request timed out.');
    }
    throw error instanceof Error
      ? error
      : new Error(WEATHER_UNAVAILABLE_MESSAGE);
  }
}

export function forecastWindow(
  startDate: string,
  endDate: string,
  today = todayKey(),
  options?: TravelWeatherFetchOptions,
): ForecastWindow {
  const availableThrough = addDays(today, WEATHER_FORECAST_DAYS - 1);
  const pastDays = Math.max(
    0,
    Math.min(options?.pastDays ?? 0, OPEN_METEO_PAST_DAYS_MAX),
  );
  const earliest = pastDays > 0 ? addDays(today, -pastDays) : today;

  // Fully before any requestable day (travel default: before today; home: before past floor).
  if (endDate < earliest) return { availability: 'past' };
  if (startDate > availableThrough) {
    return {
      availability: 'too-early',
      availableOn: addDays(startDate, -(WEATHER_FORECAST_DAYS - 1)),
    };
  }

  const requestStart = startDate < earliest ? earliest : startDate;
  const requestEnd = endDate > availableThrough ? availableThrough : endDate;
  return {
    availability: requestEnd < endDate ? 'partial' : 'forecast',
    requestStart,
    requestEnd,
    availableThrough: requestEnd < endDate ? requestEnd : undefined,
  };
}

export function describeWeatherCode(code: number): Pick<TravelWeatherDay, 'condition' | 'symbol'> {
  if (code === 0) return { condition: 'Clear', symbol: '☀️' };
  if (code === 1 || code === 2) return { condition: 'Partly cloudy', symbol: '🌤️' };
  if (code === 3) return { condition: 'Cloudy', symbol: '☁️' };
  if (code === 45 || code === 48) return { condition: 'Foggy', symbol: '🌫️' };
  if (code >= 51 && code <= 67) return { condition: 'Rain', symbol: '🌧️' };
  if (code >= 71 && code <= 77) return { condition: 'Snow', symbol: '🌨️' };
  if (code >= 80 && code <= 82) return { condition: 'Showers', symbol: '🌦️' };
  if (code === 85 || code === 86) return { condition: 'Snow showers', symbol: '🌨️' };
  if (code >= 95) return { condition: 'Thunderstorms', symbol: '⛈️' };
  return { condition: 'Mixed weather', symbol: '🌥️' };
}

/** Monochrome SF Symbol mapping for Today chrome / tab bar. */
export function weatherIconForCode(
  code: number,
  options?: { isDay?: boolean },
): AppIconName {
  const night = options?.isDay === false;
  if (code === 0) return night ? 'weather-clear-night' : 'weather-clear';
  if (code === 1 || code === 2) {
    return night ? 'weather-partly-cloudy-night' : 'weather-partly-cloudy';
  }
  if (code === 3) return 'weather-cloudy';
  if (code === 45 || code === 48) return 'weather-fog';
  if (code >= 51 && code <= 67) return 'weather-rain';
  if (code >= 71 && code <= 77) return 'weather-snow';
  if (code >= 80 && code <= 82) {
    return night ? 'weather-showers-night' : 'weather-showers';
  }
  if (code === 85 || code === 86) return 'weather-snow';
  if (code >= 95) return 'weather-thunder';
  return night ? 'weather-partly-cloudy-night' : 'weather-partly-cloudy';
}

/** Normalize Open-Meteo `is_day` (0/1) for chrome icons. */
export function weatherIsDayFlag(value: unknown): boolean | undefined {
  if (value === 0 || value === false) return false;
  if (value === 1 || value === true) return true;
  return undefined;
}

function locationLabel(result: GeocodingResult, fallback: string): string {
  return formatOpenMeteoPlaceLabel(
    [
      typeof result.name === 'string' ? result.name : undefined,
      typeof result.admin1 === 'string' ? result.admin1 : undefined,
      typeof result.country === 'string' ? result.country : undefined,
    ],
    fallback,
  );
}

/**
 * Map Open-Meteo daily arrays → trip/home days.
 * Past windows often include null placeholders for code/temps — skip those days
 * instead of rejecting the whole forecast (which hid working future days).
 */
export function normalizeTravelWeatherDays(response: ForecastResponse): TravelWeatherDay[] {
  const daily = response.daily;
  const dates = daily?.time;
  const codes = daily?.weather_code;
  const minimums = daily?.temperature_2m_min;
  const maximums = daily?.temperature_2m_max;
  const precipitation = daily?.precipitation_probability_max;

  if (
    !isStringArray(dates) ||
    !Array.isArray(codes) ||
    !Array.isArray(minimums) ||
    !Array.isArray(maximums)
  ) {
    throw new Error('Weather service returned incomplete forecast data.');
  }

  const precipArr = Array.isArray(precipitation) ? precipitation : [];
  const length = Math.min(dates.length, codes.length, minimums.length, maximums.length);
  const days: TravelWeatherDay[] = [];
  for (let index = 0; index < length; index += 1) {
    const weatherCode = codes[index];
    const temperatureMin = minimums[index];
    const temperatureMax = maximums[index];
    if (
      !isFiniteNumber(weatherCode) ||
      !isFiniteNumber(temperatureMin) ||
      !isFiniteNumber(temperatureMax)
    ) {
      continue;
    }
    const precipRaw = precipArr[index];
    days.push({
      date: dates[index],
      weatherCode,
      ...describeWeatherCode(weatherCode),
      temperatureMin: Math.round(temperatureMin),
      temperatureMax: Math.round(temperatureMax),
      precipitationProbability: isFiniteNumber(precipRaw) ? Math.round(precipRaw) : 0,
    });
  }
  return days;
}

async function requestTravelWeather(
  destination: string,
  startDate: string,
  endDate: string,
  temperatureUnit: TemperatureUnit,
  options?: TravelWeatherFetchOptions,
): Promise<TravelWeather> {
  const window = forecastWindow(startDate, endDate, todayKey(), options);
  if (!window.requestStart || !window.requestEnd) {
    return {
      availability: window.availability,
      locationLabel: destination,
      temperatureUnit,
      days: [],
      availableOn: window.availableOn,
    };
  }

  const location = await geocodeDestination(destination);

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.searchParams.set('latitude', String(location.latitude));
  forecastUrl.searchParams.set('longitude', String(location.longitude));
  forecastUrl.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  );
  forecastUrl.searchParams.set('temperature_unit', temperatureUnit);
  forecastUrl.searchParams.set('timezone', 'auto');
  forecastUrl.searchParams.set('start_date', window.requestStart);
  forecastUrl.searchParams.set('end_date', window.requestEnd);
  const forecast = await fetchJson<ForecastResponse>(forecastUrl.toString());
  const days = normalizeTravelWeatherDays(forecast);
  if (days.length === 0) throw new Error('No forecast is available for these trip dates yet.');

  return {
    availability: window.availability,
    locationLabel: locationLabel(location, destination),
    timezone: typeof forecast.timezone === 'string' ? forecast.timezone : undefined,
    temperatureUnit,
    days,
    availableThrough: window.availableThrough,
  };
}

export function getTravelWeather(
  destination: string,
  startDate: string,
  endDate: string,
  temperatureUnit: TemperatureUnit,
  signal?: AbortSignal,
  options?: TravelWeatherFetchOptions,
): Promise<TravelWeather> {
  const pastDays = options?.pastDays ?? 0;
  const key = [
    destination.trim().toLocaleLowerCase(),
    startDate,
    endDate,
    temperatureUnit,
    pastDays,
  ].join('|');
  const cached = cache.get(key);
  // Shared cache must not bind to a caller AbortSignal — one unmount would abort
  // every concurrent consumer of the same key.
  if (cached && cached.expiresAt > Date.now()) {
    return raceWeatherPromise(cached.promise, signal);
  }

  const promise = requestTravelWeather(
    destination.trim(),
    startDate,
    endDate,
    temperatureUnit,
    options,
  ).catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
  return raceWeatherPromise(promise, signal);
}

async function geocodeDestination(
  destination: string,
  signal?: AbortSignal,
): Promise<GeocodingResult> {
  const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geocodingUrl.searchParams.set('name', destination);
  geocodingUrl.searchParams.set('count', '1');
  geocodingUrl.searchParams.set('language', 'en');
  geocodingUrl.searchParams.set('format', 'json');
  const geocoding = await fetchJson<GeocodingResponse>(geocodingUrl.toString(), signal);
  const results = Array.isArray(geocoding.results) ? geocoding.results : [];
  const location = results[0] as GeocodingResult | undefined;
  if (!location || !isFiniteNumber(location.latitude) || !isFiniteNumber(location.longitude)) {
    throw new Error(`Weather could not find “${destination}”. Try a city and country.`);
  }
  return location;
}

async function requestDestinationCurrentWeather(
  destination: string,
  temperatureUnit: TemperatureUnit,
  signal?: AbortSignal,
): Promise<DestinationCurrentWeather> {
  const location = await geocodeDestination(destination, signal);
  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.searchParams.set('latitude', String(location.latitude));
  forecastUrl.searchParams.set('longitude', String(location.longitude));
  forecastUrl.searchParams.set('current', 'temperature_2m,weather_code,is_day');
  forecastUrl.searchParams.set('temperature_unit', temperatureUnit);
  forecastUrl.searchParams.set('timezone', 'auto');
  const forecast = await fetchJson<CurrentForecastResponse>(forecastUrl.toString(), signal);
  const temperature = forecast.current?.temperature_2m;
  const weatherCode = forecast.current?.weather_code;
  if (!isFiniteNumber(temperature) || !isFiniteNumber(weatherCode)) {
    throw new Error('Weather service returned incomplete current conditions.');
  }
  return {
    locationLabel: locationLabel(location, destination),
    latitude: location.latitude as number,
    longitude: location.longitude as number,
    timezone: typeof forecast.timezone === 'string' ? forecast.timezone : undefined,
    temperature: Math.round(temperature),
    temperatureUnit,
    weatherCode,
    isDay: weatherIsDayFlag(forecast.current?.is_day),
    ...describeWeatherCode(weatherCode),
  };
}

/** Live temperature + condition for a destination (cached ~30 min). */
export function getDestinationCurrentWeather(
  destination: string,
  temperatureUnit: TemperatureUnit,
  signal?: AbortSignal,
): Promise<DestinationCurrentWeather> {
  // v2: response includes `is_day` for night chrome icons.
  const key = `current|v2|${destination.trim().toLocaleLowerCase()}|${temperatureUnit}`;
  const cached = currentCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return raceWeatherPromise(cached.promise, signal);
  }

  const promise = requestDestinationCurrentWeather(
    destination.trim(),
    temperatureUnit,
  ).catch((error) => {
    currentCache.delete(key);
    throw error;
  });
  currentCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
  return raceWeatherPromise(promise, signal);
}

/** Let a caller cancel awaiting without aborting the shared in-flight request. */
function raceWeatherPromise<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
