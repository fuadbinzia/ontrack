import type { Theme } from '@/design-system';
import { getDateTimeFormatter } from '@/utils/intl-cache';

import type { TravelPlan } from './types';

export type TravelTimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export type TravelWeatherMood =
  | 'clear'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'mixed';

export interface TravelAtmosphere {
  destination: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  weatherCode?: number;
  timeOfDay: TravelTimeOfDay;
}

export interface TravelAtmosphereScheme {
  fallback: string;
  stops: readonly [string, string, string, string];
  topGlow: string;
  sideGlow: string;
}

const LOCATION_LIGHT = ['#8EDBCD', '#A9D7B4', '#9DCDE5', '#B7D2AE', '#B8C5E8'] as const;
const LOCATION_DARK = ['#174A43', '#294632', '#1D4050', '#34422D', '#303452'] as const;

const TIME_LIGHT: Record<TravelTimeOfDay, Pick<TravelAtmosphereScheme, 'fallback' | 'topGlow'> & {
  start: string;
  horizon: string;
}> = {
  dawn: {
    fallback: '#A9C9E8',
    start: '#A9C9E8',
    horizon: '#F0C47A',
    topGlow: 'rgba(245, 190, 89, 0.7)',
  },
  day: {
    fallback: '#72C9E6',
    start: '#72C9E6',
    horizon: '#E9CE78',
    topGlow: 'rgba(239, 204, 83, 0.66)',
  },
  dusk: {
    fallback: '#A8B5E4',
    start: '#A8B5E4',
    horizon: '#E5B676',
    topGlow: 'rgba(232, 161, 72, 0.68)',
  },
  night: {
    fallback: '#8CA9C8',
    start: '#8CA9C8',
    horizon: '#C5B58B',
    topGlow: 'rgba(205, 177, 95, 0.54)',
  },
};

const TIME_DARK: typeof TIME_LIGHT = {
  dawn: {
    fallback: '#1E3550',
    start: '#1E3550',
    horizon: '#493823',
    topGlow: 'rgba(181, 124, 53, 0.48)',
  },
  day: {
    fallback: '#123447',
    start: '#123447',
    horizon: '#3B3B25',
    topGlow: 'rgba(166, 142, 47, 0.46)',
  },
  dusk: {
    fallback: '#202D4D',
    start: '#202D4D',
    horizon: '#4A3023',
    topGlow: 'rgba(177, 101, 45, 0.48)',
  },
  night: {
    fallback: '#0A1E35',
    start: '#0A1E35',
    horizon: '#252444',
    topGlow: 'rgba(83, 91, 154, 0.4)',
  },
};

const WEATHER_LIGHT: Record<TravelWeatherMood, { depth: string; sideGlow: string }> = {
  clear: { depth: '#B5C9ED', sideGlow: 'rgba(69, 205, 179, 0.66)' },
  cloudy: { depth: '#B3C3CF', sideGlow: 'rgba(118, 166, 165, 0.56)' },
  fog: { depth: '#C0C9C3', sideGlow: 'rgba(143, 179, 165, 0.52)' },
  rain: { depth: '#98B4CA', sideGlow: 'rgba(58, 149, 158, 0.58)' },
  snow: { depth: '#D4DCE6', sideGlow: 'rgba(156, 211, 220, 0.58)' },
  storm: { depth: '#95A6C3', sideGlow: 'rgba(75, 112, 155, 0.58)' },
  mixed: { depth: '#BCC4E7', sideGlow: 'rgba(78, 184, 166, 0.6)' },
};

const WEATHER_DARK: typeof WEATHER_LIGHT = {
  clear: { depth: '#2E3154', sideGlow: 'rgba(25, 127, 104, 0.54)' },
  cloudy: { depth: '#303A48', sideGlow: 'rgba(68, 105, 103, 0.5)' },
  fog: { depth: '#3A4140', sideGlow: 'rgba(87, 112, 100, 0.46)' },
  rain: { depth: '#26394D', sideGlow: 'rgba(27, 96, 105, 0.52)' },
  snow: { depth: '#3C4656', sideGlow: 'rgba(85, 132, 142, 0.5)' },
  storm: { depth: '#282B4A', sideGlow: 'rgba(49, 66, 106, 0.54)' },
  mixed: { depth: '#30314F', sideGlow: 'rgba(31, 106, 93, 0.52)' },
};

function destinationHash(destination: string): number {
  let hash = 0;
  for (const character of destination.trim().toLocaleLowerCase()) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

function locationColorIndex(atmosphere: TravelAtmosphere): number {
  const coordinateSeed =
    atmosphere.latitude === undefined || atmosphere.longitude === undefined
      ? 0
      : Math.round((atmosphere.latitude + 90) * 10) +
        Math.round((atmosphere.longitude + 180) * 10);
  return (destinationHash(atmosphere.destination) + coordinateSeed) % LOCATION_LIGHT.length;
}

export function travelWeatherMood(weatherCode?: number): TravelWeatherMood {
  if (weatherCode === undefined) return 'mixed';
  if (weatherCode === 0) return 'clear';
  if (weatherCode >= 1 && weatherCode <= 3) return 'cloudy';
  if (weatherCode === 45 || weatherCode === 48) return 'fog';
  if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
    return 'rain';
  }
  if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) {
    return 'snow';
  }
  if (weatherCode >= 95) return 'storm';
  return 'mixed';
}

export function travelTimeOfDay(date: Date, timezone?: string): TravelTimeOfDay {
  let hour = date.getHours();
  if (timezone) {
    try {
      const hourPart = getDateTimeFormatter('en-US', {
        hour: '2-digit',
        hourCycle: 'h23',
        timeZone: timezone,
      }).formatToParts(date).find((part) => part.type === 'hour')?.value;
      const parsed = Number(hourPart);
      if (Number.isFinite(parsed)) hour = parsed;
    } catch {
      // A stale/unknown timezone should not prevent the Travel screen from rendering.
    }
  }
  if (hour >= 5 && hour < 9) return 'dawn';
  if (hour >= 9 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'dusk';
  return 'night';
}

export function travelAtmosphereScheme(
  theme: Theme,
  atmosphere: TravelAtmosphere,
): TravelAtmosphereScheme {
  const dark = theme.name === 'dark';
  const time = (dark ? TIME_DARK : TIME_LIGHT)[atmosphere.timeOfDay];
  const weather = (dark ? WEATHER_DARK : WEATHER_LIGHT)[
    travelWeatherMood(atmosphere.weatherCode)
  ];
  const location = (dark ? LOCATION_DARK : LOCATION_LIGHT)[locationColorIndex(atmosphere)];
  return {
    fallback: time.fallback,
    stops: [time.start, location, weather.depth, time.horizon],
    topGlow: time.topGlow,
    sideGlow: weather.sideGlow,
  };
}

export function selectTravelAtmospherePlan(
  plans: TravelPlan[],
  pathname: string,
  today: string,
): TravelPlan | undefined {
  const detailId = pathname.match(/^\/travel\/([^/]+)/)?.[1];
  if (detailId) {
    const decodedId = decodeURIComponent(detailId);
    const detailPlan = plans.find((plan) => plan.id === decodedId);
    if (detailPlan) return detailPlan;
  }
  const sorted = [...plans].sort((left, right) => left.startDate.localeCompare(right.startDate));
  return (
    sorted.find((plan) => plan.startDate <= today && plan.endDate >= today) ??
    sorted.find((plan) => plan.endDate >= today) ??
    sorted.at(-1)
  );
}
