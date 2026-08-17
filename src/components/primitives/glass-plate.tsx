import { BlurView } from 'expo-blur';
import {
    Platform,
    StyleSheet,
    View,
    type StyleProp,
    type ViewProps,
    type ViewStyle,
} from 'react-native';

import {
    glassDynamicTintMaterials,
    glassMaterials,
    glassMistWashStyle,
} from '@/design-system/glass';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useTheme } from '@/hooks/use-theme';

/** BlurView absoluteFill ignores parent radius unless the underlay is clipped too. */
function glassClipRadius(style?: StyleProp<ViewStyle>): number | undefined {
  const flat = StyleSheet.flatten(style);
  if (!flat) return undefined;
  if (typeof flat.borderRadius === 'number') return flat.borderRadius;
  const corners = [
    flat.borderTopLeftRadius,
    flat.borderTopRightRadius,
    flat.borderBottomLeftRadius,
    flat.borderBottomRightRadius,
  ].filter((value): value is number => typeof value === 'number');
  if (corners.length === 4 && corners.every((value) => value === corners[0])) {
    return corners[0];
  }
  return undefined;
}

export type GlassPlateProps = ViewProps & {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Override blur strength (iOS frosted). */
  intensity?: number;
  /**
   * Flip light/dark frost (e.g. dark glass CTA on a light meta panel).
   * Does not change the app theme — only this plate’s tint.
   */
  inverted?: boolean;
  /**
   * Solid paper plate for flat sky washes (itinerary chips / cards).
   * Skips BlurView — expo-blur’s light material reads as solid milk on paper.
   */
  clear?: boolean;
  /**
   * With `clear`: cool blue section wash instead of solid white paper.
   */
  wash?: boolean;
  /**
   * Soft atmosphere frost for circular FABs floating on sky / photos.
   */
  airy?: boolean;
  /**
   * Translucent nested chips (itinerary board cards / day stacks).
   * Theme-aware: white frost on dark boards, cool graphite wash on white.
   * Fill-only (no BlurView) — nested under section `overflow:hidden` kills iOS
   * UIVisualEffect and light BlurView paints opaque milk.
   */
  mist?: boolean;
  /**
   * Tinted glass accent. `green` = frosted sage CTA.
   * Ignored when `clear` is set. Overridden by `tintColor` when both set.
   */
  accent?: 'default' | 'green';
  /**
   * Dynamic artwork / brand hex (`#RGB` / `#RRGGBB`) for frosted fills.
   * Keeps glass translucent — never an opaque paper fill.
   * Ignored when `clear` is set.
   */
  tintColor?: string;
};

/**
 * Shared frosted glass plate for app chrome (sheets, cards, chips, CTAs).
 *
 * - Default (iOS): frosted BlurView (atmosphere-backed surfaces).
 * - Default (Android): translucent material wash.
 * - `clear`: solid white paper in light; soft wash in dark.
 * - `clear` + `wash`: cool blue section shell in light.
 * - `airy`: lighter frost for circular controls over sky / photos.
 * - `mist`: translucent nested frost (fill-only — safe under clipped parents).
 * - `tintColor`: artwork-matched translucent wash (travel itinerary shells).
 *
 * Blur is a sibling underlay (no React children inside BlurView). Always mount
 * BlurView when frosted (intensity 0 when blur gated) to avoid Fabric SIGABRTs.
 * Exception: `mist` never mounts BlurView (clipped ancestors → white milk on iOS).
 */
export function GlassPlate({
  children,
  style,
  intensity,
  inverted = false,
  clear = false,
  wash = false,
  airy = false,
  mist = false,
  accent = 'default',
  tintColor,
  ...rest
}: GlassPlateProps) {
  const theme = useTheme();
  const { allowsBlur } = usePerformanceTier();
  const g = glassMaterials;
  // `inverted` = dark plate for white ink (primary/danger CTAs) on any theme.
  // Never flip to a light fill in dark mode — white label + milk wash = invisible.
  const darkPlate = inverted || theme.name === 'dark';
  const invertedDark = inverted;
  // Android (and blur-gated tiers) paint fill-only glass — never pass blur
  // alphas when there is no BlurView frost, or artwork reads sharp through plates.
  const frostedFill = Platform.OS === 'ios' && allowsBlur;
  const dynamicTint =
    !clear && tintColor
      ? glassDynamicTintMaterials(tintColor, {
          mist,
          airy: mist ? false : airy,
          allowsBlur: frostedFill,
        })
      : undefined;
  const greenGlass = accent === 'green' && !clear && !mist && !dynamicTint;
  const greenOnLight = greenGlass && theme.name !== 'dark';
  const greenBorder = greenOnLight
    ? g.accentGreen.borderLight
    : g.accentGreen.border;
  const greenFillBlur = greenOnLight
    ? g.accentGreen.fillLight
    : g.accentGreen.fill;
  const greenFillSolid = greenOnLight
    ? g.accentGreen.fillLightFallback
    : g.accentGreen.fillFallback;

  if (clear) {
    const lightClear = wash ? styles.clearWashLight : styles.clearLight;
    return (
      <View
        {...rest}
        style={[
          styles.glass,
          darkPlate ? styles.clearDark : lightClear,
          style,
        ]}>
        {children}
      </View>
    );
  }

  // Mist chips sit inside section plates (`overflow: hidden`). Nested BlurView
  // is clipped on iOS and paints opaque white milk — fill only.
  if (mist) {
    const mistOnLight = theme.name !== 'dark';
    const mistBorder = dynamicTint
      ? dynamicTint.border
      : mistOnLight
        ? g.border.mistLight
        : g.border.mist;
    const mistFillStyle = dynamicTint
      ? { backgroundColor: dynamicTint.fill }
      : mistOnLight
        ? styles.mistTintLight
        : styles.mistTint;
    return (
      <View
        {...rest}
        collapsable={false}
        style={[
          styles.glass,
          {
            borderWidth: 1,
            borderColor: mistBorder,
            backgroundColor: 'transparent',
          },
          style,
        ]}>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { zIndex: 0 },
            mistFillStyle,
          ]}
        />
        {children}
      </View>
    );
  }

  if (Platform.OS === 'android') {
    const androidClipRadius = glassClipRadius(style);
    const androidUnderlayClip =
      androidClipRadius != null
        ? { borderRadius: androidClipRadius }
        : undefined;
    if (dynamicTint) {
      return (
        <View
          {...rest}
          collapsable={false}
          style={[
            styles.glass,
            {
              borderColor: dynamicTint.border,
              backgroundColor: 'transparent',
            },
            style,
          ]}>
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              androidUnderlayClip,
              { zIndex: 0, backgroundColor: dynamicTint.fill },
            ]}
          />
          {children}
        </View>
      );
    }
    const androidTint = greenGlass
      ? greenOnLight
        ? styles.androidTintGreenLight
        : styles.androidTintGreen
      : invertedDark
        ? airy
          ? styles.androidTintInvertedAiry
          : styles.androidTintInverted
        : darkPlate
          ? airy
            ? styles.androidTintDarkAiry
            : styles.androidTintDark
          : airy
            ? styles.androidTintLightAiry
            : styles.androidTintLight;
    return (
      <View
        {...rest}
        collapsable={false}
        style={[
          styles.glass,
          {
            borderColor: greenGlass
              ? greenBorder
              : darkPlate
                ? g.border.darkStrong
                : airy
                  ? 'rgba(255,255,255,0.55)'
                  : g.border.lightStrong,
            backgroundColor: 'transparent',
          },
          style,
        ]}>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            androidUnderlayClip,
            { zIndex: 0 },
            androidTint,
          ]}
        />
        {children}
      </View>
    );
  }

  const darkFill = invertedDark
    ? allowsBlur
      ? airy
        ? g.fill.invertedAiryBlur
        : g.fill.invertedBlur
      : airy
        ? g.fill.invertedAirySolid
        : g.fill.invertedSolid
    : airy
      ? allowsBlur
        ? g.fill.darkAiryBlur
        : g.fill.darkAirySolid
      : allowsBlur
        ? g.fill.darkBlur
        : g.fill.darkSolid;
  const lightFill = airy
    ? allowsBlur
      ? g.fill.lightAiryBlur
      : g.fill.lightAirySolid
    : allowsBlur
      ? g.fill.lightBlur
      : g.fill.lightSolid;
  const greenFill = allowsBlur ? greenFillBlur : greenFillSolid;
  const useDarkBlur =
    Boolean(dynamicTint?.darkMaterial) || greenGlass || darkPlate;
  const clipRadius = glassClipRadius(style);
  const underlayClip =
    clipRadius != null ? { borderRadius: clipRadius } : undefined;

  return (
    <View
      {...rest}
      collapsable={false}
      style={[
        styles.glass,
        {
          borderColor: dynamicTint
            ? dynamicTint.border
            : greenGlass
              ? greenBorder
              : darkPlate
                ? g.border.dark
                : airy
                  ? g.border.lightAiry
                  : g.border.light,
          // Keep the plate shell transparent — fill is a sibling underlay so
          // BlurView frost isn't smothered by an opaque parent background.
          backgroundColor: 'transparent',
        },
        style,
      ]}>
      <BlurView
        intensity={
          allowsBlur
            ? (intensity ??
              (dynamicTint
                ? airy
                  ? 40
                  : 46
                : greenGlass
                  ? 44
                  : darkPlate
                    ? airy
                      ? 36
                      : 40
                    : airy
                      ? 44
                      : 52))
            : 0
        }
        tint={useDarkBlur ? 'dark' : 'light'}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, underlayClip]}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          underlayClip,
          {
            backgroundColor: dynamicTint
              ? dynamicTint.fill
              : greenGlass
                ? greenFill
                : darkPlate
                  ? darkFill
                  : lightFill,
          },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  androidTintLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    experimental_backgroundImage:
      'linear-gradient(160deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.74) 45%, rgba(255,255,255,0.84) 100%)',
  },
  androidTintLightAiry: {
    backgroundColor: 'rgba(255, 255, 255, 0.76)',
    experimental_backgroundImage:
      'linear-gradient(160deg, rgba(255,255,255,0.86) 0%, rgba(255,255,255,0.66) 45%, rgba(255,255,255,0.78) 100%)',
  },
  /** Shared iOS+Android mist wash — never BlurView (clipped parents → milk). */
  mistTint: glassMistWashStyle.onDark,
  /** Nested mist on white itinerary boards — cool graphite, not white milk. */
  mistTintLight: glassMistWashStyle.onLight,
  androidTintDark: {
    backgroundColor: 'rgba(12, 16, 24, 0.62)',
    experimental_backgroundImage:
      'linear-gradient(160deg, rgba(36,42,54,0.7) 0%, rgba(12,16,24,0.54) 50%, rgba(8,12,18,0.66) 100%)',
  },
  androidTintDarkAiry: {
    backgroundColor: 'rgba(12, 16, 24, 0.5)',
    experimental_backgroundImage:
      'linear-gradient(160deg, rgba(36,42,54,0.58) 0%, rgba(12,16,24,0.42) 50%, rgba(8,12,18,0.54) 100%)',
  },
  androidTintInverted: {
    backgroundColor: 'rgba(12, 16, 24, 0.72)',
    experimental_backgroundImage:
      'linear-gradient(160deg, rgba(36,42,54,0.78) 0%, rgba(12,16,24,0.66) 50%, rgba(8,12,18,0.74) 100%)',
  },
  androidTintInvertedAiry: {
    backgroundColor: 'rgba(12, 16, 24, 0.58)',
    experimental_backgroundImage:
      'linear-gradient(160deg, rgba(36,42,54,0.64) 0%, rgba(12,16,24,0.5) 50%, rgba(8,12,18,0.6) 100%)',
  },
  androidTintGreen: {
    backgroundColor: glassMaterials.accentGreen.fill,
    experimental_backgroundImage:
      'linear-gradient(160deg, rgba(160,210,170,0.28) 0%, rgba(78,122,84,0.42) 48%, rgba(56,96,62,0.55) 100%)',
  },
  androidTintGreenLight: {
    backgroundColor: glassMaterials.accentGreen.fillLight,
    experimental_backgroundImage:
      'linear-gradient(160deg, rgba(160,210,170,0.36) 0%, rgba(78,122,84,0.68) 48%, rgba(56,96,62,0.78) 100%)',
  },
  clearLight: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glassMaterials.clear.lightBorder,
    backgroundColor: glassMaterials.clear.lightBg,
  },
  clearWashLight: {
    borderWidth: 1,
    borderColor: glassMaterials.clear.washLightBorder,
    backgroundColor: glassMaterials.clear.washLightBg,
    experimental_backgroundImage:
      'linear-gradient(160deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 36%, rgba(36,116,168,0.14) 100%)',
  },
  clearDark: {
    borderWidth: 1,
    borderColor: glassMaterials.clear.darkBorder,
    backgroundColor: glassMaterials.clear.darkBg,
    experimental_backgroundImage:
      'linear-gradient(165deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 40%, rgba(255,255,255,0.01) 100%)',
  },
});
