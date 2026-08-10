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
import { travelHomeAtmosphereHeight } from '@/features/travel/travel-home-background';
import { travelHomeTokens } from '@/features/travel/travel-home-tokens';
import type { TravelPlan } from '@/features/travel/types';
import { useTravelHomeAtmosphereImage } from '@/features/travel/use-travel-home-atmosphere-image';
import { useTheme } from '@/hooks/use-theme';

export function useTravelHomeAtmosphereChrome(args: {
  sortedPlans: TravelPlan[];
  launcherPlans: TravelPlan[];
}): {
  atmosphereImage: ReturnType<typeof useTravelHomeAtmosphereImage>;
  hasNoTrips: boolean;
  atmosphereHeight: number;
  atmosphereHeaderInk: 'light' | 'dark';
  atmosphereScrim: ReactNode;
  atmosphereScrimHeight: number;
} {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { sortedPlans, launcherPlans } = args;

  const atmosphereDestinations = useMemo(
    () =>
      sortedPlans
        .map((plan) => plan.destination?.trim() || plan.title?.trim() || '')
        .filter((label) => label.length >= 2),
    [sortedPlans],
  );

  const atmosphereImage = useTravelHomeAtmosphereImage({
    enabled: true,
    tripDestinations: atmosphereDestinations,
  });

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

  // Paint atmosphere on the app-shell chrome so it fills the status-bar band
  // (in-screen absolute layers are clipped by SafeAreaView and can't).
  // Hero band only — mock fades into paper before Your Trips (not full-page).
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
