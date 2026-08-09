import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { resolveActiveFontFamilies } from '@/design-system/font-presets';
import {
  contentGutter,
  MAX_SCALE,
  MIN_SCALE,
  moderateScale,
  scaleSize,
  scaleTypographyToken,
  widthClass,
  windowScale,
  type PhoneWidthClass,
} from '@/design-system/responsive';
import { iconSizes as baseIconSizes, layout as baseLayout, spacing as baseSpacing } from '@/design-system/spacing';
import { typography as baseTypography } from '@/design-system/typography';
import { useThemeOverrides } from '@/store/theme-overrides';

type TypographyScale = {
  [K in keyof typeof baseTypography]: {
    -readonly [P in keyof (typeof baseTypography)[K]]: (typeof baseTypography)[K][P];
  };
};

type SpacingScale = {
  [K in keyof typeof baseSpacing]: number;
};

type LayoutScale = {
  [K in keyof typeof baseLayout]: number;
};

type IconSizeScale = {
  [K in keyof typeof baseIconSizes]: number;
};

export interface ResponsiveTokens {
  /** Short side–biased width used for scaling (portrait-friendly). */
  width: number;
  /** Clamped width / BASE_WIDTH. */
  scale: number;
  /** Current accessibility text scale reported by the platform. */
  fontScale: number;
  /** Linear scale helper bound to the current window. */
  s: (size: number) => number;
  /** Moderate (dampened) scale for padding/gaps. */
  ms: (size: number, factor?: number) => number;
  /** Phone size bucket (compact ≤359, regular 360–479, large ≥480). */
  widthClass: PhoneWidthClass;
  /** Screen-edge content gutter for the width class, moderate-scaled. */
  gutter: number;
  typography: TypographyScale;
  spacing: SpacingScale;
  layout: LayoutScale;
  iconSizes: IconSizeScale;
}

function scaleRecord<T extends Record<string, number>>(
  record: T,
  map: (value: number) => number,
): { [K in keyof T]: number } {
  const next = {} as { [K in keyof T]: number };
  for (const key of Object.keys(record) as (keyof T)[]) {
    next[key] = map(record[key]);
  }
  return next;
}

/**
 * Screen-aware design tokens. Prefer this (or AppText / Button / Input /
 * Screen) over hard-coded fontSize / padding so compact phones don't wrap
 * chrome labels or overflow controls.
 */
export function useResponsive(): ResponsiveTokens {
  const { width, height, fontScale } = useWindowDimensions();
  // Prefer the narrower edge so landscape doesn't inflate type/chrome.
  const layoutWidth = Math.min(width, height);
  const fontOverrides = useThemeOverrides((state) => state.fonts);

  return useMemo(() => {
    const scale = windowScale(layoutWidth);
    const s = (size: number) => scaleSize(size, layoutWidth);
    const ms = (size: number, factor = 0.45) => moderateScale(size, layoutWidth, factor);
    const faces = resolveActiveFontFamilies(fontOverrides);

    const typography = Object.fromEntries(
      (Object.keys(baseTypography) as (keyof typeof baseTypography)[]).map((key) => {
        const scaled = scaleTypographyToken(baseTypography[key], layoutWidth);
        return [
          key,
          {
            ...scaled,
            fontFamily: key === 'mono' ? faces.monoFamily : faces.fontFamily,
          },
        ];
      }),
    ) as TypographyScale;

    return {
      width: layoutWidth,
      scale,
      fontScale,
      s,
      ms,
      widthClass: widthClass(layoutWidth),
      gutter: ms(contentGutter(layoutWidth)),
      typography,
      spacing: scaleRecord(baseSpacing, ms) as SpacingScale,
      layout: {
        screenPadding: ms(baseLayout.screenPadding),
        maxContentWidth: baseLayout.maxContentWidth,
        minTapTarget: Math.max(44, s(baseLayout.minTapTarget)),
        tabBarInset: ms(baseLayout.tabBarInset),
        bottomNavBarBaseHeight: ms(baseLayout.bottomNavBarBaseHeight),
      } satisfies LayoutScale,
      iconSizes: scaleRecord(baseIconSizes, s) as IconSizeScale,
    };
  }, [fontOverrides, fontScale, layoutWidth]);
}

export { MAX_SCALE, MIN_SCALE, windowScale, scaleSize, moderateScale };
