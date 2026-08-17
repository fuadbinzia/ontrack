import { atlasCountryByCode } from '../country-data';
import {
    createTravelGlobeSnapshot,
    normalizeTravelGlobeRotation,
    TRAVEL_GLOBE_COAST_MAX_DEGREES_PER_SECOND,
    TRAVEL_GLOBE_INITIAL_ROTATION,
    travelGlobeCameraForLayout,
    travelGlobeCoastStep,
    travelGlobeCoastVelocity,
    travelGlobeCoordinateAtPoint,
    travelGlobeCoordinateVisible,
    travelGlobeDetailForMotion,
    travelGlobeFlickVelocity,
    travelGlobeRotationForCoordinate,
    travelGlobeUnzoomPoint,
} from '../globe-projection';

describe('travel globe projection', () => {
  it('renders Natural Earth countries against a circular sphere', () => {
    const snapshot = createTravelGlobeSnapshot(TRAVEL_GLOBE_INITIAL_ROTATION);

    expect(snapshot.spherePath).toContain('M');
    expect(snapshot.graticulePath).toContain('M');
    expect(snapshot.countries.length).toBeGreaterThan(160);
    expect(snapshot.countries.filter((country) => country.path).length).toBeGreaterThan(70);
  });

  it('clips marker centers on the far side of the globe', () => {
    expect(travelGlobeCoordinateVisible(0, 0, [0, 0, 0])).toBe(true);
    expect(travelGlobeCoordinateVisible(180, 0, [0, 0, 0])).toBe(false);
  });

  it('wraps longitude and restrains vertical rotation', () => {
    expect(normalizeTravelGlobeRotation([400, 90, 18])).toEqual([40, 65, 0]);
    expect(normalizeTravelGlobeRotation([-400, -90, -4])).toEqual([-40, -65, 0]);
  });

  it('starts with the user coordinate centered on the globe', () => {
    const newYork = travelGlobeRotationForCoordinate(-74.006, 40.7128);

    expect(newYork[0]).toBeCloseTo(74.006);
    expect(newYork[1]).toBeCloseTo(-40.7128);
    expect(newYork[2]).toBe(0);
    expect(travelGlobeCoordinateVisible(-74.006, 40.7128, newYork)).toBe(true);
  });

  it('normalizes location-centered rotation at geographic boundaries', () => {
    expect(travelGlobeRotationForCoordinate(200, 89)).toEqual([160, -65, 0]);
    expect(travelGlobeRotationForCoordinate(Number.NaN, 20)).toEqual(
      TRAVEL_GLOBE_INITIAL_ROTATION,
    );
  });

  it('inverts a tap at the camera center onto the faced country', () => {
    const france = atlasCountryByCode('FR');
    if (!france) throw new Error('missing atlas country FR');
    const rotation = travelGlobeRotationForCoordinate(
      france.geographicCenter[0],
      france.geographicCenter[1],
    );
    const camera = travelGlobeCameraForLayout({ width: 400, height: 800 });
    const coordinate = travelGlobeCoordinateAtPoint(
      camera.center[0],
      camera.center[1],
      rotation,
      camera,
    );
    expect(coordinate).toBeDefined();
    expect(coordinate!.longitude).toBeCloseTo(france.geographicCenter[0], 0);
    expect(coordinate!.latitude).toBeCloseTo(france.geographicCenter[1], 0);
  });

  it('returns undefined when a tap misses the sphere', () => {
    const camera = travelGlobeCameraForLayout({ width: 400, height: 800 });
    expect(
      travelGlobeCoordinateAtPoint(0, 0, TRAVEL_GLOBE_INITIAL_ROTATION, camera),
    ).toBeUndefined();
  });

  it('unzooms a tap around the camera center', () => {
    const camera = travelGlobeCameraForLayout({ width: 400, height: 800 });
    const [x, y] = travelGlobeUnzoomPoint(
      camera.center[0] + 20,
      camera.center[1],
      camera,
      2,
    );
    expect(x).toBeCloseTo(camera.center[0] + 10);
    expect(y).toBeCloseTo(camera.center[1]);
  });

  it('uses an edge-to-edge globe camera in both orientations', () => {
    const portrait = travelGlobeCameraForLayout({ width: 390, height: 844 });
    const landscape = travelGlobeCameraForLayout({ width: 844, height: 390 });

    expect(portrait.radius * 2).toBeGreaterThan(portrait.width);
    expect(portrait.radius * 2).toBeGreaterThan(portrait.height * 0.85);
    expect(landscape.radius * 2).toBeGreaterThanOrEqual(landscape.width);
    expect(landscape.radius * 2).toBeGreaterThan(landscape.height * 2);
  });

  it('ignores a soft release and clamps a violent flick', () => {
    expect(travelGlobeCoastVelocity(10, 0)).toBeUndefined();
    const clamped = travelGlobeCoastVelocity(4000, 0);
    expect(clamped).toEqual({
      x: TRAVEL_GLOBE_COAST_MAX_DEGREES_PER_SECOND,
      y: 0,
    });
  });

  it('inverts flick pitch so an upward swipe looks north', () => {
    const flick = travelGlobeFlickVelocity(200, -300, 0.34, 0.26);
    expect(flick).toBeDefined();
    expect(flick!.x).toBeCloseTo(68);
    expect(flick!.y).toBeCloseTo(78);
  });

  it('coasts with friction and slides along the pitch clamp', () => {
    const first = travelGlobeCoastStep([0, 0, 0], { x: 180, y: 0 }, 16);
    expect(first.done).toBe(false);
    expect(first.rotation[0]).toBeGreaterThan(0);
    expect(first.velocity.x).toBeLessThan(180);

    const againstPole = travelGlobeCoastStep(
      [0, 64, 0],
      { x: 80, y: 200 },
      16,
    );
    expect(againstPole.rotation[1]).toBe(65);
    expect(againstPole.velocity.y).toBe(0);
    expect(againstPole.velocity.x).toBeGreaterThan(0);
  });

  it('picks rest, motion, and fast path quality from the current gesture', () => {
    expect(
      travelGlobeDetailForMotion({
        dragging: false,
        coasting: false,
        spinning: false,
        warmedUp: true,
        fast: false,
      }),
    ).toBe('rest');
    expect(
      travelGlobeDetailForMotion({
        dragging: true,
        coasting: false,
        spinning: false,
        warmedUp: true,
        fast: false,
      }),
    ).toBe('motion');
    expect(
      travelGlobeDetailForMotion({
        dragging: false,
        coasting: true,
        spinning: false,
        warmedUp: true,
        fast: true,
      }),
    ).toBe('fast');
  });
});
