import { useMemo, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useSafeAreaChrome,
  useSafeAreaChromeOverlay,
} from '@/components/primitives';
import { travelHomeAtmosphereHeaderScrimColors } from '@/features/travel/travel-home-atmosphere-ink';
import {
  TravelHomeAtmosphereScrim,
  travelHomeAtmosphereScrimHeight,
} from '@/features/travel/travel-home-atmosphere-scrim';
import {
  TRAVEL_HOME_MAP_AVERAGE_COLOR,
  TRAVEL_HOME_MAP_BACKGROUND,
  TRAVEL_HOME_MAP_SKY_COLOR,
  travelHomeAtmosphereHeight,
} from '@/features/travel/travel-home-background';
import { travelHomeTokens } from '@/features/travel/travel-home-tokens';
import type { TravelPlan } from '@/features/travel/types';
import { useTheme } from '@/hooks/use-theme';

const TRAVEL_HOME_MAP_IMAGE = {
  source: TRAVEL_HOME_MAP_BACKGROUND,
  skyColor: TRAVEL_HOME_MAP_SKY_COLOR,
  origin: 'curated',
  label: undefined,
  headerInk: 'dark',
  averageColor: TRAVEL_HOME_MAP_AVERAGE_COLOR,
  timeOfDay: 'day',
} as const;

export function useTravelHomeAtmosphereChrome(args: {
  sortedPlans: TravelPlan[];
  launcherPlans: TravelPlan[];
}): {
  atmosphereImage: typeof TRAVEL_HOME_MAP_IMAGE;
  hasNoTrips: boolean;
  atmosphereHeight: number;
  atmosphereHeaderInk: 'light' | 'dark';
  atmosphereScrim: ReactNode;
  atmosphereScrimHeight: number;
} {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { launcherPlans } = args;
  const atmosphereImage = TRAVEL_HOME_MAP_IMAGE;

  const hasNoTrips = launcherPlans.length === 0;
  const atmosphereHeight = travelHomeAtmosphereHeight(windowHeight, insets.top, {
    empty: hasNoTrips,
  });
  // Dark theme keeps white header ink; match the header’s effective tone.
  const atmosphereHeaderInk =
    theme.name === 'dark' ? 'light' : atmosphereImage.headerInk;
  const atmosphereScrim = useMemo(() => {
    if (
      !travelHomeAtmosphereHeaderScrimColors(
        atmosphereHeaderInk,
        atmosphereImage.averageColor,
      )
    ) {
      return undefined;
    }
    return (
      <TravelHomeAtmosphereScrim
        headerInk={atmosphereHeaderInk}
        averageColor={atmosphereImage.averageColor}
      />
    );
  }, [atmosphereHeaderInk, atmosphereImage.averageColor]);
  const atmosphereScrimHeight = travelHomeAtmosphereScrimHeight(insets.top);

  // Paint the map on app-shell chrome so it fills the status-bar band
  // (in-screen absolute layers are clipped by SafeAreaView and can't).
  // Full-window atlas — including the status bar and content below the cards.
  // priority: 1 — nested travel stack layout also registers chrome at 0 and
  // would otherwise stomp this image after the child focus effect.
  useSafeAreaChrome(atmosphereImage.skyColor, {
    backgroundImage: atmosphereImage.source,
    backgroundImageHeight: atmosphereHeight,
    backgroundImageBlurRadius: travelHomeTokens.sizes.heroBlurRadius,
    priority: 1,
  });
  // Soft contrast veil behind status-bar chrome + Travel title/tagline.
  useSafeAreaChromeOverlay(atmosphereScrim, atmosphereScrimHeight, {
    priority: 1,
  });

  return {
    atmosphereImage,
    hasNoTrips,
    atmosphereHeight,
    atmosphereHeaderInk,
    atmosphereScrim,
    atmosphereScrimHeight,
  };
}
