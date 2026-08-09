import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import Svg, {
    Defs,
    Ellipse,
    Path,
    RadialGradient,
    Stop,
    LinearGradient as SvgLinearGradient,
} from 'react-native-svg';

import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useTheme } from '@/hooks/use-theme';

type TravelHomeTripFrostScoopProps = ViewProps & {
  children?: React.ReactNode;
  /** Title band height — usually measured (≥ `bodyOverlap`). */
  height: number;
  /** Extra fade into the paper body so the photo→paper ramp finishes solid. */
  fadeBleed?: number;
  /** Remount BlurView when hero URI arrives — iOS otherwise keeps a stale sample. */
  blurKey?: string;
  /** Solid paper color the blend must reach (`#FFFFFF` / sunken). */
  paperColor: string;
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
};

/**
 * Photo→paper blend under the trip-card title.
 *
 * Separate ramps (never black→white in one gradient — muddy shelf):
 * 1. Soft photo soften (iOS blur) under the title band
 * 2. Short full-width paper join into solid paper
 * 3. Valley swoop veil — left lip → dip through title → rise under avatar
 *
 * Must NOT sit under a card-wide `overflow: 'hidden'` — kills UIVisualEffect.
 */
export function TravelHomeTripFrostScoop({
  children,
  height,
  fadeBleed = 0,
  blurKey = 'frost',
  paperColor,
  borderTopLeftRadius,
  borderTopRightRadius,
  style,
  ...rest
}: TravelHomeTripFrostScoopProps) {
  const theme = useTheme();
  const { allowsBlur } = usePerformanceTier();
  const dark = theme.name === 'dark';
  const totalHeight = height + fadeBleed;
  const milkHeight = totalHeight;
  const fadeHeight = totalHeight;
  const joinHeight = Math.max(fadeBleed + 18, Math.round(totalHeight * 0.42));
  const radiusStyle = {
    borderTopLeftRadius,
    borderTopRightRadius,
    borderCurve: 'continuous' as const,
  };

  const ink = (alpha: number) =>
    hexToRgba(paperColor, alpha) ??
    (dark ? `rgba(12, 16, 24, ${alpha})` : `rgba(255, 255, 255, ${alpha})`);

  const paperRgba = ink(1);
  const milkClear = dark ? ink(0) : 'rgba(255,255,255,0)';
  const milkSoft = dark ? ink(0.38) : 'rgba(255,255,255,0.45)';
  const milkStrong = dark ? ink(0.82) : 'rgba(255,255,255,0.86)';
  const milkFill = dark ? ink(1) : '#FFFFFF';

  // Valley swoop (viewBox x 0–100): lip → title dip → avatar crest.
  // Same curve, nudged up as a unit (keep relative Y deltas).
  // Small lift — keep the scoop low so more hero shows above the milk.
  const lift = Math.round(milkHeight * 0.04);
  const leftY = Math.max(2, Math.round(milkHeight * 0.28) - lift);
  const valleyY = Math.max(leftY + 8, Math.round(milkHeight * 0.46) - lift);
  const rightY = Math.max(2, Math.round(milkHeight * 0.14) - lift);
  const veilPath = [
    `M 0 ${leftY}`,
    `C 16 ${leftY} 26 ${valleyY} 40 ${valleyY}`,
    `C 58 ${valleyY} 78 ${rightY} 100 ${rightY}`,
    `L 100 ${milkHeight}`,
    `L 0 ${milkHeight}`,
    'Z',
  ].join(' ');

  // Soft mist in the valley (busy mid-photo); rides with the lifted lip.
  const midGlowCx = 42;
  const midGlowCy = Math.round(valleyY + milkHeight * 0.12);
  const midGlowRx = 34;
  const midGlowRy = Math.max(20, Math.round(milkHeight * 0.44));
  const sideBoost = dark ? 0.52 : 0.48;
  const midGlowBoost = dark ? 0.55 : 0.62;

  return (
    <View
      {...rest}
      collapsable={false}
      style={[
        styles.scoop,
        {
          height: totalHeight,
          borderWidth: 0,
          ...radiusStyle,
        },
        style,
      ]}>
      {Platform.OS === 'ios' ? (
        <BlurView
          key={`ios-frost-${blurKey}`}
          intensity={allowsBlur ? 16 : 0}
          tint="light"
          pointerEvents="none"
          style={[
            radiusStyle,
            styles.blurClip,
            styles.blurBand,
            { height, opacity: 0.28 },
          ]}
        />
      ) : null}
      {fadeBleed > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.bandBottom,
            {
              height: Math.max(10, Math.round(fadeBleed * 0.7)),
              backgroundColor: paperColor,
            },
          ]}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={[milkClear, milkSoft, milkStrong, paperRgba]}
        locations={[0, 0.35, 0.7, 1]}
        style={[styles.bandBottom, { height: joinHeight }]}
      />
      <Svg
        pointerEvents="none"
        width="100%"
        height={milkHeight}
        viewBox={`0 0 100 ${milkHeight}`}
        preserveAspectRatio="none"
        style={styles.titleVeil}>
        <Defs>
          <SvgLinearGradient id="titleMilk" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={milkFill} stopOpacity={0} />
            <Stop offset="0.12" stopColor={milkFill} stopOpacity={0.22} />
            <Stop offset="0.28" stopColor={milkFill} stopOpacity={0.58} />
            <Stop offset="0.5" stopColor={milkFill} stopOpacity={0.92} />
            <Stop offset="1" stopColor={milkFill} stopOpacity={1} />
          </SvgLinearGradient>
          <SvgLinearGradient id="titleSide" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={milkFill} stopOpacity={sideBoost * 0.85} />
            <Stop offset="0.4" stopColor={milkFill} stopOpacity={sideBoost * 0.4} />
            <Stop offset="0.72" stopColor={milkFill} stopOpacity={0} />
          </SvgLinearGradient>
          <RadialGradient
            id="titleMidGlow"
            cx={midGlowCx}
            cy={midGlowCy}
            rx={midGlowRx}
            ry={midGlowRy}
            fx={midGlowCx}
            fy={midGlowCy}
            gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={milkFill} stopOpacity={midGlowBoost} />
            <Stop offset="0.35" stopColor={milkFill} stopOpacity={midGlowBoost * 0.62} />
            <Stop offset="0.62" stopColor={milkFill} stopOpacity={midGlowBoost * 0.22} />
            <Stop offset="0.85" stopColor={milkFill} stopOpacity={midGlowBoost * 0.06} />
            <Stop offset="1" stopColor={milkFill} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={veilPath} fill="url(#titleMilk)" />
        <Path d={veilPath} fill="url(#titleSide)" />
        <Ellipse
          cx={midGlowCx}
          cy={midGlowCy}
          rx={midGlowRx}
          ry={midGlowRy}
          fill="url(#titleMidGlow)"
        />
      </Svg>
      <View style={[styles.chrome, { height: Math.min(height, fadeHeight) }]}>
        {children}
      </View>
    </View>
  );
}

function hexToRgba(hex: string, alpha: number): string | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const styles = StyleSheet.create({
  scoop: {
    // No overflow:hidden — breaks UIVisualEffect sampling of the hero.
    backgroundColor: 'transparent',
  },
  blurClip: {
    overflow: 'hidden',
  },
  blurBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 0,
  },
  bandBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  titleVeil: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  chrome: {
    zIndex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
});
