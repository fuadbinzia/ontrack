import { Image, type ImageContentFit, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

import { radii, type AppIconName } from '@/design-system';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useTheme } from '@/hooks/use-theme';

import { GlassPlate } from './glass-plate';
import { Symbol } from './symbol';

export interface FoodImageProps {
  /** Remote/local uri string, bundled `require(...)` asset, or undefined. */
  source?: string | number | ImageSource | null;
  /** Frame width : height (default 4:3). */
  aspectRatio?: number;
  /** Corner radius token key (default `lg`). */
  radius?: keyof typeof radii;
  contentFit?: ImageContentFit;
  accessibilityLabel?: string;
  /** Glyph on the glass placeholder while loading / on error / no source. */
  placeholderIcon?: AppIconName;
  /**
   * Neutral bottom scrim required before text is placed over photography
   * (Food design system §12). Never overlay text on a raw photo.
   */
  overlayGradient?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Overlay content (badges, scrim text) rendered above the gradient. */
  children?: ReactNode;
}

type LoadStatus = 'loading' | 'loaded' | 'error';

/**
 * Ink guaranteed readable over the `overlayGradient` scrim below — the scrim
 * is always dark, so overlay text must not follow theme ink (food dark theme
 * flips `textOnAccent` dark). Import these instead of hard-coding hex.
 */
export const FOOD_IMAGE_OVERLAY_INK = '#FDFBF7';
export const FOOD_IMAGE_OVERLAY_INK_SOFT = 'rgba(253, 251, 247, 0.78)';

const PULSE_MS = 900;

/**
 * Shared image frame for app content imagery (recipes, meals, covers).
 *
 * - Mist glass placeholder with a gentle pulse while loading (gated by the
 *   performance tier, so Reduce Motion / low-end devices get a static frost).
 * - Graceful fallback to `placeholderIcon` on error or missing source.
 * - Optional neutral scrim so overlaid text stays legible on photography.
 *
 * Prefer this over importing `expo-image` directly in feature screens.
 */
export function FoodImage({
  source,
  aspectRatio = 4 / 3,
  radius = 'lg',
  contentFit = 'cover',
  accessibilityLabel,
  placeholderIcon = 'food',
  overlayGradient = false,
  style,
  children,
}: FoodImageProps) {
  const theme = useTheme();
  const { allowsLoopMotion } = usePerformanceTier();
  const hasSource = source != null && source !== '';
  const [status, setStatus] = useState<LoadStatus>('loading');
  const sourceKey =
    typeof source === 'string' || typeof source === 'number'
      ? source
      : (source?.uri ?? undefined);

  useEffect(() => {
    setStatus('loading');
  }, [sourceKey]);

  const showPlaceholder = !hasSource || status !== 'loaded';
  const pulsing = hasSource && status === 'loading' && allowsLoopMotion;
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!pulsing) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = 0.55;
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, pulsing]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <GlassPlate
      mist
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.frame,
        { aspectRatio, borderRadius: radii[radius] },
        style,
      ]}>
      {hasSource && status !== 'error' ? (
        <Image
          source={source}
          contentFit={contentFit}
          transition={allowsLoopMotion ? 220 : 0}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {showPlaceholder ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.placeholder, pulseStyle]}>
          <Symbol name={placeholderIcon} size="lg" color={theme.textTertiary} />
        </Animated.View>
      ) : null}
      {overlayGradient ? (
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', 'rgba(20, 17, 14, 0.45)']}
          style={styles.scrim}
        />
      ) : null}
      {children}
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
});
