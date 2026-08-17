import { atlasCountryByCode } from '../country-data';
import {
    createTravelGlobeSnapshot,
    normalizeTravelGlobeRotation,
    TRAVEL_GLOBE_INITIAL_ROTATION,
    travelGlobeCameraForLayout,
    travelGlobeCoordinateAtPoint,
    travelGlobeCoordinateVisible,
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
});
