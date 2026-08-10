import { useEffect, useMemo, useState } from 'react';

import type { AppIconName } from '@/design-system';
import { travelTimeOfDay } from '@/features/travel/travel-atmosphere-model';
import {
    getDestinationCurrentWeather,
    getTravelWeather,
    weatherFetchErrorMessage,
    weatherIconForCode,
} from '@/features/travel/weather/provider';
import type {
    DestinationCurrentWeather,
    TemperatureUnit,
    TravelWeather,
} from '@/features/travel/weather/types';
import { todayKey } from '@/utils/date';

import {
    HOME_WEATHER_PAST_DAYS,
    homeWeatherForecastThrough,
    homeWeatherHistoryFrom,
    isHomeWeatherDateInWindow,
    resolveHomeWeatherForDate,
    type HomeWeatherSnapshot,
} from './resolve-home-weather-day';

/** Prefer Open-Meteo `is_day`; else local night band when live + timezone known. */
function weatherChromeIsDay(weather: HomeWeatherSnapshot): boolean | undefined {
  if (typeof weather.isDay === 'boolean') return weather.isDay;
  if (!weather.isLive) return true;
  if (!weather.timezone) return undefined;
  return travelTimeOfDay(new Date(), weather.timezone) !== 'night';
}

export function usePlaceWeather(
  place: string,
  temperatureUnit: TemperatureUnit,
  date?: string,
) {
  const trimmed = place.trim();
  const hasLocation = trimmed.length > 0;

  const [current, setCurrent] = useState<DestinationCurrentWeather>();
  const [forecast, setForecast] = useState<TravelWeather>();
  const [loading, setLoading] = useState(false);
  const [currentError, setCurrentError] = useState<string>();
  const [forecastError, setForecastError] = useState<string>();

  useEffect(() => {
    if (!hasLocation) {
      setCurrent(undefined);
      setForecast(undefined);
      setLoading(false);
      setCurrentError(undefined);
      setForecastError(undefined);
      return;
    }

    const controller = new AbortController();
    let currentSettled = false;
    let forecastSettled = false;
    let nextCurrent: DestinationCurrentWeather | undefined;
    let nextForecast: TravelWeather | undefined;
    let nextCurrentError: string | undefined;
    let nextForecastError: string | undefined;

    const publish = () => {
      if (controller.signal.aborted) return;
      if (!currentSettled || !forecastSettled) return;
      setCurrent(nextCurrent);
      setForecast(nextForecast);
      setCurrentError(nextCurrentError);
      setForecastError(nextForecastError);
      setLoading(false);
    };

    setLoading(true);
    setCurrentError(undefined);
    setForecastError(undefined);

    const today = todayKey();
    const forecastStart = homeWeatherHistoryFrom(today);
    const forecastEnd = homeWeatherForecastThrough(today);

    void getDestinationCurrentWeather(trimmed, temperatureUnit, controller.signal)
      .then((value) => {
        nextCurrent = value;
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        nextCurrentError = weatherFetchErrorMessage(reason);
      })
      .finally(() => {
        currentSettled = true;
        publish();
      });

    void getTravelWeather(
      trimmed,
      forecastStart,
      forecastEnd,
      temperatureUnit,
      controller.signal,
      { pastDays: HOME_WEATHER_PAST_DAYS },
    )
      .then((value) => {
        nextForecast = value;
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        nextForecastError = weatherFetchErrorMessage(reason);
      })
      .finally(() => {
        forecastSettled = true;
        publish();
      });

    return () => controller.abort();
  }, [hasLocation, temperatureUnit, trimmed]);

  const weather: HomeWeatherSnapshot | undefined = useMemo(
    () =>
      resolveHomeWeatherForDate({
        date: date ?? todayKey(),
        current,
        forecast,
      }),
    [current, date, forecast],
  );

  const inForecastWindow = !date || isHomeWeatherDateInWindow(date);
  const viewingToday = !date || date === todayKey();
  const error = !inForecastWindow
    ? undefined
    : viewingToday
      ? currentError ?? (!weather ? forecastError : undefined)
      : forecastError ?? (!weather ? currentError : undefined);

  const icon: AppIconName | undefined = weather
    ? weatherIconForCode(weather.weatherCode, { isDay: weatherChromeIsDay(weather) })
    : undefined;

  return {
    hasLocation,
    weather,
    icon,
    loading,
    error,
  };
}
