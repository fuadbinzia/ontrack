import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
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
import { PhaseMoon } from '@/features/travel/travel-phase-moon';
import {
  SKY_CELESTIAL_CLEARANCE,
  SKY_PLATE_VIEWBOX,
  SKY_VIEW_H,
  SKY_VIEW_W,
} from '@/features/travel/travel-sky-plate';
import type { TravelSkyFxPlan } from '@/features/travel/travel-sky-quality';
import {
  MotionLayer,
  STAR_FIELD,
  Satellite,
  ShootingStar,
  TwinklingStar,
  starFill,
  useStarTwinkleClock,
} from '@/features/travel/travel-sky-night-fx';
import { TravelSkyWeatherFx } from '@/features/travel/travel-sky-weather-fx';
import type { TiltSkyMotion } from '@/features/travel/use-tilt-sky-motion';

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
