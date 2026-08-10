import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

import type { HeaderSkyCondition } from '@/features/travel/travel-sky-condition';
import {
  DaySun,
  FlyingBird,
  FogWisps,
  HeatShimmer,
  paletteFor,
  SoftCloud,
} from '@/features/travel/travel-sky-day-fx';
import { MotionLayer } from '@/features/travel/travel-sky-motion-layer';
import {
  SKY_CELESTIAL_CLEARANCE,
  SKY_PLATE_VIEWBOX,
  SKY_VIEW_H,
  SKY_VIEW_W,
} from '@/features/travel/travel-sky-plate';
import type { TravelSkyFxPlan } from '@/features/travel/travel-sky-quality';
import { TravelSkyWeatherFx } from '@/features/travel/travel-sky-weather-fx';
import type { TiltSkyMotion } from '@/features/travel/use-tilt-sky-motion';

export function TravelSkyDay({
  condition,
  statusBand,
  motion,
  fx,
}: {
  condition: HeaderSkyCondition;
  statusBand: number;
  motion: TiltSkyMotion;
  fx: TravelSkyFxPlan;
}) {
  const palette = paletteFor(condition.look);
  const accents = condition.accents;
  const sunY = Math.min(SKY_VIEW_H - 30, statusBand + SKY_CELESTIAL_CLEARANCE);
  const sunX = condition.look === 'sunrise' ? 72 : condition.look === 'sunset' ? 300 : 220;
  const cover = condition.cloudCover;
  // Weather clouds (partly / dense) always paint — including desert. Clear stays
  // a light decorative shelf unless the destination is desert-clear.
  const showClouds =
    cover === 'dense' ||
    cover === 'partly' ||
    (cover === 'light' && !accents.desert);
  const denseClouds = cover === 'dense' || palette.denseClouds;
  const partlyClouds = cover === 'partly';
  const cloudScale = denseClouds ? 1 : partlyClouds ? 0.92 : 0.78;
  const cloudOpacityMul = denseClouds ? 1 : partlyClouds ? 0.88 : 0.72;
  const overcastLook = condition.look === 'cloudy' || condition.look === 'rain';
  const birdColor = accents.tropical
    ? 'rgba(35,45,60,0.8)'
    : 'rgba(30,45,62,0.75)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox={SKY_PLATE_VIEWBOX}
        preserveAspectRatio="none">
        <Ellipse
          cx={SKY_VIEW_W / 2}
          cy={20}
          rx={SKY_VIEW_W * 0.85}
          ry={80}
          fill={palette.wash}
        />
        {accents.tropical ? (
          <Ellipse
            cx={SKY_VIEW_W * 0.6}
            cy={30}
            rx={SKY_VIEW_W * 0.7}
            ry={64}
            fill="rgba(255,178,102,0.14)"
          />
        ) : null}
      </Svg>

      {palette.showSun ? (
        <DaySun
          cx={sunX}
          cy={sunY}
          motion={motion}
          warm={palette.warmSun}
          showRays={fx.sunRays}
          animate={fx.liveFx}
        />
      ) : null}

      {showClouds ? (
        <>
          {/* Far cloud shelf — slow lazy drift + light tilt */}
          <MotionLayer
            depth={0.28}
            delayMs={60}
            driftAmp={fx.cloudDrift ? 10 : 0}
            driftMs={36000}
            energy={motion.energy}
            tiltX={motion.tiltX}
            tiltY={motion.tiltY}>
            <Svg
              width="100%"
              height="100%"
              viewBox={SKY_PLATE_VIEWBOX}
              preserveAspectRatio="none">
              <SoftCloud
                cx={120}
                cy={24}
                scale={1.05 * cloudScale}
                fill={palette.cloud}
                opacity={palette.cloudOpacity * 0.55 * cloudOpacityMul}
              />
              <SoftCloud
                cx={250}
                cy={34}
                scale={0.95 * cloudScale}
                fill={palette.cloud}
                opacity={palette.cloudOpacity * 0.5 * cloudOpacityMul}
              />
            </Svg>
          </MotionLayer>

          {/* Near cloud layer — faster drift, rides tilt */}
          <MotionLayer
            depth={0.9}
            delayMs={120}
            driftAmp={fx.cloudDrift ? 22 : 0}
            driftMs={24000}
            energy={motion.energy}
            tiltX={motion.tiltX}
            tiltY={motion.tiltY}>
            <Svg
              width="100%"
              height="100%"
              viewBox={SKY_PLATE_VIEWBOX}
              preserveAspectRatio="none">
              <SoftCloud
                cx={70}
                cy={42}
                scale={1.35 * cloudScale}
                fill={palette.cloud}
                opacity={palette.cloudOpacity * cloudOpacityMul}
              />
              <SoftCloud
                cx={170}
                cy={28}
                scale={1.5 * cloudScale}
                fill={palette.cloud}
                opacity={palette.cloudOpacity * 0.9 * cloudOpacityMul}
              />
              <SoftCloud
                cx={280}
                cy={48}
                scale={1.4 * cloudScale}
                fill={palette.cloud}
                opacity={palette.cloudOpacity * 0.85 * cloudOpacityMul}
              />
              {denseClouds || partlyClouds ? (
                <>
                  <SoftCloud
                    cx={120}
                    cy={58}
                    scale={(denseClouds ? 1.2 : 1.05) * cloudScale}
                    fill={palette.cloud}
                    opacity={palette.cloudOpacity * 0.8 * cloudOpacityMul}
                  />
                  <SoftCloud
                    cx={230}
                    cy={36}
                    scale={(denseClouds ? 1.25 : 1.1) * cloudScale}
                    fill={palette.cloud}
                    opacity={palette.cloudOpacity * 0.75 * cloudOpacityMul}
                  />
                </>
              ) : null}
            </Svg>
          </MotionLayer>
        </>
      ) : null}

      {fx.birds && palette.showBirds ? (
        <>
          <FlyingBird
            y={statusBand + 34}
            delayMs={0}
            duration={30000}
            scale={1}
            color={birdColor}
            frigate={accents.tropical}
            tiltX={motion.tiltX}
            tiltY={motion.tiltY}
          />
          <FlyingBird
            y={statusBand + 24}
            delayMs={6000}
            duration={38000}
            scale={0.8}
            color={birdColor}
            frigate={accents.tropical}
            tiltX={motion.tiltX}
            tiltY={motion.tiltY}
          />
          <FlyingBird
            y={statusBand + 48}
            delayMs={13000}
            duration={26000}
            scale={0.62}
            color={birdColor}
            frigate={accents.tropical}
            tiltX={motion.tiltX}
            tiltY={motion.tiltY}
          />
        </>
      ) : null}

      {fx.heatFog && accents.desert && !denseClouds && !partlyClouds ? (
        <HeatShimmer />
      ) : null}
      {fx.heatFog && accents.fog && overcastLook ? <FogWisps /> : null}

      {fx.weatherFx ? (
        <TravelSkyWeatherFx
          rain={condition.rain}
          lightning={condition.lightning}
          dark={false}
          maxDrops={fx.rainDropMax}
        />
      ) : null}
    </View>
  );
}

