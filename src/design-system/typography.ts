import { Platform, type TextStyle } from 'react-native';

/**
 * App-wide type config. One UI face for everything readable; mono only for
 * technical/code. Weights stay regular unless callers pass `{ bold: true }`.
 */
export const typeConfig = {
  fontFamily: Platform.select({
    ios: 'ui-serif',
    android: 'serif',
    web: 'Georgia, "Times New Roman", serif',
    default: 'serif',
  }) as string,
  monoFamily: Platform.select({
    ios: 'ui-monospace',
    android: 'monospace',
    web: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    default: 'monospace',
  }) as string,
  weight: {
    regular: '400' as const,
    /** Only via `bold` / `appTextStyle(variant, { bold: true })`. */
    bold: '700' as const,
  },
} as const;

export type AppFontWeight = (typeof typeConfig.weight)[keyof typeof typeConfig.weight];

/**
 * Legacy aliases — both `sans` and `serif` resolve to {@link typeConfig.fontFamily}
 * so older StyleSheets still use the single app face.
 */
export const fontFamilies = {
  sans: typeConfig.fontFamily,
  serif: typeConfig.fontFamily,
  rounded: typeConfig.fontFamily,
  mono: typeConfig.monoFamily,
} as const;

type VariantMetrics = {
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

const variantMetrics = {
  display: { fontSize: 42, lineHeight: 48, letterSpacing: -0.9 },
  title: { fontSize: 34, lineHeight: 41, letterSpacing: -0.65 },
  heading: { fontSize: 23, lineHeight: 29, letterSpacing: -0.2 },
  subheading: { fontSize: 17, lineHeight: 23 },
  body: { fontSize: 15.5, lineHeight: 22 },
  /** Same size as body; weight stays regular — use `bold` when emphasis is needed. */
  bodyMedium: { fontSize: 15.5, lineHeight: 22 },
  callout: { fontSize: 14, lineHeight: 19 },
  caption: { fontSize: 12.5, lineHeight: 17 },
  overline: {
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 1.4,
  },
  metric: { fontSize: 38, lineHeight: 43 },
  mono: { fontSize: 13, lineHeight: 18 },
} as const satisfies Record<string, VariantMetrics>;

export type TypeVariant = keyof typeof variantMetrics;

export type AppTextStyleOptions = {
  /** Explicit emphasis — omitted/false keeps regular weight. */
  bold?: boolean;
};

/** Strict token used by the type scale and `useResponsive` scaling. */
export type AppTextToken = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: AppFontWeight;
  letterSpacing?: number;
};

function faceFor(variant: TypeVariant): string {
  return variant === 'mono' ? typeConfig.monoFamily : typeConfig.fontFamily;
}

function weightFor(bold?: boolean): AppFontWeight {
  return bold ? typeConfig.weight.bold : typeConfig.weight.regular;
}

/**
 * Shared text style for StyleSheets and non-AppText surfaces.
 * Always uses {@link typeConfig}; never bold unless `options.bold` is true.
 */
export function appTextStyle(variant: TypeVariant, options?: AppTextStyleOptions): AppTextToken {
  const metrics = variantMetrics[variant];
  const token: AppTextToken = {
    fontFamily: faceFor(variant),
    fontSize: metrics.fontSize,
    lineHeight: metrics.lineHeight,
    fontWeight: weightFor(options?.bold),
  };
  if ('letterSpacing' in metrics && metrics.letterSpacing != null) {
    token.letterSpacing = metrics.letterSpacing;
  }
  return token;
}

/** Convenience cast when spreading into StyleSheet entries. */
export function appTextStyleSheet(
  variant: TypeVariant,
  options?: AppTextStyleOptions,
): TextStyle {
  return appTextStyle(variant, options) as TextStyle;
}

/**
 * Editorial type scale. Every variant defaults to regular weight; use
 * {@link appTextStyle} / AppText `bold` for emphasis.
 */
export const typography = {
  display: appTextStyle('display'),
  title: appTextStyle('title'),
  heading: appTextStyle('heading'),
  subheading: appTextStyle('subheading'),
  body: appTextStyle('body'),
  bodyMedium: appTextStyle('bodyMedium'),
  callout: appTextStyle('callout'),
  caption: appTextStyle('caption'),
  overline: appTextStyle('overline'),
  metric: appTextStyle('metric'),
  mono: appTextStyle('mono'),
} as const;
