/**
 * Shared glass / frost materials for app chrome.
 * iOS uses BlurView + these fills; Android uses wash gradients (no blur stack).
 */

import type { ViewStyle } from 'react-native';

import { radii } from './radii';

/** Parse `#rgb` / `#rrggbb` (or pass-through) into `rgba(...)`. */
export function colorWithAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (!hex.startsWith('#')) return color;
  const raw = hex.slice(1);
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : raw;
  if (full.length !== 6) return color;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return color;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const glassMaterials = {
  border: {
    light: 'rgba(255,255,255,0.65)',
    lightAiry: 'rgba(255,255,255,0.5)',
    lightStrong: 'rgba(255,255,255,0.7)',
    /** Bright rim so nested mist chips read as glass on dark boards. */
    mist: 'rgba(255,255,255,0.48)',
    /** Cool rim for nested mist chips on white itinerary boards. */
    mistLight: 'rgba(17, 74, 110, 0.12)',
    dark: 'rgba(255,255,255,0.2)',
    darkStrong: 'rgba(255,255,255,0.22)',
  },
  fill: {
    lightBlur: 'rgba(255, 255, 255, 0.32)',
    lightSolid: 'rgba(255, 255, 255, 0.78)',
    lightAiryBlur: 'rgba(255, 255, 255, 0.28)',
    lightAirySolid: 'rgba(255, 255, 255, 0.58)',
    /** Nested frost — thin enough that the dark board shows through. */
    mistBlur: 'rgba(255, 255, 255, 0.08)',
    mistSolid: 'rgba(255, 255, 255, 0.12)',
    /** Nested wash on white itinerary boards (graphite, not milk). */
    mistLightSolid: 'rgba(17, 40, 60, 0.06)',
    darkBlur: 'rgba(0, 0, 0, 0.32)',
    darkSolid: 'rgba(0, 0, 0, 0.55)',
    darkAiryBlur: 'rgba(0, 0, 0, 0.22)',
    darkAirySolid: 'rgba(0, 0, 0, 0.4)',
    invertedBlur: 'rgba(0, 0, 0, 0.58)',
    invertedSolid: 'rgba(0, 0, 0, 0.68)',
    /** Thinner black glass for itinerary shells (dates / notes / sections). */
    invertedAiryBlur: 'rgba(0, 0, 0, 0.36)',
    invertedAirySolid: 'rgba(0, 0, 0, 0.46)',
  },
  /** Frosted field pills on glass sheets. */
  field: {
    light: 'rgba(255, 255, 255, 0.68)',
    dark: 'rgba(255, 255, 255, 0.10)',
    borderLight: 'rgba(255, 255, 255, 0.78)',
    borderDark: 'rgba(255, 255, 255, 0.20)',
  },
  /** Sage accent (sheet primary CTA / View Itinerary). */
  accentGreen: {
    fill: 'rgba(78, 122, 84, 0.48)',
    fillFallback: 'rgba(78, 122, 84, 0.62)',
    border: 'rgba(180, 220, 185, 0.38)',
    fillLight: 'rgba(78, 122, 84, 0.72)',
    fillLightFallback: 'rgba(78, 122, 84, 0.82)',
    borderLight: 'rgba(78, 122, 84, 0.28)',
    solid: '#4E7A54',
    shadow: '0 6px 16px rgba(78,122,84,0.22)',
    shadowDark: '0 6px 18px rgba(78,122,84,0.42)',
  },
  clear: {
    lightBg: '#FFFFFF',
    lightBorder: 'rgba(17, 74, 110, 0.10)',
    washLightBg: 'rgba(36, 116, 168, 0.10)',
    washLightBorder: 'rgba(255,255,255,0.55)',
    darkBg: 'rgba(255,255,255,0.05)',
    darkBorder: 'rgba(255,255,255,0.22)',
  },
  /**
   * Page atmosphere under glass — enough chroma/luma delta that frosted
   * plates read as glass, not milk on flat paper. Editorial warm wash.
   */
  atmosphere: {
    // Soft editorial cream — keep chroma for frost, avoid a muddy top ditch.
    lightTop: '#E8DCCE',
    lightMid: '#EEE6DB',
    lightBottom: '#F4EFE8',
    lightOrb: 'rgba(196, 140, 90, 0.14)',
    lightCool: 'rgba(120, 148, 168, 0.12)',
    darkTop: '#241C18',
    darkMid: '#16131A',
    darkBottom: '#0C0B10',
    darkOrb: 'rgba(180, 120, 70, 0.22)',
    darkCool: 'rgba(70, 100, 130, 0.18)',
  },
  sheet: {
    /** Keep translucent enough that backdrop chroma reads through frost. */
    lightFillBlur: 'rgba(255, 255, 255, 0.42)',
    lightFillSolid: 'rgba(255, 255, 255, 0.82)',
    darkFillBlur: 'rgba(12, 16, 24, 0.42)',
    darkFillSolid: 'rgba(12, 16, 24, 0.78)',
  },
  nav: {
    lightFillBlur: 'rgba(255, 255, 255, 0.42)',
    lightFillSolid: 'rgba(247, 244, 238, 0.92)',
    darkFillBlur: 'rgba(12, 16, 24, 0.45)',
    darkFillSolid: 'rgba(14, 13, 18, 0.92)',
  },
} as const;

export function glassFieldBackground(appearance: 'light' | 'dark'): string {
  return appearance === 'dark' ? glassMaterials.field.dark : glassMaterials.field.light;
}

export function glassFieldBorder(appearance: 'light' | 'dark'): string {
  return appearance === 'dark'
    ? glassMaterials.field.borderDark
    : glassMaterials.field.borderLight;
}

/** Shared pad / radius shell for mist TonePill + MetaChip. */
export function glassMistPillShellStyle(options: {
  spacingSm: number;
  s: (n: number) => number;
}): ViewStyle {
  return {
    paddingHorizontal: options.spacingSm,
    paddingVertical: Math.max(3, options.s(4)),
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    flexShrink: 0,
  };
}

/**
 * Fill-only mist washes shared by GlassPlate / GlassSwitch / GlassIconWell.
 * Never BlurView — nested under `overflow:hidden` paints milk on iOS.
 */
export const glassMistWashStyle = {
  /** White frost on dark boards. */
  onDark: {
    backgroundColor: glassMaterials.fill.mistSolid,
    experimental_backgroundImage:
      'linear-gradient(165deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 42%, rgba(255,255,255,0.14) 100%)',
  },
  /** Cool graphite on light/cream boards. */
  onLight: {
    backgroundColor: glassMaterials.fill.mistLightSolid,
    experimental_backgroundImage:
      'linear-gradient(165deg, rgba(17,40,60,0.08) 0%, rgba(17,40,60,0.03) 42%, rgba(17,40,60,0.06) 100%)',
  },
  /** Bright white frost for IconWell on cream Settings/Card plates. */
  brightWell: {
    backgroundColor: 'rgba(255, 255, 255, 0.36)',
    experimental_backgroundImage:
      'linear-gradient(165deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.22) 48%, rgba(255,255,255,0.4) 100%)',
  },
} as const satisfies Record<string, ViewStyle>;

/** Relative luminance 0–1 for `#RGB` / `#RRGGBB` — undefined when not a hex. */
export function relativeLuminanceFromColor(color: string): number | undefined {
  const hex = color.trim();
  if (!hex.startsWith('#')) return undefined;
  const raw = hex.slice(1);
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : raw;
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return undefined;
  const r = Number.parseInt(full.slice(0, 2), 16) / 255;
  const g = Number.parseInt(full.slice(2, 4), 16) / 255;
  const b = Number.parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Artwork / brand hex → translucent glass underlay (not opaque paper).
 * Dark materials prefer dark BlurView tint + light ink on top.
 */
export function glassDynamicTintMaterials(
  hex: string,
  options?: {
    mist?: boolean;
    airy?: boolean;
    allowsBlur?: boolean;
  },
): { fill: string; border: string; darkMaterial: boolean } | undefined {
  const luma = relativeLuminanceFromColor(hex);
  if (luma === undefined) return undefined;
  const darkMaterial = luma < 0.55;
  const mist = options?.mist ?? false;
  const airy = options?.airy ?? !mist;
  const allowsBlur = options?.allowsBlur ?? true;

  if (mist) {
    return {
      fill: colorWithAlpha(hex, darkMaterial ? 0.22 : 0.14),
      border: colorWithAlpha(hex, darkMaterial ? 0.38 : 0.22),
      darkMaterial,
    };
  }

  const blurAlpha = darkMaterial
    ? airy
      ? 0.46
      : 0.54
    : airy
      ? 0.38
      : 0.46;
  const solidAlpha = darkMaterial
    ? airy
      ? 0.58
      : 0.66
    : airy
      ? 0.5
      : 0.58;
  return {
    fill: colorWithAlpha(hex, allowsBlur ? blurAlpha : solidAlpha),
    border: colorWithAlpha(
      hex,
      darkMaterial ? (airy ? 0.42 : 0.5) : airy ? 0.28 : 0.34,
    ),
    darkMaterial,
  };
}
