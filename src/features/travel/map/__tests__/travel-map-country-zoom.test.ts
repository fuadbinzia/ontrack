import {
    COUNTRY_ZOOM_MAX,
    COUNTRY_ZOOM_MIN,
    clampCountryZoomScale,
    layoutToProjectedPoint,
    clampZoomTranslate,
    countryMarkerShift,
    countryZoomTranslateBound,
    pinchFocalTranslate,
    rubberBandZoomTranslate,
} from '../travel-map-country-zoom';

describe('travel map country zoom math', () => {
  it('clamps pinch scale into the usable range', () => {
    expect(clampCountryZoomScale(0.4)).toBe(COUNTRY_ZOOM_MIN);
    expect(clampCountryZoomScale(1)).toBe(1);
    expect(clampCountryZoomScale(2.5)).toBe(2.5);
    expect(clampCountryZoomScale(9)).toBe(COUNTRY_ZOOM_MAX);
  });

  it('allows no panning at base zoom so the map cannot drift off screen', () => {
    expect(countryZoomTranslateBound(1, 400)).toBe(0);
    expect(countryZoomTranslateBound(0.9, 400)).toBe(0);
  });

  it('grows the pan range with the zoomed overflow, half per side', () => {
    expect(countryZoomTranslateBound(2, 400)).toBe(200);
    expect(countryZoomTranslateBound(3, 800)).toBe(800);
  });

  it('moves freely inside bounds and resists past the edge', () => {
    expect(rubberBandZoomTranslate(120, 200)).toBe(120);
    expect(rubberBandZoomTranslate(-200, 200)).toBe(-200);
    const overshoot = rubberBandZoomTranslate(300, 200);
    expect(overshoot).toBeGreaterThan(200);
    expect(overshoot).toBeLessThan(300);
    const negativeOvershoot = rubberBandZoomTranslate(-300, 200);
    expect(negativeOvershoot).toBeLessThan(-200);
    expect(negativeOvershoot).toBeGreaterThan(-300);
  });

  it('settles hard clamps exactly onto the boundary', () => {
    expect(clampZoomTranslate(260, 200)).toBe(200);
    expect(clampZoomTranslate(-260, 200)).toBe(-200);
    expect(clampZoomTranslate(40, 200)).toBe(40);
  });

  it('keeps the pinch focal point anchored while the scale changes', () => {
    // Content point under the focal before zoom must stay under it after.
    const center = 200;
    const startTranslate = 30;
    const startFocal = 260;
    const scaleRatio = 2;
    const translate = pinchFocalTranslate({
      focal: startFocal,
      startFocal,
      center,
      startTranslate,
      scaleRatio,
    });
    // Content coordinate at the focal: center + start scale term.
    const contentAtFocal = (startFocal - center - startTranslate) / 1;
    expect(center + scaleRatio * contentAtFocal + translate).toBeCloseTo(
      startFocal,
    );
  });

  it('pans with two-finger focal drift at constant scale', () => {
    const translate = pinchFocalTranslate({
      focal: 300,
      startFocal: 260,
      center: 200,
      startTranslate: 10,
      scaleRatio: 1,
    });
    expect(translate).toBe(50);
  });

  it('keeps markers glued to their map point across zoom and pan', () => {
    // At rest the marker needs no shift.
    expect(countryMarkerShift(150, 200, 1, 0)).toBe(0);
    // Zoomed 2x about center: a point 50 pt left of center shifts 50 pt more.
    expect(countryMarkerShift(150, 200, 2, 0)).toBe(-50);
    // Pan adds directly on top.
    expect(countryMarkerShift(150, 200, 2, 30)).toBe(-20);
  });

  it('maps tapped screen points through active zoom/pan before projection', () => {
    const point = layoutToProjectedPoint(
      { x: 10, y: 30 },
      { x: 0, y: 0, width: 100, height: 50 },
      { width: 200, height: 100 },
      { scale: 2, translateX: 10, translateY: -20 },
    );

    expect(point?.[0]).toBeCloseTo(25, 6);
    expect(point?.[1]).toBeCloseTo(25, 6);
  });

  it('returns undefined when the tapped point is outside the painted country area', () => {
    expect(
      layoutToProjectedPoint(
        { x: -5, y: 50 },
        { x: 0, y: 0, width: 100, height: 50 },
        { width: 200, height: 100 },
        { scale: 1, translateX: 0, translateY: 0 },
      ),
    ).toBeUndefined();
  });
});
