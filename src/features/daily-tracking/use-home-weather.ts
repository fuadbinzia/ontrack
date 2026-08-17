import type { AppIconName } from '@/design-system';
import { temperatureUnitForDateFormat } from '@/features/travel/weather/temperature-unit';
import { useCurrentPlaceLabel } from '@/hooks/use-current-place-label';
import { usePreferences } from '@/store/preferences';
import { todayKey } from '@/utils/date';

import { weatherPlacesMatch } from './weather-place-label';
import { usePlaceWeather } from './use-place-weather';

export function useHomeWeather(date?: string) {
  const homeLocation = usePreferences((state) => state.homeLocation);
  const currentLocation = usePreferences((state) => state.currentLocation);
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const temperatureUnit = temperatureUnitForDateFormat(dateDisplayFormat);
  const savedHome = homeLocation.trim();
  const savedCurrent = currentLocation.trim();
  const hasSavedHome = savedHome.length > 0;
  const viewingToday = !date || date === todayKey();

  // Live GPS only when Current has no user override — never writes home.
  const needGps = viewingToday && !savedCurrent;
  const currentPlace = useCurrentPlaceLabel(needGps);
  const currentPlaceLabel =
    currentPlace.status === 'suggested' ? currentPlace.label : '';
  const currentQuery = viewingToday
    ? savedCurrent || currentPlaceLabel
    : '';
  // GPS place → use the device coordinate so weather never re-geocodes the
  // label into a same-named town in another state.
  const currentCoordinate =
    !savedCurrent && currentQuery ? currentPlace.coordinate : undefined;

  const home = usePlaceWeather(savedHome, temperatureUnit, date);
  const current = usePlaceWeather(
    currentQuery,
    temperatureUnit,
    date,
    currentCoordinate,
  );

  // Primary banner: saved home when set, else Current (override or GPS).
  const weather = hasSavedHome ? home.weather : current.weather;
  const icon: AppIconName | undefined = hasSavedHome ? home.icon : current.icon;
  const showWeather = Boolean(weather);

  // Same place → one full-width home banner (side-by-side only when distinct).
  const homeLabel = home.weather?.locationLabel ?? '';
  const currentLabel = current.weather?.locationLabel ?? '';
  const samePlace =
    Boolean(currentQuery) &&
    (weatherPlacesMatch(savedHome, currentQuery) ||
      (Boolean(homeLabel) &&
        Boolean(currentLabel) &&
        weatherPlacesMatch(homeLabel, currentLabel)));

  const showCurrentWeather =
    hasSavedHome &&
    viewingToday &&
    Boolean(currentQuery) &&
    Boolean(current.weather) &&
    !samePlace;

  return {
    hasSavedHome,
    weather,
    icon,
    showWeather,
    currentWeather: showCurrentWeather ? current.weather : undefined,
    currentIcon: showCurrentWeather ? current.icon : undefined,
    showCurrentWeather,
  };
}
