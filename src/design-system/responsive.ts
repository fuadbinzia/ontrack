/**
 * Width-based layout scale for phones.
 * Tokens in typography/spacing are authored for {@link BASE_WIDTH} (iPhone 14/15).
 * Use {@link windowScale} / {@link scaleSize} / {@link moderateScale} — or
 * `useResponsive()` — so chrome and controls shrink on SE-class widths and
 * grow modestly on Pro Max without blowing up tablets.
 */

export const BASE_WIDTH = 390;
/** Floor so SE / compact widths still stay readable. */
export const MIN_SCALE = 0.82;
/** Cap so large phones / landscape don't inflate chrome. */
export const MAX_SCALE = 1.08;

export function windowScale(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, width / BASE_WIDTH));
}

/** Linear scale (fonts, icon sizes, control heights). */
export function scaleSize(size: number, width: number): number {
  return round1(size * windowScale(width));
}

/**
 * Dampened scale for padding/gaps — keeps density stable while still
 * reacting to very small or large widths.
 */
export function moderateScale(size: number, width: number, factor = 0.45): number {
  const delta = size * windowScale(width) - size;
  return round1(size + delta * factor);
}

export function scaleTypographyToken<T extends { fontSize: number; lineHeight?: number; letterSpacing?: number }>(
  token: T,
  width: number,
): T {
  const next = { ...token };
  next.fontSize = scaleSize(token.fontSize, width);
  if (typeof token.lineHeight === 'number') {
    next.lineHeight = scaleSize(token.lineHeight, width);
  }
  if (typeof token.letterSpacing === 'number') {
    next.letterSpacing = round1(token.letterSpacing * windowScale(width));
  }
  return next;
}

/** Coarse phone size buckets for gutter / density decisions (not tablets). */
export type PhoneWidthClass = 'compact' | 'regular' | 'large';

export function widthClass(width: number): PhoneWidthClass {
  if (!Number.isFinite(width) || width <= 0) return 'regular';
  if (width <= 359) return 'compact';
  if (width >= 480) return 'large';
  return 'regular';
}

/** Screen-edge content gutter per width class (14 / 16 / 20). */
export function contentGutter(width: number): number {
  switch (widthClass(width)) {
    case 'compact':
      return 14;
    case 'large':
      return 20;
    default:
      return 16;
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
