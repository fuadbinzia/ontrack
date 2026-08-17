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

export type CountryMapTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

type ViewBox = { x: number; y: number; width: number; height: number };
type Layout = { width: number; height: number };

function layoutScale(viewBox: ViewBox, layout: Layout): number {
  return Math.min(layout.width / viewBox.width, layout.height / viewBox.height);
}

function untransformLayoutPoint(
  location: { x: number; y: number },
  layout: Layout,
  transform: CountryMapTransform,
): { x: number; y: number } {
  const centerX = layout.width / 2;
  const centerY = layout.height / 2;
  const safeScale = Number.isFinite(transform.scale) ? transform.scale : 1;
  return {
    x: centerX + (location.x - transform.translateX - centerX) / safeScale,
    y: centerY + (location.y - transform.translateY - centerY) / safeScale,
  };
}

/**
 * Converts a layout-space tap into map-projected coordinates for an actively
 * zoom/panned map that was transformed about the layout center.
 */
export function layoutToProjectedPoint(
  location: { x: number; y: number },
  viewBox: ViewBox,
  layout: Layout,
  transform: CountryMapTransform,
): [number, number] | undefined {
  const scale = layoutScale(viewBox, layout);
  const paintedWidth = viewBox.width * scale;
  const paintedHeight = viewBox.height * scale;
  const offsetX = (layout.width - paintedWidth) / 2;
  const offsetY = (layout.height - paintedHeight) / 2;
  const point = untransformLayoutPoint(location, layout, transform);

  if (
    point.x < offsetX ||
    point.y < offsetY ||
    point.x > offsetX + paintedWidth ||
    point.y > offsetY + paintedHeight
  ) {
    return undefined;
  }

  return [
    viewBox.x + (point.x - offsetX) / scale,
    viewBox.y + (point.y - offsetY) / scale,
  ];
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
