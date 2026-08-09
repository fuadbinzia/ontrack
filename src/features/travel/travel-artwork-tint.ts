/**
 * Artwork → itinerary glass tint.
 * Uses the lightest usable hue from the plate / sky so frosted shells match
 * the artwork without tipping into dark milk that fights body copy.
 */

import { glassDynamicTintMaterials } from '@/design-system/glass';
import {
  ATMOSPHERE_HEADER_BRIGHT_LUMA,
  parseHexRgb,
  relativeLuminanceFromHex,
} from '@/features/travel/travel-home-atmosphere-ink';
import { destinationShowsAurora } from '@/features/travel/travel-sky-aurora-destinations';
import { type HeaderSkyLook } from '@/features/travel/travel-sky-condition';

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

/**
 * Lift dark plate/chrome samples toward a light pastel of the same hue so
 * glass fills stay readable (dark ink) while still tracking the artwork.
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
 * @deprecated Prefer {@link lightenArtworkTintForGlass} — glass uses light tints.
 * Kept for callers/tests that still name deepen; now lifts instead of crushing.
 */
export function deepenArtworkTintForGlass(hex: string): string {
  return lightenArtworkTintForGlass(hex);
}

/**
 * Light sky-family stops for live SVG plates (status chrome stays dark;
 * itinerary glass prefers these mist hues).
 */
export function headerSkyLightTintColor(options: {
  themeDark: boolean;
  look: HeaderSkyLook;
  destination?: string;
}): string {
  if (options.themeDark || options.look.startsWith('night')) {
    if (destinationShowsAurora(options.destination ?? '')) {
      // Iceland / aurora veil — cool mist teal, not the dark status chrome.
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

/**
 * Prefer the lightest usable tint among plate sample + sky light stop so glass
 * matches artwork without dark fills. Live SVG uses the light sky mist (not
 * status-bar chrome).
 */
export function resolveTravelArtworkTintHex(options: {
  averageColor?: string;
  themeDark: boolean;
  look: HeaderSkyLook;
  destination?: string;
}): string {
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
