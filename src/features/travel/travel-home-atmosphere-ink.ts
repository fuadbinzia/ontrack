/** `light` = white header ink; `dark` = black header ink. */
export type TravelAtmosphereHeaderInk = 'light' | 'dark';

type ResolveHeaderInkArgs = {
  themeDark: boolean;
  /** Average / dominant plate color when known (Unsplash / curated). */
  averageColor?: string;
  /** Explicit curated plate tone — used only when no sample color. */
  curatedTone?: TravelAtmosphereHeaderInk;
};

/** Cool Travel wash fallback when the plate has no sampled color. */
const SOLO_SHADOW_FALLBACK_RGB = { r: 17, g: 74, b: 110 } as const;

/** Parse `#RRGGBB` / `#RGB` into 0–255 channels. */
export function parseHexRgb(
  hex: string,
): { r: number; g: number; b: number } | undefined {
  const raw = hex.trim().replace(/^#/, '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((ch) => `${ch}${ch}`)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return undefined;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

/** Relative luminance 0–1 from `#RRGGBB` / `#RGB`. */
export function relativeLuminanceFromHex(hex: string): number | undefined {
  const rgb = parseHexRgb(hex);
  if (!rgb) return undefined;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Bottom-biased card shadow tinted by the Travel home atmosphere plate.
 * Used when only one trip is on the launcher so the card still grounds on
 * empty page paper (multi-trip stacks already provide visual weight).
 */
export function travelHomeSoloTripCardShadow(options: {
  averageColor?: string;
  dark: boolean;
}): string {
  if (options.dark) {
    // Longer bottom cast — solo launcher has empty paper under the card.
    return '0 36px 72px rgba(0,0,0,0.58), 0 16px 36px rgba(0,0,0,0.48), 0 6px 14px rgba(0,0,0,0.36)';
  }
  const sampled = options.averageColor
    ? parseHexRgb(options.averageColor)
    : undefined;
  // Fallback is already a cool Travel wash shadow; sampled sky plates need
  // a pull toward ink so the cast still reads on white page paper.
  const rgb = sampled
    ? {
        r: Math.round(sampled.r * 0.32),
        g: Math.round(sampled.g * 0.4),
        b: Math.round(sampled.b * 0.52),
      }
    : SOLO_SHADOW_FALLBACK_RGB;
  // Soft far glow + mid lift + near contact — bias down so empty paper
  // under a single trip still feels grounded.
  return `0 36px 70px rgba(${rgb.r},${rgb.g},${rgb.b},0.34), 0 16px 34px rgba(${rgb.r},${rgb.g},${rgb.b},0.28), 0 6px 14px rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`;
}

/**
 * Bright day washes → black ink. Darker plates → white (black disappears on
 * busy mid/dark photo bands). Threshold sits under pale sky averages so
 * cloud-heavy headers flip before white-on-white washout.
 */
export const ATMOSPHERE_HEADER_BRIGHT_LUMA = 0.55;
/** Near-night / deep washes — always white ink. */
export const ATMOSPHERE_HEADER_DARK_LUMA = 0.28;
/**
 * Remote midtones at/above this prefer black ink (sky bands under-report
 * whole-plate averages; white glyphs disappear first).
 */
export const ATMOSPHERE_HEADER_MID_BRIGHT_LUMA = 0.42;

export function headerInkFromLuminance(
  luminance: number,
): TravelAtmosphereHeaderInk {
  return luminance > ATMOSPHERE_HEADER_BRIGHT_LUMA ? 'dark' : 'light';
}

/**
 * Pick white vs black header ink from the live atmosphere plate.
 * Default is white — black when the sample (or curated day plate) is bright.
 */
export function resolveAtmosphereHeaderInk({
  themeDark,
  averageColor,
  curatedTone,
}: ResolveHeaderInkArgs): TravelAtmosphereHeaderInk {
  if (themeDark) return 'light';

  if (averageColor) {
    const luma = relativeLuminanceFromHex(averageColor);
    if (luma !== undefined) {
      // Strong bright / night signals win over curated pins.
      if (
        luma > ATMOSPHERE_HEADER_BRIGHT_LUMA ||
        luma < ATMOSPHERE_HEADER_DARK_LUMA
      ) {
        return headerInkFromLuminance(luma);
      }
      // Ambiguous midtones: curated day plates (e.g. Guatemala) pin black ink
      // even when whole-plate averages sit under the bright threshold.
      if (curatedTone) return curatedTone;
      // Remote sky midtones — prefer black before white-on-cloud washout.
      return luma >= ATMOSPHERE_HEADER_MID_BRIGHT_LUMA ? 'dark' : 'light';
    }
  }

  if (curatedTone) return curatedTone;

  // Unknown remote / wiki plate with no sample — white is the safe default.
  return 'light';
}

export function atmosphereHeaderInkColors(tone: TravelAtmosphereHeaderInk): {
  ink: string;
  muted: string;
} {
  if (tone === 'light') {
    return { ink: '#FFFFFF', muted: 'rgba(255,255,255,0.82)' };
  }
  return { ink: '#000000', muted: '#1A1A1A' };
}

/**
 * Soft top-band veil behind Travel home header copy (status bar → tagline).
 * Opposes ink and scales with plate luminance — readable without glyph
 * drop shadows; scene stays recognizable (no hard pill).
 */
export function travelHomeAtmosphereHeaderScrimColors(
  ink: TravelAtmosphereHeaderInk,
  averageColor?: string,
): readonly [string, string, string, string] | null {
  const luma = averageColor
    ? relativeLuminanceFromHex(averageColor)
    : undefined;

  if (ink === 'light') {
    // Only skip on near-black night plates. Busy midtone sketches / skies
    // still need a status-bar veil (sampled average under-reports brightness).
    if (luma !== undefined && luma < 0.1) return null;
    const need =
      luma === undefined
        ? 0.48
        : Math.min(1, Math.max(0.28, (luma - 0.1) / 0.55));
    // Top-weighted: softest at status bar / title, still present through
    // the location caption, then soft-clear before Your Trips.
    const top = 0.26 + need * 0.22;
    const mid = 0.12 + need * 0.16;
    const low = 0.04 + need * 0.09;
    return [
      `rgba(0,0,0,${top.toFixed(2)})`,
      `rgba(0,0,0,${mid.toFixed(2)})`,
      `rgba(0,0,0,${low.toFixed(2)})`,
      'rgba(0,0,0,0)',
    ] as const;
  }

  // Black ink → white top veil (midtone skies / busy plates included —
  // ink choice already decided the glyphs need opposing wash).
  const need =
    luma === undefined
      ? 0.78
      : Math.min(1, Math.max(0.5, (luma - 0.2) / 0.55));
  const top = 0.48 + need * 0.34;
  const mid = 0.28 + need * 0.26;
  const low = 0.12 + need * 0.14;
  return [
    `rgba(255,255,255,${top.toFixed(2)})`,
    `rgba(255,255,255,${mid.toFixed(2)})`,
    `rgba(255,255,255,${low.toFixed(2)})`,
    'rgba(255,255,255,0)',
  ] as const;
}
