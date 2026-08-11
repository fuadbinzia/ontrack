import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import {
  moonIlluminationFromCycle,
  moonPhaseShadowPath,
  moonTerminatorPath,
} from '@/features/travel/travel-sky-astronomy';
import { celestialDiscHostStyle } from '@/features/travel/travel-sky-plate';
import { useRouteIsActive } from '@/hooks/use-app-activity';

/** Fixed lunar-surface features, positioned as fractions of the moon radius. */
const MOON_MARIA = [
  { fx: -0.34, fy: -0.3, frx: 0.34, fry: 0.26 },
  { fx: 0.06, fy: -0.4, frx: 0.24, fry: 0.18 },
  { fx: 0.34, fy: -0.08, frx: 0.2, fry: 0.26 },
  { fx: -0.12, fy: 0.12, frx: 0.4, fry: 0.28 },
] as const;

const MOON_CRATERS = [
  { fx: 0.46, fy: 0.3, fr: 0.13 },
  { fx: 0.18, fy: 0.52, fr: 0.09 },
  { fx: -0.52, fy: 0.34, fr: 0.11 },
  { fx: 0.55, fy: -0.38, fr: 0.08 },
  { fx: -0.26, fy: -0.58, fr: 0.07 },
] as const;

/** Tycho — larger crater near the southern limb with a faint ray splash. */
const MOON_TYCHO = { fx: -0.06, fy: 0.62, fr: 0.12 } as const;

type PhaseMoonMotion = {
  energy: SharedValue<number>;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
};

/**
 * Realtime phase moon for the itinerary sky plate: bright disc always
 * present (visible at new moon), surface craters/maria on the full orb,
 * translucent terminator shadow so detail stays readable in the dark.
 */
export function PhaseMoon({
  cx,
  cy,
  r,
  cycle,
  southern,
  motion,
  gradientId = 'phaseMoon',
}: {
  cx: number;
  cy: number;
  r: number;
  cycle: number;
  southern: boolean;
  motion?: PhaseMoonMotion;
  /** Prefix unique gradient ids when multiple moons mount. */
  gradientId?: string;
}) {
  const shadow = moonPhaseShadowPath(cycle, cx, cy, r, southern);
  const litPath = moonTerminatorPath(cycle, cx, cy, r, southern);
  const illumination = moonIlluminationFromCycle(cycle);
  const routeIsActive = useRouteIsActive();

  const idle = useSharedValue(0.9);
  useEffect(() => {
    cancelAnimation(idle);
    if (!routeIsActive) {
      idle.value = 0.9;
      return;
    }
    idle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.86, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(idle);
  }, [idle, routeIsActive]);

  const style = useAnimatedStyle(() => {
    const energy = motion?.energy.value ?? 0;
    const tiltX = motion?.tiltX.value ?? 0;
    const tiltY = motion?.tiltY.value ?? 0;
    return {
      opacity: interpolate(energy, [0, 1], [idle.value, 1]),
      transform: [{ translateX: tiltX * 3 }, { translateY: tiltY * 2 }],
    };
  });

  // Soft sky-plate halo — pad beyond the disc so the glow can breathe.
  const pad = r * 1.8;
  const box = pad * 2;
  const glowOpacity = 0.1 + illumination * 0.14;
  // New-moon shadow stays translucent so the orb + craters remain visible.
  const shadowOpacity = illumination < 0.04 ? 0.62 : 0.52;
  const glowGrad = `${gradientId}Glow`;
  const surfaceGrad = `${gradientId}Surface`;

  return (
    <View pointerEvents="none" style={celestialDiscHostStyle(cx, cy, box)}>
      <Animated.View style={[{ flex: 1 }, style]}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`${cx - pad} ${cy - pad} ${box} ${box}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ backgroundColor: 'transparent' }}
        >
          <Defs>
            <RadialGradient id={glowGrad} cx="50%" cy="50%" r="50%">
              {/* stopOpacity — rgba alpha in stopColor is ignored on RN SVG. */}
              <Stop offset="0%" stopColor="#E8EEF8" stopOpacity={glowOpacity} />
              <Stop offset="100%" stopColor="#E8EEF8" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient
              id={surfaceGrad}
              gradientUnits="userSpaceOnUse"
              cx={cx - r * 0.28}
              cy={cy - r * 0.32}
              r={r * 1.6}
            >
              <Stop offset="0%" stopColor="#F4F7FB" />
              <Stop offset="55%" stopColor="#DCE3EC" />
              <Stop offset="100%" stopColor="#B7C2D0" />
            </RadialGradient>
            {litPath ? (
              <ClipPath id={`${gradientId}Lit`}>
                <Path d={litPath} />
              </ClipPath>
            ) : null}
          </Defs>

          <Circle cx={cx} cy={cy} r={r * 1.55} fill={`url(#${glowGrad})`} />

          {/* Base disc — always drawn so new moon stays an orb. */}
          <Circle cx={cx} cy={cy} r={r} fill={`url(#${surfaceGrad})`} />

          {/* Maria + craters on the full disc (under the phase shadow). */}
          {MOON_MARIA.map((m, i) => (
            <Ellipse
              key={`maria-${i}`}
              cx={cx + m.fx * r}
              cy={cy + m.fy * r}
              rx={m.frx * r}
              ry={m.fry * r}
              fill="rgba(52,66,88,0.45)"
            />
          ))}
          {MOON_CRATERS.map((c, i) => (
            <G key={`crater-${i}`}>
              <Circle
                cx={cx + c.fx * r}
                cy={cy + c.fy * r}
                r={c.fr * r}
                fill="none"
                stroke="rgba(230,238,248,0.4)"
                strokeWidth={c.fr * r * 0.35}
              />
              <Circle
                cx={cx + c.fx * r + c.fr * r * 0.12}
                cy={cy + c.fy * r + c.fr * r * 0.12}
                r={c.fr * r * 0.72}
                fill="rgba(40,52,72,0.58)"
              />
            </G>
          ))}
          <Circle
            cx={cx + MOON_TYCHO.fx * r}
            cy={cy + MOON_TYCHO.fy * r}
            r={MOON_TYCHO.fr * r}
            fill="rgba(220,230,242,0.4)"
          />
          {[-40, 0, 42].map((deg) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            const x0 = cx + MOON_TYCHO.fx * r;
            const y0 = cy + MOON_TYCHO.fy * r;
            return (
              <Line
                key={`ray-${deg}`}
                x1={x0}
                y1={y0}
                x2={x0 + Math.cos(rad) * r * 0.55}
                y2={y0 - Math.sin(rad) * r * 0.55}
                stroke="rgba(235,242,250,0.2)"
                strokeWidth={r * 0.07}
                strokeLinecap="round"
              />
            );
          })}
          <Circle
            cx={cx}
            cy={cy}
            r={r * 0.93}
            fill="none"
            stroke="rgba(40,52,72,0.3)"
            strokeWidth={r * 0.14}
          />

          {/* Lit highlight — brightens only the illuminated side. */}
          {litPath ? (
            <G clipPath={`url(#${gradientId}Lit)`}>
              <Circle cx={cx} cy={cy} r={r} fill="rgba(244,247,251,0.78)" />
            </G>
          ) : null}

          {/* Phase shadow — translucent so crater detail stays in the dark. */}
          {shadow ? (
            <Path
              d={shadow.d}
              fillRule={shadow.fillRule}
              fill={`rgba(12,20,36,${shadowOpacity})`}
            />
          ) : null}
        </Svg>
      </Animated.View>
    </View>
  );
}
