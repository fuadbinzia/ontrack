import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ImageSource } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useHomeWeather } from '@/features/daily-tracking/use-home-weather';
import {
  travelTimeOfDay,
  travelWeatherMood,
  type TravelTimeOfDay,
} from '@/features/travel/travel-atmosphere-model';
import { useTravelAtmosphere } from '@/features/travel/travel-atmosphere';
import {
  atmosphereDestinationKey,
  mergeAtmospherePlaces,
  pickAtmosphereDestination,
  rememberRecentKeys,
} from '@/features/travel/travel-home-atmosphere-queries';
import {
  resolveAtmosphereHeaderInk,
  type TravelAtmosphereHeaderInk,
} from '@/features/travel/travel-home-atmosphere-ink';
import {
  pickCuratedTravelHomeAtmosphere,
  pickCuratedTravelHomeAtmosphereForPlace,
  resolveTravelHomeAtmosphereImage,
  type TravelHomeAtmosphereImage,
} from '@/features/travel/travel-home-atmosphere-resolve';
import { travelHomeTokens } from '@/features/travel/travel-home-tokens';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';

/** Bump when cover provider/filters change so stale people plates leave rotation. */
const RECENT_STORAGE_KEY = '@ontrack/travel-home-atmosphere-recent-v6';
/** Image keys + destination keys share one history so places keep cycling. */
const RECENT_LIMIT = 16;

type UseTravelHomeAtmosphereImageArgs = {
  enabled: boolean;
  /**
   * Every trip place label (current + past). Combined with profile home
   * location so the header wash rotates across trips and home.
   */
  tripDestinations?: readonly string[];
};

async function loadRecentKeys(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

async function saveRecentKeys(keys: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(keys.slice(0, RECENT_LIMIT)));
  } catch {
    // Offline surprise still works without persistence.
  }
}

/**
 * Resolves the Travel home header wash:
 * - trip destinations + profile home → live remote rotating across every place
 * - no places set → live wanderlust remote from home weather/time
 * - miss/offline → curated rotating plates
 *
 * Picks a fresh scene each time the Travel tab focuses.
 */
export function useTravelHomeAtmosphereImage({
  enabled,
  tripDestinations = [],
}: UseTravelHomeAtmosphereImageArgs): {
  source: ImageSource;
  skyColor: string;
  origin: TravelHomeAtmosphereImage['origin'];
  label?: string;
  /** White (`light`) vs black (`dark`) header ink for the live plate. */
  headerInk: TravelAtmosphereHeaderInk;
  /** Dominant / average plate color when known (`#RRGGBB`). */
  averageColor?: string;
  timeOfDay: TravelTimeOfDay;
} {
  const theme = useTheme();
  const dark = theme.name === 'dark';
  const homeLocation = usePreferences((state) => state.homeLocation);
  const tripAtmosphere = useTravelAtmosphere();
  const { weather: homeWeather } = useHomeWeather();
  const homeLabel = homeLocation.trim();
  const places = useMemo(
    () => mergeAtmospherePlaces(tripDestinations, homeLabel || undefined),
    [homeLabel, tripDestinations],
  );
  const placesKey = places.join('|');
  const hasTripPlaces = tripDestinations.some((label) => label.trim().length >= 2);
  // Prefer destination weather/time when trips exist; otherwise home conditions.
  const timeOfDay = hasTripPlaces
    ? tripAtmosphere.timeOfDay
    : travelTimeOfDay(new Date(), homeWeather?.timezone);
  const weatherCode = hasTripPlaces
    ? tripAtmosphere.weatherCode
    : homeWeather?.weatherCode;
  const mode = places.length > 0 ? 'trip' : 'home';

  const initial = useMemo(
    () =>
      pickCuratedTravelHomeAtmosphere(
        timeOfDay,
        weatherCode,
        [],
        dark ? 1 : 0,
      ),
    // Immediate paint only — live resolve replaces on focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dark],
  );

  const [image, setImage] = useState<TravelHomeAtmosphereImage>(initial);
  const requestId = useRef(0);

  const skyColor =
    timeOfDay === 'night' || travelWeatherMood(weatherCode) === 'storm'
      ? travelHomeTokens.colors.atmosphereNight
      : dark
        ? travelHomeTokens.colors.atmosphereNight
        : travelHomeTokens.colors.atmosphereSky;

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      const id = ++requestId.current;
      const salt = Date.now() + id;
      let cancelled = false;

      void (async () => {
        const recentKeys = await loadRecentKeys();
        if (cancelled || requestId.current !== id) return;

        // Place-matched curated first so the band never flashes empty / unlabeled
        // while remote covers resolve — web plate replaces this when ready.
        const place = pickAtmosphereDestination(places, recentKeys, salt);
        const immediate =
          (place
            ? pickCuratedTravelHomeAtmosphereForPlace(
                place,
                timeOfDay,
                weatherCode,
                recentKeys,
                salt,
              )
            : undefined) ??
          pickCuratedTravelHomeAtmosphere(
            timeOfDay,
            weatherCode,
            recentKeys,
            salt,
          );
        setImage(
          place
            ? {
                ...immediate,
                destinationKey: atmosphereDestinationKey(place),
                label: immediate.label ?? place,
              }
            : immediate,
        );

        const resolved = await resolveTravelHomeAtmosphereImage({
          mode,
          timeOfDay,
          weatherCode,
          destinations: tripDestinations,
          homeLabel: homeLabel || undefined,
          recentKeys,
          salt: salt + 17,
        });
        if (cancelled || requestId.current !== id) return;

        setImage(resolved);
        let nextRecent = rememberRecentKeys(recentKeys, resolved.key, RECENT_LIMIT);
        if (resolved.destinationKey) {
          nextRecent = rememberRecentKeys(
            nextRecent,
            resolved.destinationKey,
            RECENT_LIMIT,
          );
        }
        void saveRecentKeys(nextRecent);
      })();

      return () => {
        cancelled = true;
      };
    }, [
      enabled,
      homeLabel,
      mode,
      placesKey,
      timeOfDay,
      tripDestinations,
      weatherCode,
    ]),
  );

  const headerInk = resolveAtmosphereHeaderInk({
    themeDark: dark,
    averageColor: image.averageColor,
    curatedTone: image.curatedHeaderTone,
  });

  return {
    source: image.source,
    skyColor,
    origin: image.origin,
    label: image.label,
    headerInk,
    /** Dominant plate color for solo-trip card lift / header ink. */
    averageColor: image.averageColor,
    /** Local time-of-day used for the plate (drives night moon overlay). */
    timeOfDay,
  };
}
