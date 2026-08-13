import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Pattern,
  Rect,
  Stop,
} from 'react-native-svg';

import { AppText } from '@/components/primitives';
import { motion } from '@/design-system';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

import {
  ATLAS_COUNTRIES,
  TRAVEL_MAP_INK,
  TRAVEL_MAP_LAND_COLORS,
  TRAVEL_MAP_OCEAN_BOTTOM,
  TRAVEL_MAP_OCEAN_MIDDLE,
  TRAVEL_MAP_OCEAN_TOP,
  TRAVEL_MAP_VIEWBOX,
  atlasCountryContainsCoordinate,
  atlasCountryByCode,
  atlasCountryDetail,
  countryViewBox,
  invertTravelCoordinate,
  projectTravelCoordinate,
  travelMapStrokeWidth,
} from './country-data';
import { atlasCitiesForCountry, type TravelMapCity } from './city-data';
import {
  TRAVEL_GLOBE_INITIAL_ROTATION,
  travelGlobeRotationForCoordinate,
  type TravelGlobeRotation,
} from './globe-projection';
import {
  travelMapCountryClusters,
  type TravelMapRenderedVisit,
} from './model';
import { TravelMapPinButton } from './travel-map-pin-button';
import { TravelMapWorldFlat } from './travel-map-world-flat';
import { TravelMapWorldGlobe } from './travel-map-world-globe';
import type { TravelMapPlacePin } from './types';

type ViewBox = { x: number; y: number; width: number; height: number };
type Layout = { width: number; height: number };

export const TRAVEL_MAP_COUNTRY_OCEAN_TOP = TRAVEL_MAP_OCEAN_TOP;

export interface TravelMapPlaceSelection {
  rendered: TravelMapRenderedVisit;
  pin: TravelMapPlacePin;
}

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

function pointInLayout(
  point: [number, number],
  viewBox: ViewBox,
  layout: Layout,
): { left: number; top: number } {
  const scale = Math.min(layout.width / viewBox.width, layout.height / viewBox.height);
  const paintedWidth = viewBox.width * scale;
  const paintedHeight = viewBox.height * scale;
  return {
    left: (layout.width - paintedWidth) / 2 + (point[0] - viewBox.x) * scale,
    top: (layout.height - paintedHeight) / 2 + (point[1] - viewBox.y) * scale,
  };
}

function layoutToPoint(
  location: { x: number; y: number },
  viewBox: ViewBox,
  layout: Layout,
): [number, number] | undefined {
  const scale = Math.min(layout.width / viewBox.width, layout.height / viewBox.height);
  const paintedWidth = viewBox.width * scale;
  const paintedHeight = viewBox.height * scale;
  const offsetX = (layout.width - paintedWidth) / 2;
  const offsetY = (layout.height - paintedHeight) / 2;
  if (
    location.x < offsetX ||
    location.y < offsetY ||
    location.x > offsetX + paintedWidth ||
    location.y > offsetY + paintedHeight
  ) {
    return undefined;
  }
  return [
    viewBox.x + (location.x - offsetX) / scale,
    viewBox.y + (location.y - offsetY) / scale,
  ];
}

export function TravelMapCanvas({
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
  const selectedCountryDetail = useMemo(
    () => selectedCountry ? atlasCountryDetail(selectedCountry) : undefined,
    [selectedCountry],
  );
  const viewBox = useMemo<ViewBox>(
    () =>
      selectedCountry
        ? countryViewBox(selectedCountry, windowWidth / Math.max(1, windowHeight))
        : { x: 0, y: 0, ...TRAVEL_MAP_VIEWBOX },
    [selectedCountry, windowHeight, windowWidth],
  );
  const [layout, setLayout] = useState<Layout>({ width: 1, height: 1 });
  const [worldAutoRotate, setWorldAutoRotate] = useState(true);
  const [worldRotation, setWorldRotation] = useState<TravelGlobeRotation>(
    TRAVEL_GLOBE_INITIAL_ROTATION,
  );
  const clusters = useMemo(
    () => travelMapCountryClusters(renderedVisits),
    [renderedVisits],
  );

  const placeAtLayoutPoint = useCallback((x: number, y: number) => {
    const point = layoutToPoint({ x, y }, viewBox, layout);
    if (!point) return;
    const coordinate = invertTravelCoordinate(point[0], point[1]);
    if (coordinate) onCoordinatePress?.(coordinate);
  }, [layout, onCoordinatePress, viewBox]);
  const mapTapAgent = useAgentUiTarget(
    selectedCountry ? AgentUiIds.travel.map.pinMapTarget : undefined,
    {
      label: 'Tap the country map to pin this location',
      onPress: selectedCountry
        ? () => placeAtLayoutPoint(layout.width / 2, layout.height / 2)
        : undefined,
    },
  );

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  useEffect(() => {
    scale.value = withTiming(1, { duration: motion.page });
    translateX.value = withTiming(0, { duration: motion.page });
    translateY.value = withTiming(0, { duration: motion.page });
  }, [highlightedCity?.name, placing, scale, selectedCountryCode, translateX, translateY]);

  const pan = Gesture.Pan()
    .enabled(Boolean(selectedCountry) && !placing)
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    });
  const pinch = Gesture.Pinch()
    .enabled(Boolean(selectedCountry) && !placing)
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(4, startScale.value * event.scale));
    });
  const mapGesture = Gesture.Simultaneous(pan, pinch);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const updateLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

  const stopWorldAutoRotation = useCallback(() => {
    setWorldAutoRotate(false);
  }, []);

  useEffect(() => {
    if (!initialGlobeCoordinate || !worldAutoRotate) return;
    setWorldRotation(
      travelGlobeRotationForCoordinate(
        initialGlobeCoordinate.longitude,
        initialGlobeCoordinate.latitude,
      ),
    );
  }, [initialGlobeCoordinate, worldAutoRotate]);

  const countryPlaces = selectedCountryCode
    ? renderedVisits.flatMap((rendered) =>
        rendered.visit.countryCode !== selectedCountryCode
          ? []
          : rendered.visit.places.map((pin) => ({ rendered, pin })),
      )
    : [];
  const cityMarkers = useMemo(() => {
    if (!selectedCountryCode) return [];
    const occupied: { left: number; top: number }[] = [];
    const countryCities = atlasCitiesForCountry(selectedCountryCode);
    const orderedCities = highlightedCity
      ? [
          highlightedCity,
          ...countryCities.filter((city) => city.name !== highlightedCity.name),
        ]
      : countryCities;
    return orderedCities.flatMap((city) => {
      if (!atlasCountryContainsCoordinate(
        selectedCountryCode,
        city.latitude,
        city.longitude,
      )) return [];
      const projected = projectTravelCoordinate(city.latitude, city.longitude);
      if (!projected) return [];
      const position = pointInLayout(projected, viewBox, layout);
      const overlaps = occupied.some(
        (placed) => Math.abs(placed.left - position.left) < 60 && Math.abs(placed.top - position.top) < 18,
      );
      if (overlaps) return [];
      occupied.push(position);
      return [{
        city,
        position,
        highlighted: city.name === highlightedCity?.name,
      }];
    });
  }, [highlightedCity, layout, selectedCountryCode, viewBox]);
  const selectedBorderWidth = travelMapStrokeWidth(viewBox, layout, 3);
  const mapUnit = travelMapStrokeWidth(viewBox, layout, 1);

  return (
    <View style={styles.root} onLayout={updateLayout}>
      {selectedCountry ? (
        <GestureDetector gesture={mapGesture}>
          <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
            <Svg
              width="100%"
              height="100%"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
              preserveAspectRatio="xMidYMid meet">
              <Defs>
                <LinearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={TRAVEL_MAP_COUNTRY_OCEAN_TOP} />
                  <Stop offset="0.55" stopColor={TRAVEL_MAP_OCEAN_MIDDLE} />
                  <Stop offset="1" stopColor={TRAVEL_MAP_OCEAN_BOTTOM} />
                </LinearGradient>
                <Pattern
                  id="paper"
                  width={24 * mapUnit}
                  height={24 * mapUnit}
                  patternUnits="userSpaceOnUse">
                  <Circle cx={4 * mapUnit} cy={6 * mapUnit} r={1.4 * mapUnit} fill="rgba(255,255,255,0.16)" />
                  <Circle cx={18 * mapUnit} cy={17 * mapUnit} r={mapUnit} fill="rgba(9,71,111,0.09)" />
                </Pattern>
              </Defs>
              <Rect
                x={viewBox.x}
                y={viewBox.y}
                width={viewBox.width}
                height={viewBox.height}
                fill="url(#ocean)"
              />
              <Rect
                x={viewBox.x}
                y={viewBox.y}
                width={viewBox.width}
                height={viewBox.height}
                fill="url(#paper)"
              />
              <Path
                d="M35 120 C180 70 300 155 430 102 S700 54 950 130"
                stroke="rgba(239,253,249,0.36)"
                strokeWidth={2.5 * mapUnit}
                strokeDasharray={`${10 * mapUnit} ${12 * mapUnit}`}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d="M70 410 C250 345 335 462 500 398 S780 322 930 420"
                stroke="rgba(14,78,105,0.24)"
                strokeWidth={2.5 * mapUnit}
                strokeDasharray={`${9 * mapUnit} ${13 * mapUnit}`}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={selectedCountryDetail?.path ?? selectedCountry.path}
                fill={TRAVEL_MAP_INK}
                opacity="0.22"
                transform={`translate(${4 * mapUnit} ${5 * mapUnit})`}
                pointerEvents="none"
              />
              <Path
                d={selectedCountryDetail?.path ?? selectedCountry.path}
                fill={
                  TRAVEL_MAP_LAND_COLORS[
                    ATLAS_COUNTRIES.indexOf(selectedCountry) % TRAVEL_MAP_LAND_COLORS.length
                  ]
                }
                stroke={TRAVEL_MAP_INK}
                strokeOpacity="0.94"
                strokeWidth={selectedBorderWidth}
                strokeLinejoin="round"
              />
            </Svg>

            <Pressable
              ref={mapTapAgent.ref}
              testID={mapTapAgent.testID}
              onLayout={mapTapAgent.onLayout}
              accessibilityRole="button"
              accessibilityLabel="Tap the country map to pin this location"
              onPress={(event) => {
                placeAtLayoutPoint(
                  event.nativeEvent.locationX,
                  event.nativeEvent.locationY,
                );
              }}
              style={StyleSheet.absoluteFill}
            />

            <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
              {cityMarkers.map(({ city, highlighted, position }) => {
                const alignRight = position.left > layout.width * 0.72;
                return (
                  <View
                    key={`${city.countryCode}:${city.name}`}
                    pointerEvents="none"
                    style={[
                      styles.cityMarker,
                      alignRight
                        ? { right: layout.width - position.left, top: position.top, flexDirection: 'row-reverse' }
                        : { left: position.left, top: position.top },
                    ]}>
                    <View
                      style={[
                        styles.cityDot,
                        city.capital && styles.capitalDot,
                        highlighted && styles.highlightedCityDot,
                      ]}
                    />
                    <AppText
                      variant="caption"
                      color={highlighted ? 'accent' : undefined}
                      numberOfLines={1}
                      style={[
                        styles.cityName,
                        highlighted && styles.highlightedCityName,
                        alignRight && styles.cityNameRight,
                      ]}>
                      {city.name}
                    </AppText>
                  </View>
                );
              })}
              {countryPlaces.map(({ rendered, pin }, index) => {
                const projected = projectTravelCoordinate(pin.latitude, pin.longitude);
                if (!projected) return null;
                const position = pointInLayout(projected, viewBox, layout);
                const offset = (index % 3) * 4 - 4;
                return (
                  <TravelMapPinButton
                    key={`${rendered.person.userId}:${pin.id}`}
                    testID={AgentUiIds.travel.map.place(pin.id)}
                    label={`${pin.label}, ${rendered.person.displayName}`}
                    colors={[rendered.person.color]}
                    selected={pin.id === selectedPinId}
                    left={position.left + offset}
                    top={position.top - offset}
                    onPress={() => onPlacePress({ rendered, pin })}
                  />
                );
              })}
            </View>
          </Animated.View>
        </GestureDetector>
      ) : landscape ? (
        <TravelMapWorldFlat
          clusters={clusters}
          onCountryPress={onCountryPress}
        />
      ) : (
        <TravelMapWorldGlobe
          autoRotate={worldAutoRotate && !worldMotionPaused}
          clusters={clusters}
          onCountryPress={onCountryPress}
          onInteract={stopWorldAutoRotation}
          onRotationChange={setWorldRotation}
          rotation={worldRotation}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 240,
    overflow: 'hidden',
  },
  cityMarker: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    transform: [{ translateY: -5 }],
  },
  cityDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFF4C2',
    borderWidth: 1.5,
    borderColor: TRAVEL_MAP_INK,
  },
  capitalDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F17868',
  },
  highlightedCityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: '#FFF4C2',
  },
  highlightedCityName: {
    fontWeight: '700',
  },
  cityName: {
    color: TRAVEL_MAP_INK,
    fontWeight: '600',
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cityNameRight: { textAlign: 'right' },
});
