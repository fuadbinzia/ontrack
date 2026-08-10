import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import type { TravelTimeOfDay } from '@/features/travel/travel-atmosphere-model';
import {
    headerSkyChromeColor,
    resolveHeaderSkyCondition,
} from '@/features/travel/travel-sky-condition';
import { TravelSkyDay } from '@/features/travel/travel-sky-day';
import { TravelSkyGround } from '@/features/travel/travel-sky-ground';
import { resolveTravelSkyGroundKind } from '@/features/travel/travel-sky-ground-kind';
import { TravelSkyNight } from '@/features/travel/travel-sky-night';
import { SKY_VIEW_H } from '@/features/travel/travel-sky-plate';
import { useTiltSkyMotion } from '@/features/travel/use-tilt-sky-motion';
import { useTravelSkyQuality } from '@/features/travel/use-travel-sky-quality';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

/**
 * Theme + weather sky for itinerary headers.
 * Painted once on app-shell chrome (status bar + header) so aurora / day washes
 * stay continuous behind the clock. `headerSkyChromeColor` is the solid underlay.
 *
 * Always the live SVG plate (day/night + ground). `full` devices get motion FX;
 * non-`full` tiers paint the same artwork frozen (minimal FX) — not a photo still.
 *
 * @param statusBandRatio Fraction of the plate reserved for the status-bar band
 *   (celestial discs stay below the clock / Dynamic Island).
 * @param fadeTo Light/dark page base color for the short horizon dissolve.
 */
export function TravelHeaderSkyDecor({
  statusBandRatio = 0.35,
  destination = '',
  dateKey = '',
  latitude,
  longitude,
  timeOfDay,
  weatherCode,
  timezone,
  /** Light/dark page base — sky art eases into this at the horizon. */
  fadeTo,
}: {
  statusBandRatio?: number;
  destination?: string;
  dateKey?: string;
  latitude?: number;
  longitude?: number;
  timeOfDay?: TravelTimeOfDay;
  weatherCode?: number;
  timezone?: string;
  fadeTo?: string;
} = {}) {
  const theme = useTheme();
  const dark = theme.name === 'dark';
  const plan = useTravelSkyQuality();
  const motion = useTiltSkyMotion(plan.tilt);
  const statusBand = Math.max(0, Math.min(0.55, statusBandRatio)) * SKY_VIEW_H;
  const condition = resolveHeaderSkyCondition({
    themeDark: dark,
    timeOfDay,
    weatherCode,
    timezone,
    destination,
    latitude,
  });
  const night =
    dark ||
    condition.look.startsWith('night') ||
    condition.timeOfDay === 'night';
  const chrome = headerSkyChromeColor({
    themeDark: dark,
    look: condition.look,
    destination,
  });
  const horizon = fadeTo ?? chrome;
  const groundKind = resolveTravelSkyGroundKind(destination, latitude);

  return (
    <AgentTestId
      testID={AgentUiIds.travel.chrome.skyDecor}
      style={styles.host}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.fill}>
        {night ? (
          <TravelSkyNight
            condition={condition}
            destination={destination}
            dateKey={dateKey}
            latitude={latitude}
            longitude={longitude}
            statusBand={statusBand}
            motion={motion}
            fx={plan}
          />
        ) : (
          <TravelSkyDay
            condition={condition}
            statusBand={statusBand}
            motion={motion}
            fx={plan}
          />
        )}
        {plan.ground ? (
          <TravelSkyGround kind={groundKind} night={night} motion={motion} />
        ) : null}
        {/*
          Short horizon dissolve into the theme base — not a sky wash down
          the page. Ground foot eases into paper just below the dates card.
        */}
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', 'transparent', horizon]}
          // Keep the ground floor solid until the date-card seam.
          locations={[0.88, 0.96, 1]}
          style={styles.bottomFade}
        />
      </View>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
  },
  fill: {
    ...StyleSheet.absoluteFill,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '14%',
  },
});
