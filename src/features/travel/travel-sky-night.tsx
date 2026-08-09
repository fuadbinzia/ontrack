import { useEffect, useMemo, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import {
  approximateLatitudeForDestination,
  dimFieldStars,
  moonPhaseCycle,
  projectStarsToPlate,
} from '@/features/travel/travel-sky-astronomy';
import { destinationShowsAurora } from '@/features/travel/travel-sky-aurora-destinations';
import { TravelSkyAurora } from '@/features/travel/travel-sky-aurora';
import type { HeaderSkyCondition } from '@/features/travel/travel-sky-condition';
import {
  MotionLayer as SharedMotionLayer,
} from '@/features/travel/travel-sky-motion-layer';
import { PhaseMoon } from '@/features/travel/travel-phase-moon';
import {
  SKY_CELESTIAL_CLEARANCE,
  SKY_PLATE_VIEWBOX,
  SKY_VIEW_H,
  SKY_VIEW_W,
} from '@/features/travel/travel-sky-plate';
import type { TravelSkyFxPlan } from '@/features/travel/travel-sky-quality';
import { TravelSkyWeatherFx } from '@/features/travel/travel-sky-weather-fx';
import type { TiltSkyMotion } from '@/features/travel/use-tilt-sky-motion';

/** Cool stellar fills — soft blue-white like real night-sky stars (not warm cream). */
const STAR_FIELD = '#D8E4FF';
const STAR_BRIGHT = '#EAF1FF';

function starFill(mag: number): string {
  return mag < 1 ? STAR_BRIGHT : STAR_FIELD;
}

/** Night defaults: stable opacity + slightly deeper tilt than day. */
function MotionLayer({
  driftMs = 32000,
  ...props
}: Omit<
  ComponentProps<typeof SharedMotionLayer>,
  'opacityMode' | 'tiltXAmp' | 'tiltYAmp' | 'driftYAmp'
>) {
  return (
    <SharedMotionLayer
      {...props}
      driftMs={driftMs}
      opacityMode="stable"
      tiltXAmp={16}
      tiltYAmp={10}
      driftYAmp={1}
    />
  );
}

/** Deterministic 0…1 from a small integer seed (no Math in worklets). */
function starSeedUnit(seed: number, salt: number): number {
  const n = (seed * 7919 + salt * 104729) % 10007;
  return (n < 0 ? n + 10007 : n) / 10007;
}

/** Triangle flash 0→1→0 over `[0, 2*width)` of a unit cycle; else 0. */
function unitFlash(t: number, width: number): number {
  'worklet';
  if (width <= 0) return 0;
  if (t < width) return t / width;
  if (t < width * 2) return 1 - (t - width) / width;
  return 0;
}

/** One shared driver for the whole bright field — phases make flashes feel independent. */
function useStarTwinkleClock(active: boolean): SharedValue<number> {
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(clock);
      clock.value = 0;
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: 5800, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(clock);
    };
  }, [active, clock]);
  return clock;
}

/**
 * Independent-looking opacity flashes via a shared clock + per-star phase.
 * Uses Animated.View (not animated SVG) — Fabric-safe and far cheaper than
 * N× `createAnimatedComponent(Circle)` + per-star `withRepeat` trees.
 */
function TwinklingStar({
  cx,
  cy,
  r,
  seed,
  baseOpacity,
  color,
  clock,
}: {
  cx: number;
  cy: number;
  r: number;
  seed: number;
  baseOpacity: number;
  color: string;
  clock: SharedValue<number>;
}) {
  const phase = starSeedUnit(seed, 1);
  // Readable sparkle without disco — modest flash vs rest, no halo bloom.
  const flashWidth = 0.06 + starSeedUnit(seed, 3) * 0.08;
  const peak = 0.8 + starSeedUnit(seed, 5) * 0.2;
  // Dim between flashes so the brightening is obvious (was ~0.78 — nearly static).
  const rest = 0.28 + starSeedUnit(seed, 7) * 0.18;
  const doubleFlash = seed % 7 === 0 || seed % 11 === 0;
  const secondBurst = seed % 5 === 0 || seed % 13 === 0;
  const size = Math.max(2.1, r * 2.15);

  const style = useAnimatedStyle(() => {
    const t = (clock.value + phase) % 1;
    let flash = unitFlash(t, flashWidth);
    if (secondBurst) {
      flash = Math.max(flash, unitFlash((t + 0.48) % 1, flashWidth * 0.85) * 0.9);
    }
    if (doubleFlash) {
      flash = Math.max(
        flash,
        unitFlash((t + 0.1) % 1, flashWidth * 0.7) * 0.78,
      );
    }
    // Soft always-on shimmer so the field never freezes between sparks.
    const shimmerT = (clock.value * 1.7 + phase * 2.3) % 1;
    const shimmer = unitFlash(shimmerT, 0.48);
    const floor = rest + shimmer * 0.16;
    const bright = floor + flash * peak * (1 - floor);
    return {
      opacity: baseOpacity * bright,
      transform: [{ scale: 0.86 + flash * 0.48 + shimmer * 0.1 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.star,
        {
          left: `${(cx / SKY_VIEW_W) * 100}%`,
          top: `${(cy / SKY_VIEW_H) * 100}%`,
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

function Satellite({
  pathY,
  delayMs,
  duration,
  color,
  tiltY,
}: {
  pathY: number;
  delayMs: number;
  duration: number;
  color: string;
  tiltY: SharedValue<number>;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.linear }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: 4000 }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, duration, t]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.08, 0.9, 1], [0, 0.85, 0.85, 0]),
    transform: [
      { translateX: interpolate(t.value, [0, 1], [-20, SKY_VIEW_W + 20]) },
      { translateY: pathY + tiltY.value * 6 },
    ],
  }));

  return (
    <Animated.View style={[styles.streak, style]}>
      <Svg width={18} height={8} viewBox="0 0 18 8">
        <Path d="M2 4 H6 M12 4 H16" stroke={color} strokeWidth={1} opacity={0.7} />
        <Circle cx={9} cy={4} r={2.2} fill={color} />
        <Circle cx={9} cy={4} r={1} fill="rgba(255,255,255,0.9)" />
      </Svg>
    </Animated.View>
  );
}

/**
 * Occasional meteor streak for clear nights — brighter and more frequent
 * over dark-sky (desert) destinations.
 */
function ShootingStar({
  startX,
  startY,
  dx,
  dy,
  delayMs,
  pauseMs,
  bright,
}: {
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  delayMs: number;
  pauseMs: number;
  bright: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 850, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: pauseMs }),
        ),
        -1,
        false,
      ),
    );
  }, [delayMs, pauseMs, t]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.12, 0.7, 1], [0, bright, bright * 0.8, 0]),
    transform: [
      { translateX: startX + t.value * dx },
      { translateY: startY + t.value * dy },
      { rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.streak, style]}>
      <Svg width={34} height={4} viewBox="0 0 34 4">
        <Line
          x1={0}
          y1={2}
          x2={30}
          y2={2}
          stroke="rgba(210,228,255,0.5)"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <Line
          x1={20}
          y1={2}
          x2={32}
          y2={2}
          stroke="rgba(255,255,255,0.95)"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

export function TravelSkyNight({
  condition,
  destination,
  dateKey,
  latitude,
  longitude,
  statusBand,
  motion,
  fx,
}: {
  condition: HeaderSkyCondition;
  destination: string;
  dateKey: string;
  latitude?: number;
  longitude?: number;
  statusBand: number;
  motion: TiltSkyMotion;
  fx: TravelSkyFxPlan;
}) {
  const liveFx = fx.liveFx;
  const now = useMemo(() => new Date(), []);
  const cycle = useMemo(() => moonPhaseCycle(now), [now]);
  const showAurora =
    destinationShowsAurora(destination) && !condition.lightning;
  const twinkleClock = useStarTwinkleClock(liveFx && fx.twinkle);

  const lat = latitude ?? approximateLatitudeForDestination(destination);
  const cloudy = condition.cloudyNight;
  const desert = condition.accents.desert;

  const stars = useMemo(
    () =>
      projectStarsToPlate({
        date: now,
        latitude: lat,
        longitude,
        viewW: SKY_VIEW_W,
        viewH: SKY_VIEW_H,
        cloudy,
      }),
    [cloudy, lat, longitude, now],
  );
  const dimStars = useMemo(() => {
    const all = dimFieldStars(
      SKY_VIEW_W,
      SKY_VIEW_H,
      `${destination}|${dateKey}`,
      cloudy,
      desert,
    );
    if (fx.dimStarScale >= 0.99) return all;
    const n = Math.max(10, Math.round(all.length * fx.dimStarScale));
    return all.slice(0, n);
  }, [cloudy, dateKey, desert, destination, fx.dimStarScale]);

  const { twinkleStars, staticBrightStars, staticDimStars } = useMemo(() => {
    type Twinkle = (typeof stars)[number] & { seed: number };
    if (!liveFx || !fx.twinkle || fx.twinkleMax <= 0) {
      return {
        twinkleStars: [] as Twinkle[],
        staticBrightStars: stars,
        staticDimStars: dimStars,
      };
    }
    // Prefer catalog stars, then brighter dim-field fillers so the dense
    // plate sparkles — not only a handful of named points.
    const brightRanked = stars
      .map((s, i) => ({ s, i }))
      .sort((a, b) => a.s.mag - b.s.mag);
    const fieldRanked = dimStars
      .map((s, i) => ({ s, i: stars.length + i }))
      .sort((a, b) => b.s.opacity - a.s.opacity);
    const fieldBudget = Math.min(
      fieldRanked.length,
      Math.max(8, Math.round(fx.twinkleMax * 0.45)),
    );
    const brightBudget = Math.min(
      brightRanked.length,
      fx.twinkleMax - Math.min(fieldBudget, fx.twinkleMax),
    );
    const picked = [
      ...brightRanked.slice(0, brightBudget),
      ...fieldRanked.slice(0, Math.min(fieldBudget, fx.twinkleMax - brightBudget)),
    ];
    const twinkleKeys = new Set(picked.map(({ s }) => s.name));
    return {
      twinkleStars: picked.map(({ s, i }) => ({ ...s, seed: i + 1 })),
      staticBrightStars: stars.filter((s) => !twinkleKeys.has(s.name)),
      staticDimStars: dimStars.filter((s) => !twinkleKeys.has(s.name)),
    };
  }, [dimStars, fx.twinkle, fx.twinkleMax, liveFx, stars]);

  const starOpacityMul =
    (condition.rain ? 0.4 : 1) * (showAurora ? 0.85 : 1) * (desert ? 1.12 : 1);
  const clearSky = !condition.rain && !cloudy;
  // Below the status band so the disc clears the clock / Dynamic Island.
  const moonY = Math.min(
    SKY_VIEW_H - 40,
    statusBand + SKY_CELESTIAL_CLEARANCE,
  );
  const moonX = 220;
  const moonR = 7;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox={SKY_PLATE_VIEWBOX}
        preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="nightWash" cx="55%" cy="20%" r="80%">
            <Stop offset="0%" stopColor="rgba(40,70,120,0.35)" />
            <Stop offset="55%" stopColor="rgba(18,28,48,0.2)" />
            <Stop offset="100%" stopColor="rgba(8,12,22,0)" />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={SKY_VIEW_W * 0.55}
          cy={28}
          rx={SKY_VIEW_W * 0.7}
          ry={70}
          fill="url(#nightWash)"
        />
      </Svg>

      {showAurora ? (
        <TravelSkyAurora
          statusBand={statusBand}
          motion={motion}
          muted={cloudy || condition.rain}
          liveFx={fx.auroraMotion}
        />
      ) : null}

      <MotionLayer
        depth={0.3}
        energy={motion.energy}
        tiltX={motion.tiltX}
        tiltY={motion.tiltY}>
        <Svg
          width="100%"
          height="100%"
          viewBox={SKY_PLATE_VIEWBOX}
          preserveAspectRatio="none">
          {staticDimStars.map((s) => (
            <Circle
              key={s.name}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill={STAR_FIELD}
              opacity={Math.min(1, s.opacity * starOpacityMul)}
            />
          ))}
          {staticBrightStars.map((s) => (
            <Circle
              key={s.name}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill={starFill(s.mag)}
              opacity={Math.min(1, s.opacity * starOpacityMul)}
            />
          ))}
        </Svg>
      </MotionLayer>

      {twinkleStars.length > 0 ? (
        <MotionLayer
          depth={0.75}
          energy={motion.energy}
          tiltX={motion.tiltX}
          tiltY={motion.tiltY}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {twinkleStars.map((s) => (
              <TwinklingStar
                key={s.name}
                cx={s.x}
                cy={s.y}
                r={s.r}
                seed={s.seed}
                baseOpacity={Math.min(1, s.opacity * starOpacityMul)}
                color={starFill(s.mag)}
                clock={twinkleClock}
              />
            ))}
          </View>
        </MotionLayer>
      ) : null}

      {cloudy ? (
        <MotionLayer
          depth={1.1}
          delayMs={80}
          driftAmp={
            fx.cloudDrift
              ? condition.cloudCover === 'partly'
                ? 14
                : 18
              : 0
          }
          driftMs={condition.cloudCover === 'partly' ? 28000 : 34000}
          energy={motion.energy}
          tiltX={motion.tiltX}
          tiltY={motion.tiltY}>
          <Svg
            width="100%"
            height="100%"
            viewBox={SKY_PLATE_VIEWBOX}
            preserveAspectRatio="none">
            <G
              opacity={
                condition.rain
                  ? 0.55
                  : condition.cloudCover === 'partly'
                    ? 0.32
                    : 0.4
              }>
              <Ellipse cx={80} cy={36} rx={70} ry={18} fill="rgba(40,55,80,0.55)" />
              <Ellipse cx={200} cy={28} rx={90} ry={22} fill="rgba(35,50,75,0.5)" />
              <Ellipse cx={300} cy={42} rx={65} ry={16} fill="rgba(45,60,85,0.45)" />
            </G>
          </Svg>
        </MotionLayer>
      ) : null}

      <PhaseMoon
        cx={moonX}
        cy={moonY}
        r={moonR}
        cycle={cycle}
        southern={lat < 0}
        motion={motion}
        gradientId="itineraryPhaseMoon"
      />

      {fx.meteors && clearSky ? (
        <>
          <ShootingStar
            startX={40}
            startY={Math.max(statusBand + 6, 18)}
            dx={130}
            dy={44}
            delayMs={desert ? 3000 : 7000}
            pauseMs={desert ? 14000 : 26000}
            bright={desert ? 0.95 : 0.75}
          />
          {desert ? (
            <ShootingStar
              startX={230}
              startY={Math.max(statusBand + 14, 30)}
              dx={-110}
              dy={38}
              delayMs={11000}
              pauseMs={19000}
              bright={0.85}
            />
          ) : null}
        </>
      ) : null}

      {fx.satellites && !condition.rain ? (
        <>
          <Satellite
            pathY={Math.max(statusBand + 8, 28)}
            delayMs={600}
            duration={14000}
            color="rgba(200,220,255,0.85)"
            tiltY={motion.tiltY}
          />
          <Satellite
            pathY={Math.max(statusBand + 24, 52)}
            delayMs={5200}
            duration={18000}
            color="rgba(180,200,230,0.7)"
            tiltY={motion.tiltY}
          />
        </>
      ) : null}

      {fx.weatherFx ? (
        <TravelSkyWeatherFx
          rain={condition.rain}
          lightning={condition.lightning}
          dark
          maxDrops={fx.rainDropMax}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  streak: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  star: {
    position: 'absolute',
  },
});
