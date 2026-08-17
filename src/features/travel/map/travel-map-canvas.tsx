import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
    ReduceMotion,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import { easings, motion } from '@/design-system';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';

import type { TravelMapCity } from './city-data';
import { atlasCountryByCode, type AtlasCountry } from './country-data';
import {
    TRAVEL_GLOBE_INITIAL_ROTATION,
    travelGlobeRotationForCoordinate,
    type TravelGlobeRotation,
} from './globe-projection';
import {
    travelMapCountryClusters,
    type TravelMapPlaceSelection,
    type TravelMapRenderedVisit,
} from './model';
import {
    TRAVEL_MAP_COUNTRY_OCEAN_TOP,
    TravelMapCountryView,
} from './travel-map-country-view';
import { TravelMapWorldFlat } from './travel-map-world-flat';
import { TravelMapWorldGlobe } from './travel-map-world-globe';

export { TRAVEL_MAP_COUNTRY_OCEAN_TOP };
export type { TravelMapPlaceSelection };

type Props = {
  renderedVisits: TravelMapRenderedVisit[];
  selectedCountryCode?: string;
  selectedPinId?: string;
  highlightedCity?: TravelMapCity;
  initialGlobeCoordinate?: { latitude: number; longitude: number };
  placing?: boolean;
  worldMotionPaused?: boolean;
  onCountryPress: (countryCode: string) => void;
  onPlacePress: (selection: TravelMapPlaceSelection) => void;
  onCoordinatePress?: (coordinate: { latitude: number; longitude: number }) => void;
};

/** World ↔ country dive: crossfade + camera push, both layers held to settle. */
const STAGE_TIMING = {
  duration: motion.page,
  easing: easings.standard,
  reduceMotion: ReduceMotion.System,
} as const;

export const TravelMapCanvas = memo(function TravelMapCanvas({
  renderedVisits,
  selectedCountryCode,
  selectedPinId,
  highlightedCity,
  initialGlobeCoordinate,
  placing = false,
  worldMotionPaused = false,
  onCountryPress,
  onPlacePress,
  onCoordinatePress,
}: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const landscape = windowWidth > windowHeight;
  const selectedCountry = atlasCountryByCode(selectedCountryCode);
  const [worldAutoRotate, setWorldAutoRotate] = useState(true);
  const [worldRotation, setWorldRotation] = useState<TravelGlobeRotation>(
    TRAVEL_GLOBE_INITIAL_ROTATION,
  );
  const clusters = useMemo(
    () => travelMapCountryClusters(renderedVisits),
    [renderedVisits],
  );

  // Both stage shells stay mounted for the life of the canvas; the dive only
  // interpolates opacity/scale and swaps content *inside* the country shell.
  // Mounting or unmounting a GestureDetector mid-transition trips an RNGH v3
  // native assert ("more than one child view while handlers are attached").
  const [stageCountry, setStageCountry] = useState<AtlasCountry>();
  const countryTransition = useSharedValue(0);

  // Portrait globe ↔ landscape flat map crossfade. Both variants stay mounted
  // (the globe carries a GestureDetector, so it must never churn mid-rotation);
  // the parked variant is display-culled once the fade settles. Starts at the
  // current orientation so page open stays at rest.
  const orientation = useSharedValue(landscape ? 1 : 0);

  // The hidden flat world (~235 SVG paths) is off the open critical path: it
  // mounts once after the page transition settles — or immediately when a
  // rotation demands it — and never unmounts. Safe to late-mount because the
  // flat map carries no GestureDetector (the globe still mounts at first
  // commit, keeping every detector mount atomic).
  const [flatStagePrepared, setFlatStagePrepared] = useState(landscape);

  useEffect(() => {
    if (flatStagePrepared) return;
    if (landscape) {
      setFlatStagePrepared(true);
      return;
    }
    return deferAfterPageTransition(() => setFlatStagePrepared(true));
  }, [flatStagePrepared, landscape]);

  const flatStageReady = flatStagePrepared || landscape;

  useEffect(() => {
    orientation.value = withTiming(landscape ? 1 : 0, STAGE_TIMING);
  }, [landscape, orientation]);

  const globeLayerStyle = useAnimatedStyle(() => ({
    opacity: 1 - orientation.value,
    display: orientation.value >= 1 ? ('none' as const) : ('flex' as const),
  }));
  const flatLayerStyle = useAnimatedStyle(() => ({
    opacity: orientation.value,
    display: orientation.value <= 0 ? ('none' as const) : ('flex' as const),
  }));

  useEffect(() => {
    if (selectedCountry) {
      setStageCountry(selectedCountry);
      countryTransition.value = withTiming(1, STAGE_TIMING);
    } else {
      countryTransition.value = withTiming(0, STAGE_TIMING, (finished) => {
        if (finished) runOnJS(setStageCountry)(undefined);
      });
    }
  }, [countryTransition, selectedCountry]);

  const worldStageStyle = useAnimatedStyle(() => ({
    opacity: 1 - countryTransition.value,
    transform: [{ scale: 1 + 0.16 * countryTransition.value }],
    // Fully parked world costs nothing while the country map is open.
    display: countryTransition.value >= 1 ? ('none' as const) : ('flex' as const),
  }));
  const countryStageStyle = useAnimatedStyle(() => ({
    opacity: countryTransition.value,
    transform: [{ scale: 1.1 - 0.1 * countryTransition.value }],
  }));

  useEffect(() => {
    if (!initialGlobeCoordinate || !worldAutoRotate) return;
    setWorldRotation(
      travelGlobeRotationForCoordinate(
        initialGlobeCoordinate.longitude,
        initialGlobeCoordinate.latitude,
      ),
    );
  }, [initialGlobeCoordinate, worldAutoRotate]);

  const stopWorldAutoRotation = useCallback(() => {
    setWorldAutoRotate(false);
  }, []);

  // The globe idles only while it is the visible, interactive world layer.
  const globeMotionEnabled =
    worldAutoRotate && !worldMotionPaused && !selectedCountry && !landscape;

  const stageCountryCode = stageCountry?.code;
  const stagePlaces = useMemo<TravelMapPlaceSelection[]>(
    () =>
      stageCountryCode
        ? renderedVisits.flatMap((rendered) =>
            rendered.visit.countryCode !== stageCountryCode
              ? []
              : rendered.visit.places.map((pin) => ({ rendered, pin })),
          )
        : [],
    [renderedVisits, stageCountryCode],
  );

  return (
    <View style={styles.root}>
      <Animated.View
        pointerEvents={selectedCountry ? 'none' : 'auto'}
        style={[StyleSheet.absoluteFill, worldStageStyle]}
      >
        <Animated.View
          pointerEvents={landscape ? 'none' : 'auto'}
          style={[StyleSheet.absoluteFill, globeLayerStyle]}
        >
          <TravelMapWorldGlobe
            autoRotate={globeMotionEnabled}
            clusters={clusters}
            onCountryPress={onCountryPress}
            onInteract={stopWorldAutoRotation}
            onRotationChange={setWorldRotation}
            rotation={worldRotation}
          />
        </Animated.View>
        <Animated.View
          pointerEvents={landscape ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFill, flatLayerStyle]}
        >
          {flatStageReady ? (
            <TravelMapWorldFlat
              clusters={clusters}
              onCountryPress={onCountryPress}
            />
          ) : null}
        </Animated.View>
      </Animated.View>

      <Animated.View
        pointerEvents={selectedCountry ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, countryStageStyle]}
      >
        <TravelMapCountryView
          country={stageCountry}
          active={Boolean(selectedCountry)}
          places={stagePlaces}
          selectedPinId={selectedPinId}
          highlightedCity={highlightedCity}
          placing={placing}
          onPlacePress={onPlacePress}
          onCoordinatePress={onCoordinatePress}
        />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 240,
    overflow: 'hidden',
  },
});
