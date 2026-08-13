import {
  geoDistance,
  geoGraticule10,
  geoOrthographic,
  geoPath,
} from 'd3-geo';

import { ATLAS_COUNTRIES, type AtlasCountry } from './country-data';

export const TRAVEL_GLOBE_INITIAL_ROTATION: TravelGlobeRotation = [-18, -10, 0];

export type TravelGlobeRotation = [number, number, number];

export type TravelGlobeCamera = {
  width: number;
  height: number;
  center: [number, number];
  radius: number;
};

export type TravelGlobeCountryShape = {
  country: AtlasCountry;
  path: string;
  center?: [number, number];
};

export type TravelGlobeSnapshot = {
  spherePath: string;
  graticulePath: string;
  countries: TravelGlobeCountryShape[];
};

const SPHERE = { type: 'Sphere' } as const;
const GRATICULE = geoGraticule10();
const HALF_PI = Math.PI / 2;

function wrapLongitude(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function normalizeTravelGlobeRotation(
  rotation: readonly number[],
): TravelGlobeRotation {
  return [
    wrapLongitude(rotation[0] ?? 0),
    Math.max(-65, Math.min(65, rotation[1] ?? 0)),
    0,
  ];
}

/** D3 rotation is the inverse of the geographic coordinate at screen center. */
export function travelGlobeRotationForCoordinate(
  longitude: number,
  latitude: number,
): TravelGlobeRotation {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return TRAVEL_GLOBE_INITIAL_ROTATION;
  }
  return normalizeTravelGlobeRotation([-longitude, -latitude, 0]);
}

export function travelGlobeCoordinateVisible(
  longitude: number,
  latitude: number,
  rotation: TravelGlobeRotation,
  horizonInset = 0,
): boolean {
  const visibleCenter: [number, number] = [-rotation[0], -rotation[1]];
  return geoDistance([longitude, latitude], visibleCenter) < HALF_PI - horizonInset;
}

/**
 * Google Earth-style camera: the sphere is the canvas, not an object floating
 * inside it. Portrait crops the globe at the sides; landscape crops it above
 * and below so the map remains edge-to-edge.
 */
export function travelGlobeCameraForLayout(
  layout: { width: number; height: number },
): TravelGlobeCamera {
  const width = Math.max(1, layout.width);
  const height = Math.max(1, layout.height);
  const landscape = width > height;
  const radius = landscape
    ? Math.max(height * 0.68, width * 0.5)
    : Math.max(width * 0.78, height * 0.46);
  return {
    width,
    height,
    center: [width / 2, height * (landscape ? 0.52 : 0.55)],
    radius,
  };
}

export function createTravelGlobeSnapshot(
  rotation: TravelGlobeRotation,
  camera: TravelGlobeCamera = travelGlobeCameraForLayout({ width: 600, height: 600 }),
): TravelGlobeSnapshot {
  const projection = geoOrthographic()
    .translate(camera.center)
    .scale(camera.radius)
    .clipAngle(90)
    .precision(0.35)
    .rotate(rotation);
  const path = geoPath(projection);

  return {
    spherePath: path(SPHERE) ?? '',
    graticulePath: path(GRATICULE) ?? '',
    countries: ATLAS_COUNTRIES.map((country) => {
      const countryPath = path(country.feature) ?? '';
      const visible = travelGlobeCoordinateVisible(
        country.geographicCenter[0],
        country.geographicCenter[1],
        rotation,
        0.08,
      );
      const projected = visible ? projection(country.geographicCenter) : null;
      return {
        country,
        path: countryPath,
        center: projected
          ? [projected[0], projected[1]] as [number, number]
          : undefined,
      };
    }),
  };
}
