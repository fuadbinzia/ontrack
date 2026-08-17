/**
 * Pure zoom/pan math for the drilled-in country map. Everything here runs on
 * the UI thread inside gesture worklets, so keep it dependency-free.
 *
 * The map layer transform is `[translate, scale]` about the layout center:
 * screen = center + scale * (point - center) + translate.
 */

export const COUNTRY_ZOOM_MIN = 1;
export const COUNTRY_ZOOM_MAX = 4;

/** Resistance applied to pan overshoot past the map edge. */
const RUBBER_BAND_RESISTANCE = 0.35;

export function clampCountryZoomScale(scale: number): number {
  'worklet';
  return Math.max(COUNTRY_ZOOM_MIN, Math.min(COUNTRY_ZOOM_MAX, scale));
}

/** Max pan from center so a zoomed map can never be flung off screen. */
export function countryZoomTranslateBound(
  scale: number,
  extent: number,
): number {
  'worklet';
  return Math.max(0, ((scale - 1) * extent) / 2);
}

/** Full movement inside bounds; resisted rubber-band overshoot beyond them. */
export function rubberBandZoomTranslate(value: number, bound: number): number {
  'worklet';
  if (value > bound) return bound + (value - bound) * RUBBER_BAND_RESISTANCE;
  if (value < -bound) return -bound + (value + bound) * RUBBER_BAND_RESISTANCE;
  return value;
}

export function clampZoomTranslate(value: number, bound: number): number {
  'worklet';
  return Math.max(-bound, Math.min(bound, value));
}

/**
 * Translate that keeps the pinch focal point anchored under the fingers while
 * the scale changes (and lets two-finger drags pan via focal drift).
 */
export function pinchFocalTranslate(input: {
  focal: number;
  startFocal: number;
  center: number;
  startTranslate: number;
  scaleRatio: number;
}): number {
  'worklet';
  return (
    input.focal -
    input.center -
    input.scaleRatio * (input.startFocal - input.center - input.startTranslate)
  );
}

/**
 * Screen-space shift of a marker anchored at `base` when the map layer is
 * scaled/translated. Markers live outside the transformed layer so pins and
 * labels stay crisp and constant-size while the map zooms under them.
 */
export function countryMarkerShift(
  base: number,
  center: number,
  scale: number,
  translate: number,
): number {
  'worklet';
  return (scale - 1) * (base - center) + translate;
}
