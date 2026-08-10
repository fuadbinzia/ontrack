/**
 * Artwork → itinerary glass tint.
 * Night / dark sky → dark frost + light ink. Day → light frost + dark ink.
 */

import { glassDynamicTintMaterials } from '@/design-system/glass';
import {
  ATMOSPHERE_HEADER_BRIGHT_LUMA,
  parseHexRgb,
  relativeLuminanceFromHex,
} from '@/features/travel/travel-home-atmosphere-ink';
import { destinationShowsAurora } from '@/features/travel/travel-sky-aurora-destinations';
import {
  headerSkyChromeColor,
  type HeaderSkyLook,
} from '@/features/travel/travel-sky-condition';

/** Normalize `#RGB` / `#RRGGBB` to `#RRGGBB` when valid. */
export function normalizeArtworkTintHex(hex: string): string | undefined {
  const rgb = parseHexRgb(hex);
  if (!rgb) return undefined;
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`.toUpperCase();
}

/** Highest-luminance hex among candidates (invalid entries skipped). */
export function pickLightestArtworkTint(
  ...candidates: Array<string | undefined | null>
): string | undefined {
  let best: string | undefined;
  let bestLuma = -1;
  for (const candidate of candidates) {
    const hex = candidate ? normalizeArtworkTintHex(candidate) : undefined;
    if (!hex) continue;
    const luma = relativeLuminanceFromHex(hex);
    if (luma === undefined) continue;
    if (luma > bestLuma) {
      best = hex;
      bestLuma = luma;
    }
  }
  return best;
}

/** Lowest-luminance hex among candidates (invalid entries skipped). */
export function pickDarkestArtworkTint(
  ...candidates: Array<string | undefined | null>
): string | undefined {
  let best: string | undefined;
  let bestLuma = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const hex = candidate ? normalizeArtworkTintHex(candidate) : undefined;
    if (!hex) continue;
    const luma = relativeLuminanceFromHex(hex);
    if (luma === undefined) continue;
    if (luma < bestLuma) {
      best = hex;
      bestLuma = luma;
    }
  }
  return best;
}

/**
 * Lift dark plate/chrome samples toward a light pastel of the same hue so
 * day glass stays readable with dark ink while still tracking the artwork.
 */
export function lightenArtworkTintForGlass(hex: string): string {
  const normalized = normalizeArtworkTintHex(hex);
  if (!normalized) return hex;
  const rgb = parseHexRgb(normalized);
  const luma = relativeLuminanceFromHex(normalized);
  if (!rgb || luma === undefined) return normalized;
  // Already a light frost candidate.
  if (luma >= 0.72) return normalized;
  // Mix toward white until ~0.78 relative luminance (gamma-aware enough).
  const target = 0.78;
  const t = Math.min(0.88, Math.max(0.35, (target - luma) / Math.max(0.08, 1 - luma)));
  const to = (n: number) =>
    Math.round(n + (255 - n) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`.toUpperCase();
}

/**
 * Crush bright plate samples toward a dark glass hue so night frost keeps
 * light ink and doesn’t wash out as milky white over the sky.
 */
export function deepenArtworkTintForGlass(hex: string): string {
  const normalized = normalizeArtworkTintHex(hex);
  if (!normalized) return hex;
  const rgb = parseHexRgb(normalized);
  const luma = relativeLuminanceFromHex(normalized);
  if (!rgb || luma === undefined) return normalized;
  // Already a dark glass candidate.
  if (luma <= 0.28) return normalized;
  const target = 0.18;
  const t = Math.min(0.88, Math.max(0.35, (luma - target) / Math.max(0.08, luma)));
  const to = (n: number) =>
    Math.round(n * (1 - t))
      .toString(16)
      .padStart(2, '0');
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`.toUpperCase();
}

/** Day sky-family stops for light itinerary frost. */
export function headerSkyLightTintColor(options: {
  themeDark: boolean;
  look: HeaderSkyLook;
  destination?: string;
}): string {
  if (options.themeDark || options.look.startsWith('night')) {
    // Night resolves via chrome (dark glass) — keep a cool mist for callers
    // that still ask for a light stop in isolation.
    if (destinationShowsAurora(options.destination ?? '')) {
      return '#B7CBD0';
    }
    return '#B4C0D0';
  }
  switch (options.look) {
    case 'sunrise':
      return '#F3DCC8';
    case 'sunset':
      return '#EFC4AE';
    case 'cloudy':
    case 'rain':
    case 'storm':
      return '#D5DEE6';
    default:
      return '#E4EEF5';
  }
}

function artworkGlassPrefersDarkPlate(options: {
  themeDark: boolean;
  look: HeaderSkyLook;
}): boolean {
  return options.themeDark || options.look.startsWith('night');
}

/**
 * Night / dark theme → dark sky chrome (+ deepened sample) for dark glass +
 * light ink. Day → lightest pastel frost for dark ink.
 */
export function resolveTravelArtworkTintHex(options: {
  averageColor?: string;
  themeDark: boolean;
  look: HeaderSkyLook;
  destination?: string;
}): string {
  if (artworkGlassPrefersDarkPlate(options)) {
    const chrome = headerSkyChromeColor({
      themeDark: options.themeDark,
      look: options.look,
      destination: options.destination,
    });
    const sampled = options.averageColor
      ? deepenArtworkTintForGlass(options.averageColor)
      : undefined;
    return pickDarkestArtworkTint(sampled, chrome) ?? chrome;
  }

  const lightSky = headerSkyLightTintColor({
    themeDark: options.themeDark,
    look: options.look,
    destination: options.destination,
  });
  const sampled = options.averageColor
    ? lightenArtworkTintForGlass(options.averageColor)
    : undefined;
  return pickLightestArtworkTint(sampled, lightSky) ?? lightSky;
}

/** True when artwork glass should carry light (white) ink. */
export function travelArtworkTintPrefersLightInk(
  hex: string | undefined,
): boolean {
  if (!hex) return false;
  const luma = relativeLuminanceFromHex(hex);
  if (luma === undefined) return false;
  return luma < ATMOSPHERE_HEADER_BRIGHT_LUMA;
}

export type TravelArtworkGlassRole = 'shell' | 'mist';

/** Translucent fill + rim — delegates to shared glass materials. */
export function travelArtworkGlassFill(
  hex: string,
  role: TravelArtworkGlassRole,
  options?: { airy?: boolean; allowsBlur?: boolean },
): { fill: string; border: string; darkMaterial: boolean } {
  return (
    glassDynamicTintMaterials(hex, {
      mist: role === 'mist',
      airy: options?.airy ?? role === 'shell',
      allowsBlur: options?.allowsBlur,
    }) ?? {
      fill: hex,
      border: hex,
      darkMaterial: travelArtworkTintPrefersLightInk(hex),
    }
  );
}
