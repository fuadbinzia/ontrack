import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';
import { geoOrthographic } from 'd3-geo';
import Svg, {
    Circle,
    Defs,
    LinearGradient,
    Path,
    Pattern,
    RadialGradient,
    Rect,
    Stop,
} from 'react-native-svg';

import { useRouteIsActive } from '@/hooks/use-app-activity';
import {
    useLiveFxReady,
    usePerformanceTier,
} from '@/hooks/use-performance-tier';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';

import {
    atlasCountryAtCoordinate,
    atlasCountryByCode,
    TRAVEL_MAP_INK,
    TRAVEL_MAP_LAND_COLORS,
    TRAVEL_MAP_OCEAN_BOTTOM,
    TRAVEL_MAP_OCEAN_MIDDLE,
} from './country-data';
import {
    createTravelGlobeSnapshot,
    normalizeTravelGlobeRotation,
    travelGlobeCameraForLayout,
    travelGlobeCoastStep,
    travelGlobeCoordinateAtPoint,
    travelGlobeDetailForMotion,
    travelGlobeFlickVelocity,
    TRAVEL_GLOBE_FAST_DEGREES_PER_SECOND,
    travelGlobeCoordinateVisible,
    travelGlobeUnzoomPoint,
    type TravelGlobeCoastVelocity,
    type TravelGlobeRotation,
    type TravelGlobeSnapshot,
} from './globe-projection';
import type { TravelMapCountryCluster } from './model';
import { isDrawableSvgPath } from './svg-path';
import { TravelMapPinButton } from './travel-map-pin-button';

type Layout = { width: number; height: number };

export const TRAVEL_MAP_WORLD_BACKDROP_TOP = '#071426';

/** Slow tourist-globe spin; advanced by frame delta so it never steps. */
const IDLE_SPIN_DEGREES_PER_SECOND = 1.9;
/** Idle spin renders at ~30fps — imperceptible for slow rotation, half the work. */
const IDLE_SPIN_MIN_FRAME_MS = 30;
const DRAG_DEGREES_PER_PX_X = 0.34;
const DRAG_DEGREES_PER_PX_Y = 0.26;

/** Pre-layout frame: paints the backdrop only, no projection work. */
const EMPTY_TRAVEL_GLOBE_SNAPSHOT: TravelGlobeSnapshot = {
  spherePath: '',
  graticulePath: '',
  countries: [],
};

/** Memoized — parked world frames skip re-rendering 190+ SVG paths. */
export const TravelMapWorldGlobe = memo(function TravelMapWorldGlobe({
  autoRotate,
  clusters,
  onCountryPress,
  onInteract,
  onRotationChange,
  rotation,
}: {
  autoRotate: boolean;
  clusters: TravelMapCountryCluster[];
  onCountryPress: (countryCode: string) => void;
  onInteract: () => void;
  onRotationChange: (rotation: TravelGlobeRotation) => void;
  rotation: TravelGlobeRotation;
}) {
  const [layout, setLayout] = useState<Layout>({ width: 1, height: 1 });
  const [dragging, setDragging] = useState(false);
  const [coasting, setCoasting] = useState(false);
  const [fastMotion, setFastMotion] = useState(false);
  const rotationRef = useRef(rotation);
  const dragStartRef = useRef(rotation);
  const pendingDragRef = useRef<{ x: number; y: number } | undefined>(
    undefined,
  );
  const dragFrameRef = useRef<number | undefined>(undefined);
  const coastFrameRef = useRef<number | undefined>(undefined);
  const coastVelocityRef = useRef<TravelGlobeCoastVelocity | undefined>(
    undefined,
  );
  const fastMotionRef = useRef(false);
  const idleUntilRef = useRef(0);
  const { allowsLoopMotion } = usePerformanceTier();
  const routeIsActive = useRouteIsActive();
  const idleMotionReady = useLiveFxReady(routeIsActive && allowsLoopMotion);
  const spinning = autoRotate && idleMotionReady;

  const zoom = useSharedValue(1);
  const zoomStart = useSharedValue(1);
  const camera = useMemo(() => travelGlobeCameraForLayout(layout), [layout]);

  // First paint ships the coarse motion geometry; the fine rest pass runs only
  // after the open transition settles (the idle spin re-renders coarse anyway).
  const [warmedUp, setWarmedUp] = useState(false);
  useEffect(() => deferAfterPageTransition(() => setWarmedUp(true)), []);

  // No projection work until the real layout lands — the 1×1 pre-layout frame
  // would otherwise project every visible country just to throw it away.
  const hasLayout = layout.width > 1 && layout.height > 1;
  const snapshot = useMemo(
    () =>
      hasLayout
        ? createTravelGlobeSnapshot(
            rotation,
            camera,
            travelGlobeDetailForMotion({
              dragging,
              coasting,
              spinning,
              warmedUp,
              fast: fastMotion || coasting,
            }),
            false,
          )
        : EMPTY_TRAVEL_GLOBE_SNAPSHOT,
    [camera, coasting, dragging, fastMotion, hasLayout, rotation, spinning, warmedUp],
  );
  const pinPositions = useMemo(() => {
    if (!hasLayout || clusters.length === 0) return [];
    const projection = geoOrthographic()
      .translate(camera.center)
      .scale(camera.radius)
      .clipAngle(90)
      .rotate(rotation);
    return clusters.flatMap((cluster) => {
      const country = atlasCountryByCode(cluster.countryCode);
      if (!country) return [];
      if (
        !travelGlobeCoordinateVisible(
          country.geographicCenter[0],
          country.geographicCenter[1],
          rotation,
          0.08,
        )
      ) {
        return [];
      }
      const projected = projection(country.geographicCenter);
      if (!projected || projected.length < 2) return [];
      const [left, top] = projected;
      if (!Number.isFinite(left) || !Number.isFinite(top)) return [];
      return [{ cluster, left, top }];
    });
  }, [camera, clusters, hasLayout, rotation]);

  const commitRotation = useCallback((next: readonly number[]) => {
    const normalized = normalizeTravelGlobeRotation(next);
    rotationRef.current = normalized;
    onRotationChange(normalized);
  }, [onRotationChange]);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  const stopIdleRotation = useCallback(() => {
    idleUntilRef.current = Number.POSITIVE_INFINITY;
    onInteract();
  }, [onInteract]);

  const setFast = useCallback((next: boolean) => {
    if (fastMotionRef.current === next) return;
    fastMotionRef.current = next;
    setFastMotion(next);
  }, []);

  const stopCoast = useCallback(() => {
    if (coastFrameRef.current != null) {
      cancelAnimationFrame(coastFrameRef.current);
      coastFrameRef.current = undefined;
    }
    coastVelocityRef.current = undefined;
    setCoasting(false);
    setFast(false);
  }, [setFast]);

  const beginRotation = useCallback(() => {
    stopCoast();
    dragStartRef.current = rotationRef.current;
    stopIdleRotation();
    setFast(true);
  }, [setFast, stopCoast, stopIdleRotation]);

  const rotationForDrag = useCallback(
    (translationX: number, translationY: number): TravelGlobeRotation => [
      dragStartRef.current[0] + translationX * DRAG_DEGREES_PER_PX_X,
      dragStartRef.current[1] - translationY * DRAG_DEGREES_PER_PX_Y,
      0,
    ],
    [],
  );

  /** One commit per frame: gesture events outpace paint, extra sets are waste. */
  const flushPendingDrag = useCallback(() => {
    dragFrameRef.current = undefined;
    const pending = pendingDragRef.current;
    if (!pending) return;
    pendingDragRef.current = undefined;
    commitRotation(rotationForDrag(pending.x, pending.y));
  }, [commitRotation, rotationForDrag]);

  const updateRotation = useCallback(
    (
      translationX: number,
      translationY: number,
      velocityX: number,
      velocityY: number,
    ) => {
      pendingDragRef.current = { x: translationX, y: translationY };
      setFast(
        Math.hypot(
          velocityX * DRAG_DEGREES_PER_PX_X,
          velocityY * DRAG_DEGREES_PER_PX_Y,
        ) >= TRAVEL_GLOBE_FAST_DEGREES_PER_SECOND,
      );
      if (dragFrameRef.current == null) {
        dragFrameRef.current = requestAnimationFrame(flushPendingDrag);
      }
    },
    [flushPendingDrag, setFast],
  );

  const finishRotation = useCallback(
    (
      translationX: number,
      translationY: number,
      velocityX: number,
      velocityY: number,
    ) => {
      pendingDragRef.current = undefined;
      if (dragFrameRef.current != null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = undefined;
      }
      // Plain taps finalize with zero translation; committing would rebuild
      // the full projection snapshot mid country-dive for no visual change.
      if (translationX !== 0 || translationY !== 0) {
        commitRotation(rotationForDrag(translationX, translationY));
      }
      setDragging(false);

      const flick = travelGlobeFlickVelocity(
        velocityX,
        velocityY,
        DRAG_DEGREES_PER_PX_X,
        DRAG_DEGREES_PER_PX_Y,
      );
      if (!flick) {
        setFast(false);
        return;
      }

      coastVelocityRef.current = flick;
      setCoasting(true);
      setFast(true);
      let lastFrameTime = 0;
      const tick = (now: number) => {
        const velocity = coastVelocityRef.current;
        if (!velocity) return;
        if (lastFrameTime === 0) {
          lastFrameTime = now;
          coastFrameRef.current = requestAnimationFrame(tick);
          return;
        }
        const step = travelGlobeCoastStep(
          rotationRef.current,
          velocity,
          now - lastFrameTime,
        );
        lastFrameTime = now;
        commitRotation(step.rotation);
        if (step.done) {
          stopCoast();
          return;
        }
        coastVelocityRef.current = step.velocity;
        coastFrameRef.current = requestAnimationFrame(tick);
      };
      coastFrameRef.current = requestAnimationFrame(tick);
    },
    [commitRotation, rotationForDrag, setFast, stopCoast],
  );

  useEffect(
    () => () => {
      if (dragFrameRef.current != null) {
        cancelAnimationFrame(dragFrameRef.current);
      }
      if (coastFrameRef.current != null) {
        cancelAnimationFrame(coastFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!spinning) return;
    idleUntilRef.current = Date.now() + 1000;
    let frame = 0;
    let lastFrameTime = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (Date.now() < idleUntilRef.current) {
        lastFrameTime = now;
        return;
      }
      const elapsed = now - lastFrameTime;
      if (elapsed < IDLE_SPIN_MIN_FRAME_MS) return;
      lastFrameTime = now;
      commitRotation([
        rotationRef.current[0] +
          (IDLE_SPIN_DEGREES_PER_SECOND * Math.min(elapsed, 250)) / 1000,
        rotationRef.current[1],
        0,
      ]);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [commitRotation, spinning]);

  const selectCountry = useCallback(
    (countryCode: string) => {
      stopIdleRotation();
      onCountryPress(countryCode);
    },
    [onCountryPress, stopIdleRotation],
  );

  const selectCountryAtPoint = useCallback(
    (x: number, y: number) => {
      const [px, py] = travelGlobeUnzoomPoint(x, y, camera, zoom.value);
      const coordinate = travelGlobeCoordinateAtPoint(
        px,
        py,
        rotationRef.current,
        camera,
      );
      if (!coordinate) return;
      const country = atlasCountryAtCoordinate(
        coordinate.latitude,
        coordinate.longitude,
      );
      if (country) selectCountry(country.code);
    },
    [camera, selectCountry, zoom],
  );

  const rotateGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(4)
        .runOnJS(true)
        .onBegin(beginRotation)
        .onStart(() => setDragging(true))
        .onUpdate((event) =>
          updateRotation(
            event.translationX,
            event.translationY,
            event.velocityX,
            event.velocityY,
          ),
        )
        .onFinalize((event) =>
          finishRotation(
            event.translationX,
            event.translationY,
            event.velocityX,
            event.velocityY,
          ),
        ),
    [beginRotation, finishRotation, updateRotation],
  );
  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          zoomStart.value = zoom.value;
          runOnJS(stopCoast)();
          runOnJS(stopIdleRotation)();
        })
        .onUpdate((event) => {
          zoom.value = Math.max(
            0.92,
            Math.min(1.42, zoomStart.value * event.scale),
          );
        }),
    [stopCoast, stopIdleRotation, zoom, zoomStart],
  );
  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(8)
        .runOnJS(true)
        .onEnd((event) => selectCountryAtPoint(event.x, event.y)),
    [selectCountryAtPoint],
  );
  const globeGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Exclusive(rotateGesture, tapGesture),
        pinchGesture,
      ),
    [pinchGesture, rotateGesture, tapGesture],
  );
  const globeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoom.value }],
  }));

  const updateLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setLayout({ width, height });
  };

  return (
    <AgentTestId
      testID={AgentUiIds.travel.map.globe}
      label="Rotating world globe"
      style={styles.root}
    >
      <GestureDetector gesture={globeGesture}>
        <Animated.View
          style={[StyleSheet.absoluteFill, globeStyle]}
          onLayout={updateLayout}
        >
          <Svg
            pointerEvents="none"
            width="100%"
            height="100%"
            viewBox={`0 0 ${camera.width} ${camera.height}`}
            preserveAspectRatio="none"
          >
            <Defs>
              <LinearGradient id="globeBackdrop" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={TRAVEL_MAP_WORLD_BACKDROP_TOP} />
                <Stop offset="0.56" stopColor="#0D1A31" />
                <Stop offset="1" stopColor="#03070F" />
              </LinearGradient>
              <RadialGradient id="spaceNebula" cx="26%" cy="18%" r="84%">
                <Stop offset="0" stopColor="#3D719B" stopOpacity="0.5" />
                <Stop offset="0.42" stopColor="#1B3154" stopOpacity="0.26" />
                <Stop offset="1" stopColor="#03070F" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="globeOcean" cx="34%" cy="25%" r="76%">
                <Stop offset="0" stopColor="#B9F0F2" />
                <Stop offset="0.48" stopColor={TRAVEL_MAP_OCEAN_MIDDLE} />
                <Stop offset="0.82" stopColor={TRAVEL_MAP_OCEAN_BOTTOM} />
                <Stop offset="1" stopColor="#0D5E86" />
              </RadialGradient>
              <Pattern
                id="spaceStars"
                width="74"
                height="74"
                patternUnits="userSpaceOnUse"
              >
                <Circle cx="9" cy="13" r="0.7" fill="#FFFFFF" opacity="0.84" />
                <Circle cx="38" cy="8" r="0.4" fill="#D9E8FF" opacity="0.66" />
                <Circle cx="62" cy="27" r="1.05" fill="#F8FBFF" opacity="0.9" />
                <Circle cx="24" cy="49" r="0.5" fill="#BBD4F1" opacity="0.7" />
                <Circle
                  cx="54"
                  cy="65"
                  r="0.65"
                  fill="#FFFFFF"
                  opacity="0.76"
                />
              </Pattern>
            </Defs>
            <Rect
              width={camera.width}
              height={camera.height}
              fill="url(#globeBackdrop)"
            />
            <Rect
              width={camera.width}
              height={camera.height}
              fill="url(#spaceNebula)"
            />
            <Rect
              width={camera.width}
              height={camera.height}
              fill="url(#spaceStars)"
            />
            {isDrawableSvgPath(snapshot.spherePath) ? (
              <Path
                d={snapshot.spherePath}
                fill="#000000"
                opacity="0.42"
                transform="translate(0 8)"
                pointerEvents="none"
              />
            ) : null}
            {isDrawableSvgPath(snapshot.spherePath) ? (
              <Path
                d={snapshot.spherePath}
                fill="url(#globeOcean)"
                pointerEvents="none"
              />
            ) : null}
            {isDrawableSvgPath(snapshot.graticulePath) ? (
              <Path
                d={snapshot.graticulePath}
                fill="none"
                stroke="rgba(236,253,250,0.3)"
                strokeWidth="0.8"
                pointerEvents="none"
              />
            ) : null}
            {snapshot.countries.map(({ country, path }, index) =>
              isDrawableSvgPath(path) ? (
                <Path
                  key={country.code}
                  d={path}
                  fill={
                    TRAVEL_MAP_LAND_COLORS[
                      index % TRAVEL_MAP_LAND_COLORS.length
                    ]
                  }
                  stroke={TRAVEL_MAP_INK}
                  strokeOpacity="0.72"
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              ) : null,
            )}
            {isDrawableSvgPath(snapshot.spherePath) ? (
              <Path
                d={snapshot.spherePath}
                fill="none"
                stroke="rgba(239,253,248,0.88)"
                strokeWidth="5"
                pointerEvents="none"
              />
            ) : null}
          </Svg>

          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {pinPositions.map(({ cluster, left, top }) => {
              return (
                <TravelMapPinButton
                  key={cluster.countryCode}
                  testID={AgentUiIds.travel.map.countryCluster(cluster.countryCode)}
                  label={`${cluster.countryName}, ${cluster.visits.length} trip${
                    cluster.visits.length === 1 ? '' : 's'
                  }`}
                  people={cluster.people}
                  left={left}
                  top={top}
                  onPress={() => selectCountry(cluster.countryCode)}
                />
              );
            })}
          </View>
        </Animated.View>
      </GestureDetector>
    </AgentTestId>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: TRAVEL_MAP_WORLD_BACKDROP_TOP,
  },
});
