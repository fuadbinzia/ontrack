import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import {
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View,
    type LayoutChangeEvent,
    type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    ReduceMotion,
    useAnimatedStyle,
    useSharedValue,
    withDecay,
    withTiming,
    type AnimatedStyle,
    type SharedValue,
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
import { easings, motion } from '@/design-system';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';

import { atlasCitiesForCountry, type TravelMapCity } from './city-data';
import {
    ATLAS_COUNTRIES,
    atlasCountryContainsCoordinate,
    atlasCountryDetail,
    countryViewBox,
    invertTravelCoordinate,
    projectTravelCoordinate,
    TRAVEL_MAP_INK,
    TRAVEL_MAP_LAND_COLORS,
    TRAVEL_MAP_OCEAN_BOTTOM,
    TRAVEL_MAP_OCEAN_MIDDLE,
    TRAVEL_MAP_OCEAN_TOP,
    travelMapStrokeWidth,
    type AtlasCountry,
} from './country-data';
import type { TravelMapPlaceSelection } from './model';
import { isDrawableSvgPath } from './svg-path';
import {
    clampCountryZoomScale,
    clampZoomTranslate,
    countryMarkerShift,
    countryZoomTranslateBound,
    pinchFocalTranslate,
    rubberBandZoomTranslate,
} from './travel-map-country-zoom';
import { TravelMapPinButton } from './travel-map-pin-button';

type ViewBox = { x: number; y: number; width: number; height: number };
type Layout = { width: number; height: number };

export const TRAVEL_MAP_COUNTRY_OCEAN_TOP = TRAVEL_MAP_OCEAN_TOP;

const RECENTER_TIMING = {
  duration: motion.page,
  easing: easings.standard,
  reduceMotion: ReduceMotion.System,
} as const;
const SETTLE_TIMING = {
  duration: motion.fade,
  easing: easings.standard,
} as const;

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

/**
 * Markers ride outside the zoomed layer and follow it via UI-thread shifts,
 * so pins and labels stay crisp and constant-size while the map scales.
 */
function CountryMarker({
  baseLeft,
  baseTop,
  layout,
  scale,
  translateX,
  translateY,
  children,
}: {
  baseLeft: number;
  baseTop: number;
  layout: Layout;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  children: ReactNode;
}) {
  const centerX = layout.width / 2;
  const centerY = layout.height / 2;
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: countryMarkerShift(
          baseLeft,
          centerX,
          scale.value,
          translateX.value,
        ),
      },
      {
        translateY: countryMarkerShift(
          baseTop,
          centerY,
          scale.value,
          translateY.value,
        ),
      },
    ],
  }));
  return (
    <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * Everything specific to the staged country. Mounts and unmounts as a
 * grandchild of the gesture detector's child, so the detector's own native
 * child never churns (RNGH v3 aborts when a detector gains a second subview
 * while recognizers are attached — see travel-map-detector-stability tests).
 */
function CountryStageContent({
  country,
  layout,
  scale,
  translateX,
  translateY,
  mapTransformStyle,
  places,
  selectedPinId,
  highlightedCity,
  onPlacePress,
  onCoordinatePress,
}: {
  country: AtlasCountry;
  layout: Layout;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  mapTransformStyle: AnimatedStyle<ViewStyle>;
  places: TravelMapPlaceSelection[];
  selectedPinId?: string;
  highlightedCity?: TravelMapCity;
  onPlacePress: (selection: TravelMapPlaceSelection) => void;
  onCoordinatePress?: (coordinate: { latitude: number; longitude: number }) => void;
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const countryDetail = useMemo(() => atlasCountryDetail(country), [country]);
  const viewBox = useMemo<ViewBox>(
    () => countryViewBox(country, windowWidth / Math.max(1, windowHeight)),
    [country, windowHeight, windowWidth],
  );

  const placeAtLayoutPoint = useCallback(
    (x: number, y: number) => {
      const point = layoutToPoint({ x, y }, viewBox, layout);
      if (!point) return;
      const coordinate = invertTravelCoordinate(point[0], point[1]);
      if (coordinate) onCoordinatePress?.(coordinate);
    },
    [layout, onCoordinatePress, viewBox],
  );
  const mapTapAgent = useAgentUiTarget(AgentUiIds.travel.map.pinMapTarget, {
    label: 'Tap the country map to pin this location',
    onPress: () => placeAtLayoutPoint(layout.width / 2, layout.height / 2),
  });

  const cityMarkers = useMemo(() => {
    const occupied: { left: number; top: number }[] = [];
    const countryCities = atlasCitiesForCountry(country.code);
    const orderedCities = highlightedCity
      ? [
          highlightedCity,
          ...countryCities.filter((city) => city.name !== highlightedCity.name),
        ]
      : countryCities;
    return orderedCities.flatMap((city) => {
      if (!atlasCountryContainsCoordinate(
        country.code,
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
  }, [country.code, highlightedCity, layout, viewBox]);
  const selectedBorderWidth = travelMapStrokeWidth(viewBox, layout, 3);
  const mapUnit = travelMapStrokeWidth(viewBox, layout, 1);

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, mapTransformStyle]}>
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
          {isDrawableSvgPath(countryDetail.path) ? (
            <Path
              d={countryDetail.path}
              fill={TRAVEL_MAP_INK}
              opacity="0.22"
              transform={`translate(${4 * mapUnit} ${5 * mapUnit})`}
              pointerEvents="none"
            />
          ) : null}
          {isDrawableSvgPath(countryDetail.path) ? (
            <Path
              d={countryDetail.path}
              fill={
                TRAVEL_MAP_LAND_COLORS[
                  ATLAS_COUNTRIES.indexOf(country) % TRAVEL_MAP_LAND_COLORS.length
                ]
              }
              stroke={TRAVEL_MAP_INK}
              strokeOpacity="0.94"
              strokeWidth={selectedBorderWidth}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ) : null}
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
      </Animated.View>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {cityMarkers.map(({ city, highlighted, position }) => {
          const alignRight = position.left > layout.width * 0.72;
          return (
            <CountryMarker
              key={`${city.countryCode}:${city.name}`}
              baseLeft={position.left}
              baseTop={position.top}
              layout={layout}
              scale={scale}
              translateX={translateX}
              translateY={translateY}
            >
              <View
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
            </CountryMarker>
          );
        })}
        {places.map(({ rendered, pin }, index) => {
          const projected = projectTravelCoordinate(pin.latitude, pin.longitude);
          if (!projected) return null;
          const position = pointInLayout(projected, viewBox, layout);
          const offset = (index % 3) * 4 - 4;
          return (
            <CountryMarker
              key={`${rendered.person.userId}:${pin.id}`}
              baseLeft={position.left + offset}
              baseTop={position.top - offset}
              layout={layout}
              scale={scale}
              translateX={translateX}
              translateY={translateY}
            >
              <TravelMapPinButton
                testID={AgentUiIds.travel.map.place(pin.id)}
                label={`${pin.label}, ${rendered.person.displayName}`}
                colors={[rendered.person.color]}
                selected={pin.id === selectedPinId}
                left={position.left + offset}
                top={position.top - offset}
                onPress={() => onPlacePress({ rendered, pin })}
              />
            </CountryMarker>
          );
        })}
      </View>
    </>
  );
}

/**
 * Permanent stage shell for the drilled-in country. The gesture detector and
 * its single child view mount once with the canvas and never churn; only the
 * inner country content swaps. Gestures respond only while `active`.
 */
export const TravelMapCountryView = memo(function TravelMapCountryView({
  country,
  active,
  places,
  selectedPinId,
  highlightedCity,
  placing,
  onPlacePress,
  onCoordinatePress,
}: {
  country?: AtlasCountry;
  active: boolean;
  places: TravelMapPlaceSelection[];
  selectedPinId?: string;
  highlightedCity?: TravelMapCity;
  placing: boolean;
  onPlacePress: (selection: TravelMapPlaceSelection) => void;
  onCoordinatePress?: (coordinate: { latitude: number; longitude: number }) => void;
}) {
  const [layout, setLayout] = useState<Layout>({ width: 1, height: 1 });

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const pinchFocalStartX = useSharedValue(0);
  const pinchFocalStartY = useSharedValue(0);
  const layoutWidth = useSharedValue(1);
  const layoutHeight = useSharedValue(1);

  const gesturesEnabled = active && !placing;

  useEffect(() => {
    scale.value = withTiming(1, RECENTER_TIMING);
    translateX.value = withTiming(0, RECENTER_TIMING);
    translateY.value = withTiming(0, RECENTER_TIMING);
  }, [country?.code, highlightedCity?.name, placing, scale, translateX, translateY]);

  /** One-finger drag with momentum, clamped so the map never leaves screen. */
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(gesturesEnabled)
        .maxPointers(1)
        .onBegin(() => {
          panStartX.value = translateX.value;
          panStartY.value = translateY.value;
        })
        .onUpdate((event) => {
          const boundX = countryZoomTranslateBound(scale.value, layoutWidth.value);
          const boundY = countryZoomTranslateBound(scale.value, layoutHeight.value);
          translateX.value = rubberBandZoomTranslate(
            panStartX.value + event.translationX,
            boundX,
          );
          translateY.value = rubberBandZoomTranslate(
            panStartY.value + event.translationY,
            boundY,
          );
        })
        .onEnd((event) => {
          const boundX = countryZoomTranslateBound(scale.value, layoutWidth.value);
          const boundY = countryZoomTranslateBound(scale.value, layoutHeight.value);
          translateX.value = withDecay({
            velocity: event.velocityX,
            clamp: [-boundX, boundX],
            rubberBandEffect: true,
          });
          translateY.value = withDecay({
            velocity: event.velocityY,
            clamp: [-boundY, boundY],
            rubberBandEffect: true,
          });
        }),
    [
      gesturesEnabled,
      layoutHeight,
      layoutWidth,
      panStartX,
      panStartY,
      scale,
      translateX,
      translateY,
    ],
  );

  /** Two-finger zoom anchored to the pinch focal point (focal drift pans). */
  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .enabled(gesturesEnabled)
        .onBegin((event) => {
          pinchStartScale.value = scale.value;
          pinchStartX.value = translateX.value;
          pinchStartY.value = translateY.value;
          pinchFocalStartX.value = event.focalX;
          pinchFocalStartY.value = event.focalY;
        })
        .onUpdate((event) => {
          const next = clampCountryZoomScale(pinchStartScale.value * event.scale);
          const ratio = next / pinchStartScale.value;
          scale.value = next;
          translateX.value = rubberBandZoomTranslate(
            pinchFocalTranslate({
              focal: event.focalX,
              startFocal: pinchFocalStartX.value,
              center: layoutWidth.value / 2,
              startTranslate: pinchStartX.value,
              scaleRatio: ratio,
            }),
            countryZoomTranslateBound(next, layoutWidth.value),
          );
          translateY.value = rubberBandZoomTranslate(
            pinchFocalTranslate({
              focal: event.focalY,
              startFocal: pinchFocalStartY.value,
              center: layoutHeight.value / 2,
              startTranslate: pinchStartY.value,
              scaleRatio: ratio,
            }),
            countryZoomTranslateBound(next, layoutHeight.value),
          );
        })
        .onEnd(() => {
          const boundX = countryZoomTranslateBound(scale.value, layoutWidth.value);
          const boundY = countryZoomTranslateBound(scale.value, layoutHeight.value);
          translateX.value = withTiming(
            clampZoomTranslate(translateX.value, boundX),
            SETTLE_TIMING,
          );
          translateY.value = withTiming(
            clampZoomTranslate(translateY.value, boundY),
            SETTLE_TIMING,
          );
        }),
    [
      gesturesEnabled,
      layoutHeight,
      layoutWidth,
      pinchFocalStartX,
      pinchFocalStartY,
      pinchStartScale,
      pinchStartX,
      pinchStartY,
      scale,
      translateX,
      translateY,
    ],
  );
  const mapGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture],
  );
  const mapTransformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const updateLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setLayout({ width, height });
    layoutWidth.value = width;
    layoutHeight.value = height;
  };

  return (
    <GestureDetector gesture={mapGesture}>
      <View style={styles.root} onLayout={updateLayout}>
        {country ? (
          <CountryStageContent
            country={country}
            layout={layout}
            scale={scale}
            translateX={translateX}
            translateY={translateY}
            mapTransformStyle={mapTransformStyle}
            places={places}
            selectedPinId={selectedPinId}
            highlightedCity={highlightedCity}
            onPlacePress={onPlacePress}
            onCoordinatePress={onCoordinatePress}
          />
        ) : null}
      </View>
    </GestureDetector>
  );
});

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
