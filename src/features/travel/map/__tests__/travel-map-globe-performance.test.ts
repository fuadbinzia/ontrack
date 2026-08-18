import { atlasCountryByCode } from '../country-data';
import {
    createTravelGlobeSnapshot,
    travelGlobeCameraForLayout,
    travelGlobeCountryAngularRadius,
    travelGlobeCountryMaybeVisible,
    travelGlobeRotationForCoordinate,
    type TravelGlobeRotation,
} from '../globe-projection';

const CAMERA = travelGlobeCameraForLayout({ width: 400, height: 800 });

function rotationFacing(code: string): TravelGlobeRotation {
  const country = atlasCountryByCode(code);
  if (!country) throw new Error(`missing atlas country ${code}`);
  return travelGlobeRotationForCoordinate(
    country.geographicCenter[0],
    country.geographicCenter[1],
  );
}

function snapshotCountry(rotation: TravelGlobeRotation, code: string) {
  const snapshot = createTravelGlobeSnapshot(rotation, CAMERA);
  const entry = snapshot.countries.find(({ country }) => country.code === code);
  if (!entry) throw new Error(`missing snapshot country ${code}`);
  return entry;
}

describe('travel map globe frame cost', () => {
  it('skips path generation for countries fully behind the horizon', () => {
    // Facing New Zealand puts Portugal on the far side of the globe.
    const rotation = rotationFacing('NZ');
    expect(snapshotCountry(rotation, 'PT').path).toBe('');
    expect(snapshotCountry(rotation, 'PT').center).toBeUndefined();
    expect(snapshotCountry(rotation, 'NZ').path).not.toBe('');
  });

  it('still renders the faced country and its visible neighbors', () => {
    const rotation = rotationFacing('FR');
    expect(snapshotCountry(rotation, 'FR').path).not.toBe('');
    expect(snapshotCountry(rotation, 'FR').center).toBeDefined();
    expect(snapshotCountry(rotation, 'ES').path).not.toBe('');
  });

  it('never culls a country whose edge can still peek over the horizon', () => {
    // Russia spans half the planet; its centroid distance alone would cull it.
    const russia = atlasCountryByCode('RU');
    if (!russia) throw new Error('missing atlas country RU');
    const facingAlaska = travelGlobeRotationForCoordinate(-150, 62);
    expect(travelGlobeCountryMaybeVisible(russia, facingAlaska)).toBe(true);
    expect(snapshotCountry(facingAlaska, 'RU').path).not.toBe('');
  });

  it('caps angular radius work with a per-country cache', () => {
    const italy = atlasCountryByCode('IT');
    if (!italy) throw new Error('missing atlas country IT');
    const first = travelGlobeCountryAngularRadius(italy);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(Math.PI / 2);
    expect(travelGlobeCountryAngularRadius(italy)).toBe(first);
  });

  it('emits short one-decimal path strings so native parsing stays cheap', () => {
    const rotation = rotationFacing('BR');
    const snapshot = createTravelGlobeSnapshot(rotation, CAMERA);
    const sample = [
      snapshot.spherePath,
      snapshot.graticulePath,
      snapshotCountry(rotation, 'BR').path,
    ].join(' ');
    expect(sample.length).toBeGreaterThan(0);
    expect(sample).not.toMatch(/\d+\.\d{2,}/);
  });

  it('samples coarser geometry during motion than at rest', () => {
    const rotation = rotationFacing('US');
    const rest = createTravelGlobeSnapshot(rotation, CAMERA, 'rest');
    const inMotion = createTravelGlobeSnapshot(rotation, CAMERA, 'motion');
    const totalLength = (paths: string[]) =>
      paths.reduce((sum, path) => sum + path.length, 0);
    expect(
      totalLength(inMotion.countries.map(({ path }) => path)) +
        inMotion.graticulePath.length,
    ).toBeLessThanOrEqual(
      totalLength(rest.countries.map(({ path }) => path)) +
        rest.graticulePath.length,
    );
  });

  it('samples even coarser geometry during a fast flick than a slow pan', () => {
    const rotation = rotationFacing('US');
    const inMotion = createTravelGlobeSnapshot(rotation, CAMERA, 'motion');
    const fast = createTravelGlobeSnapshot(rotation, CAMERA, 'fast');
    const totalLength = (paths: string[]) =>
      paths.reduce((sum, path) => sum + path.length, 0);
    expect(
      totalLength(fast.countries.map(({ path }) => path)) +
        fast.graticulePath.length,
    ).toBeLessThanOrEqual(
      totalLength(inMotion.countries.map(({ path }) => path)) +
        inMotion.graticulePath.length,
    );
  });

  it('can skip marker-center projection while the map is in fast motion', () => {
    const rotation = rotationFacing('FR');
    const full = createTravelGlobeSnapshot(rotation, CAMERA, 'fast');
    const noCenters = createTravelGlobeSnapshot(rotation, CAMERA, 'fast', false);

    expect(
      full.countries.some((entry) => entry.center !== undefined),
    ).toBe(true);
    expect(
      noCenters.countries.every((entry) => entry.center === undefined),
    ).toBe(true);
  });
});
