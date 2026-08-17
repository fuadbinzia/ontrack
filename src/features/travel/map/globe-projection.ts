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

/** Coarser path sampling while the globe moves; full detail at rest. */
export type TravelGlobeDetail = 'fast' | 'motion' | 'rest';

const DETAIL_PRECISION: Record<TravelGlobeDetail, number> = {
  // Fast flick spins trade coastline detail for frame rate — the geometry is
  // a blur to the eye at those speeds anyway.
  fast: 1.6,
  motion: 0.8,
  rest: 0.35,
};

/** One fractional digit keeps native SVG path parsing cheap at phone scale. */
export const TRAVEL_GLOBE_PATH_DIGITS = 1;

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

/** Flicks below this feel like a stop, not a spin — no coast. */
export const TRAVEL_GLOBE_COAST_START_DEGREES_PER_SECOND = 34;
/** Coast ends once the spin is imperceptibly slow. */
export const TRAVEL_GLOBE_COAST_STOP_DEGREES_PER_SECOND = 5;
/** A violent flick still stays trackable — about 1.6 turns per second max. */
export const TRAVEL_GLOBE_COAST_MAX_DEGREES_PER_SECOND = 580;
/** Exponential friction — a max-speed flick carries roughly a third turn. */
export const TRAVEL_GLOBE_COAST_TIME_CONSTANT_MS = 550;

export type TravelGlobeCoastVelocity = { x: number; y: number };

/**
 * Release velocity (already in deg/s) → clamped coast velocity, or undefined
 * when the flick is too soft to keep spinning.
 */
export function travelGlobeCoastVelocity(
  degreesPerSecondX: number,
  degreesPerSecondY: number,
): TravelGlobeCoastVelocity | undefined {
  const speed = Math.hypot(degreesPerSecondX, degreesPerSecondY);
  if (
    !Number.isFinite(speed) ||
    speed < TRAVEL_GLOBE_COAST_START_DEGREES_PER_SECOND
  ) {
    return undefined;
  }
  const scale = Math.min(1, TRAVEL_GLOBE_COAST_MAX_DEGREES_PER_SECOND / speed);
  return { x: degreesPerSecondX * scale, y: degreesPerSecondY * scale };
}

/**
 * One frame of momentum: advance the rotation, decay the velocity, and zero
 * the pitch component once the ±65° clamp bites so the globe slides along the
 * pole instead of grinding into it.
 */
export function travelGlobeCoastStep(
  rotation: TravelGlobeRotation,
  velocity: TravelGlobeCoastVelocity,
  deltaMs: number,
): {
  rotation: TravelGlobeRotation;
  velocity: TravelGlobeCoastVelocity;
  done: boolean;
} {
  // Hitch guard: a dropped-frame burst must not teleport the globe.
  const clampedMs = Math.min(Math.max(deltaMs, 0), 64);
  const dt = clampedMs / 1000;
  const rawPitch = rotation[1] + velocity.y * dt;
  const next = normalizeTravelGlobeRotation([
    rotation[0] + velocity.x * dt,
    rawPitch,
    0,
  ]);
  const decay = Math.exp(-clampedMs / TRAVEL_GLOBE_COAST_TIME_CONSTANT_MS);
  const nextVelocity = {
    x: velocity.x * decay,
    y: rawPitch === next[1] ? velocity.y * decay : 0,
  };
  const done =
    Math.hypot(nextVelocity.x, nextVelocity.y) <
    TRAVEL_GLOBE_COAST_STOP_DEGREES_PER_SECOND;
  return { rotation: next, velocity: nextVelocity, done };
}

/** Above this, drag/coast frames drop to the extra-coarse `fast` path. */
export const TRAVEL_GLOBE_FAST_DEGREES_PER_SECOND = 110;

export function travelGlobeDetailForMotion({
  dragging,
  coasting,
  spinning,
  warmedUp,
  fast,
}: {
  dragging: boolean;
  coasting: boolean;
  spinning: boolean;
  warmedUp: boolean;
  fast: boolean;
}): TravelGlobeDetail {
  if ((dragging || coasting) && fast) return 'fast';
  if (dragging || coasting || spinning || !warmedUp) return 'motion';
  return 'rest';
}

/**
 * Gesture px/s → globe deg/s. Pitch is inverted so an upward flick looks
 * north, matching `rotationForDrag`.
 */
export function travelGlobeFlickVelocity(
  pixelVelocityX: number,
  pixelVelocityY: number,
  degreesPerPixelX: number,
  degreesPerPixelY: number,
): TravelGlobeCoastVelocity | undefined {
  return travelGlobeCoastVelocity(
    pixelVelocityX * degreesPerPixelX,
    -pixelVelocityY * degreesPerPixelY,
  );
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

const COUNTRY_ANGULAR_RADIUS = new Map<string, number>();
/** Great-circle arcs between vertices can bow slightly past the vertex hull. */
const CULL_MARGIN = 0.05;

/** Max angular distance from the centroid to any outline vertex, cached. */
export function travelGlobeCountryAngularRadius(country: AtlasCountry): number {
  const cached = COUNTRY_ANGULAR_RADIUS.get(country.code);
  if (cached != null) return cached;
  const { geometry } = country.feature;
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : [];
  let radius = 0;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const position of ring) {
        const distance = geoDistance(
          [position[0] ?? 0, position[1] ?? 0],
          country.geographicCenter,
        );
        if (distance > radius) radius = distance;
      }
    }
  }
  const padded = radius + CULL_MARGIN;
  COUNTRY_ANGULAR_RADIUS.set(country.code, padded);
  return padded;
}

/**
 * Cheap horizon test so fully hidden countries skip projected-path generation
 * entirely — roughly halves the per-frame work while the globe rotates.
 */
export function travelGlobeCountryMaybeVisible(
  country: AtlasCountry,
  rotation: TravelGlobeRotation,
): boolean {
  const visibleCenter: [number, number] = [-rotation[0], -rotation[1]];
  return (
    geoDistance(country.geographicCenter, visibleCenter) -
      travelGlobeCountryAngularRadius(country) <
    HALF_PI
  );
}

/**
 * Google Earth-style camera: the sphere is the canvas, not an object floating
 * inside it. Portrait crops the globe at the sides; landscape crops it above
 * and below so the map remains edge-to-edge.
 */
/** Undo a center-origin zoom so a tap lands on the same globe point. */
export function travelGlobeUnzoomPoint(
  x: number,
  y: number,
  camera: TravelGlobeCamera,
  scale: number,
): [number, number] {
  const safeScale = Number.isFinite(scale) && scale !== 0 ? scale : 1;
  return [
    camera.center[0] + (x - camera.center[0]) / safeScale,
    camera.center[1] + (y - camera.center[1]) / safeScale,
  ];
}

/** Screen point → geographic coordinate, or undefined when the tap misses the sphere. */
export function travelGlobeCoordinateAtPoint(
  x: number,
  y: number,
  rotation: TravelGlobeRotation,
  camera: TravelGlobeCamera,
): { latitude: number; longitude: number } | undefined {
  const dx = x - camera.center[0];
  const dy = y - camera.center[1];
  if (dx * dx + dy * dy > camera.radius * camera.radius) return undefined;
  const projection = geoOrthographic()
    .translate(camera.center)
    .scale(camera.radius)
    .clipAngle(90)
    .rotate(rotation);
  const inverted = projection.invert?.([x, y]);
  if (
    !inverted ||
    !Number.isFinite(inverted[0]) ||
    !Number.isFinite(inverted[1])
  ) {
    return undefined;
  }
  return { longitude: inverted[0], latitude: inverted[1] };
}

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
  detail: TravelGlobeDetail = 'rest',
  includeCenters = true,
): TravelGlobeSnapshot {
  const projection = geoOrthographic()
    .translate(camera.center)
    .scale(camera.radius)
    .clipAngle(90)
    .precision(DETAIL_PRECISION[detail])
    .rotate(rotation);
  const path = geoPath(projection).digits(TRAVEL_GLOBE_PATH_DIGITS);
  const showGraticule = detail !== 'fast';

  return {
    spherePath: path(SPHERE) ?? '',
    graticulePath: showGraticule ? path(GRATICULE) ?? '' : '',
    countries: ATLAS_COUNTRIES.map((country) => {
      if (!travelGlobeCountryMaybeVisible(country, rotation)) {
        return { country, path: '' };
      }
      const countryPath = path(country.feature) ?? '';
      const visible = travelGlobeCoordinateVisible(
        country.geographicCenter[0],
        country.geographicCenter[1],
        rotation,
        0.08,
      );
      const projected =
        includeCenters && visible ? projection(country.geographicCenter) : null;
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
