import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { getDestinationCurrentWeather } from '@/features/travel/weather';
import { temperatureUnitForDateFormat } from '@/features/travel/weather/temperature-unit';
import type { DateDisplayFormat } from '@/utils/date';

import {
  travelTimeOfDay,
  type TravelAtmosphere,
} from './travel-atmosphere-model';

const CLOCK_REFRESH_MS = 5 * 60 * 1000;

const DEFAULT_ATMOSPHERE: TravelAtmosphere = {
  destination: 'Travel',
  timeOfDay: 'day',
};

const TravelAtmosphereContext = createContext<TravelAtmosphere>(DEFAULT_ATMOSPHERE);

export function TravelAtmosphereProvider({
  atmosphere,
  children,
}: PropsWithChildren<{ atmosphere: TravelAtmosphere }>) {
  return (
    <TravelAtmosphereContext.Provider value={atmosphere}>
      {children}
    </TravelAtmosphereContext.Provider>
  );
}

export function useTravelAtmosphere(): TravelAtmosphere {
  return useContext(TravelAtmosphereContext);
}

/** Loads cached live conditions only while a Travel route is active. */
export function useTravelRouteAtmosphere(
  destination: string | undefined,
  dateDisplayFormat: DateDisplayFormat,
  enabled: boolean,
): TravelAtmosphere {
  const normalizedDestination = destination?.trim() || 'Travel';
  const [clock, setClock] = useState(() => new Date());
  const [live, setLive] = useState<{
    destination: string;
    latitude: number;
    longitude: number;
    timezone?: string;
    weatherCode: number;
  }>();

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setClock(new Date()), CLOCK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || normalizedDestination === 'Travel') return;
    const controller = new AbortController();
    void getDestinationCurrentWeather(
      normalizedDestination,
      temperatureUnitForDateFormat(dateDisplayFormat),
      controller.signal,
    ).then((weather) => {
      setClock(new Date());
      setLive({
        destination: normalizedDestination,
        latitude: weather.latitude,
        longitude: weather.longitude,
        timezone: weather.timezone,
        weatherCode: weather.weatherCode,
      });
    }).catch(() => {
      // Destination + device time remain a colorful offline fallback.
    });
    return () => controller.abort();
  }, [dateDisplayFormat, enabled, normalizedDestination]);

  return useMemo(() => {
    const current = live?.destination === normalizedDestination ? live : undefined;
    return {
      destination: normalizedDestination,
      latitude: current?.latitude,
      longitude: current?.longitude,
      timezone: current?.timezone,
      weatherCode: current?.weatherCode,
      timeOfDay: travelTimeOfDay(clock, current?.timezone),
    };
  }, [clock, live, normalizedDestination]);
}
