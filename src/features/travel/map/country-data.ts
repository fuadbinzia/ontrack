import { geoCentroid, geoContains, geoEquirectangular, geoPath } from 'd3-geo';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { feature } from 'topojson-client';
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  Position,
} from 'geojson';
import type {
  Topology,
  GeometryCollection,
  GeometryObject as TopologyGeometry,
} from 'topojson-specification';

type CountryTopology = Topology<{
  countries: GeometryCollection<{ name?: string }>;
}>;

// Keep compact geometry for animated world views, then lazily expand Natural
// Earth's mid-resolution topology for the selected country. The 10m atlas only
// supplies small nations omitted by the 110m overview.
const overviewAtlas = require('world-atlas/countries-110m.json') as CountryTopology;
const countryAtlas = require('world-atlas/countries-50m.json') as CountryTopology;
const detailAtlas = require('world-atlas/countries-10m.json') as CountryTopology;

// Native SVG path parsing happens on the UI thread. Keep drill-down paths below
// this ceiling so large multi-polygons (notably the United States and Canada)
// cannot stall the app while still using more detail than the world overview.
export const TRAVEL_MAP_MAX_COUNTRY_PATH_LENGTH = 100_000;

countries.registerLocale(enLocale);

export const TRAVEL_MAP_VIEWBOX = { width: 1000, height: 520 } as const;
const TRAVEL_MAP_GEOMETRY_INSET = 12;
export const TRAVEL_MAP_INK = '#164B66';
export const TRAVEL_MAP_OCEAN_TOP = '#72D6E7';
export const TRAVEL_MAP_OCEAN_MIDDLE = '#39B8D2';
export const TRAVEL_MAP_OCEAN_BOTTOM = '#147EAE';
export const TRAVEL_MAP_LAND_COLORS = [
  '#F6D675',
  '#9ED68A',
  '#F3AA9E',
  '#A8D5EE',
  '#C8B5E6',
  '#F4BF79',
] as const;

type AtlasProperties = GeoJsonProperties & { name?: string };
export type AtlasCountryFeature = Feature<Geometry, AtlasProperties>;

const overviewCollection = feature(
  overviewAtlas,
  overviewAtlas.objects.countries,
) as unknown as FeatureCollection<Geometry, AtlasProperties>;

const projection = geoEquirectangular().fitExtent(
  [
    [TRAVEL_MAP_GEOMETRY_INSET, TRAVEL_MAP_GEOMETRY_INSET],
    [
      TRAVEL_MAP_VIEWBOX.width - TRAVEL_MAP_GEOMETRY_INSET,
      TRAVEL_MAP_VIEWBOX.height - TRAVEL_MAP_GEOMETRY_INSET,
    ],
  ],
  overviewCollection,
);
const path = geoPath(projection);

export interface AtlasCountry {
  code: string;
  numericCode: string;
  name: string;
  path: string;
  geographicCenter: [number, number];
  center: [number, number];
  bounds: [[number, number], [number, number]];
  feature: AtlasCountryFeature;
}

export interface AtlasCountryDetail {
  path: string;
  bounds: [[number, number], [number, number]];
  feature: AtlasCountryFeature;
}

function alpha2ForNumericCode(numeric: string): string | undefined {
  if (!numeric) return undefined;
  const code = countries.numericToAlpha2(numeric);
  return code && /^[A-Z]{2}$/.test(code) ? code : undefined;
}

function projectedBounds(country: AtlasCountryFeature): [[number, number], [number, number]] {
  const [[x0, y0], [x1, y1]] = path.bounds(country);
  return [[x0, y0], [x1, y1]];
}

function ringSignedArea(ring: Position[]): number {
  let area = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const from = ring[previous];
    const to = ring[index];
    area += (from?.[0] ?? 0) * (to?.[1] ?? 0) - (to?.[0] ?? 0) * (from?.[1] ?? 0);
  }
  return area / 2;
}

function normalizedRing(ring: Position[], exterior: boolean): Position[] {
  const area = ringSignedArea(ring);
  const hasExpectedWinding = exterior ? area <= 0 : area >= 0;
  return hasExpectedWinding ? ring : [...ring].reverse();
}

/**
 * d3's spherical paths require clockwise exterior rings. Natural Earth's
 * smallest atolls occasionally contain a reversed ring, which otherwise
 * paints the whole sphere as land (notably the Maldives).
 */
function normalizeCountryWinding(country: AtlasCountryFeature): AtlasCountryFeature {
  if (country.geometry.type === 'Polygon') {
    country.geometry.coordinates = country.geometry.coordinates.map((ring, index) =>
      normalizedRing(ring, index === 0),
    );
  } else if (country.geometry.type === 'MultiPolygon') {
    country.geometry.coordinates = country.geometry.coordinates.map((polygon) =>
      polygon.map((ring, index) => normalizedRing(ring, index === 0)),
    );
  }
  return country;
}

const OVERVIEW_BY_NUMERIC_CODE = new Map(
  overviewCollection.features.map((country) => [
    String(country.id).padStart(3, '0'),
    country,
  ] as const),
);
const DETAIL_GEOMETRY_BY_NUMERIC_CODE = new Map<
  string,
  TopologyGeometry<{ name?: string }>
>();
for (const geometry of countryAtlas.objects.countries.geometries) {
  const numericCode = String(geometry.id).padStart(3, '0');
  if (!DETAIL_GEOMETRY_BY_NUMERIC_CODE.has(numericCode)) {
    DETAIL_GEOMETRY_BY_NUMERIC_CODE.set(numericCode, geometry);
  }
}
const DETAIL_CACHE = new Map<string, AtlasCountryDetail>();

function topologyFeature(
  topology: CountryTopology,
  geometry: TopologyGeometry<{ name?: string }>,
): AtlasCountryFeature {
  return normalizeCountryWinding(
    feature(topology, geometry) as unknown as AtlasCountryFeature,
  );
}

function detailForNumericCode(
  numericCode: string,
  fallback: AtlasCountryFeature,
): AtlasCountryDetail {
  const cached = DETAIL_CACHE.get(numericCode);
  if (cached) return cached;
  const geometry = DETAIL_GEOMETRY_BY_NUMERIC_CODE.get(numericCode);
  const candidateFeature = geometry
    ? topologyFeature(countryAtlas, geometry)
    : undefined;
  const candidatePath = candidateFeature ? path(candidateFeature) || '' : '';
  let detailFeature = fallback;
  let detailPath = path(fallback) || '';
  if (
    candidateFeature &&
    candidatePath.length <= TRAVEL_MAP_MAX_COUNTRY_PATH_LENGTH
  ) {
    detailFeature = candidateFeature;
    detailPath = candidatePath;
  }
  const detail = {
    path: detailPath || path(fallback) || '',
    bounds: projectedBounds(detailFeature),
    feature: detailFeature,
  };
  DETAIL_CACHE.set(numericCode, detail);
  return detail;
}

const atlasNumericCodes = new Set<string>();

export const ATLAS_COUNTRIES: AtlasCountry[] = detailAtlas.objects.countries.geometries.flatMap((geometry) => {
  const numericCode = String(geometry.id).padStart(3, '0');
  const code = alpha2ForNumericCode(numericCode);
  if (!code || atlasNumericCodes.has(numericCode)) return [];
  const overviewFeature = OVERVIEW_BY_NUMERIC_CODE.get(numericCode);
  const country = overviewFeature ?? topologyFeature(detailAtlas, geometry);
  const detailProperties = geometry.properties as { name?: string } | undefined;
  const name = detailProperties?.name?.trim() || country.properties?.name?.trim();
  const d = path(country);
  const centerGeo = geoCentroid(country);
  const center = projection(centerGeo);
  if (!name || !d || !center) return [];
  atlasNumericCodes.add(numericCode);
  return [
    {
      code,
      numericCode,
      name: countries.getName(code, 'en') || name,
      path: d,
      geographicCenter: [centerGeo[0], centerGeo[1]] as [number, number],
      center: [center[0], center[1]] as [number, number],
      bounds: projectedBounds(country),
      feature: country,
    },
  ];
}).sort((a, b) => a.name.localeCompare(b.name));

const antarcticaBottom = ATLAS_COUNTRIES.find((country) => country.code === 'AQ')?.bounds[1][1];
export const TRAVEL_MAP_FLAT_VIEWBOX = {
  width: TRAVEL_MAP_VIEWBOX.width,
  height: antarcticaBottom ?? TRAVEL_MAP_VIEWBOX.height - TRAVEL_MAP_GEOMETRY_INSET,
} as const;

const BY_CODE = new Map(ATLAS_COUNTRIES.map((country) => [country.code, country]));

export function atlasCountryByCode(code: string | undefined): AtlasCountry | undefined {
  return code ? BY_CODE.get(code.trim().toUpperCase()) : undefined;
}

export function atlasCountryDetail(country: AtlasCountry): AtlasCountryDetail {
  return detailForNumericCode(country.numericCode, country.feature);
}

export function atlasCountryAtCoordinate(
  latitude: number,
  longitude: number,
): AtlasCountry | undefined {
  return ATLAS_COUNTRIES.find((country) =>
    geoContains(country.feature, [longitude, latitude]),
  );
}

export function atlasCountryContainsCoordinate(
  countryCode: string,
  latitude: number,
  longitude: number,
): boolean {
  const country = atlasCountryByCode(countryCode);
  return country
    ? geoContains(atlasCountryDetail(country).feature, [longitude, latitude])
    : false;
}

/** Converts a screen-pixel stroke into the current projected viewBox units. */
export function travelMapStrokeWidth(
  viewBox: { width: number; height: number },
  viewport: { width: number; height: number },
  pixels: number,
): number {
  const scale = Math.min(
    Math.max(1, viewport.width) / Math.max(1, viewBox.width),
    Math.max(1, viewport.height) / Math.max(1, viewBox.height),
  );
  return pixels / scale;
}

export function projectTravelCoordinate(
  latitude: number,
  longitude: number,
): [number, number] | undefined {
  const point = projection([longitude, latitude]);
  return point ? [point[0], point[1]] : undefined;
}

export function invertTravelCoordinate(
  x: number,
  y: number,
): { latitude: number; longitude: number } | undefined {
  const point = projection.invert?.([x, y]);
  if (!point) return undefined;
  return { longitude: point[0], latitude: point[1] };
}

export function countryViewBox(country: AtlasCountry, aspectRatio = 1) {
  // Frame from the stable overview geometry. Higher-resolution multi-polygons
  // can include tiny antimeridian fragments whose bounds span almost the whole
  // projection (the United States has one near the far-right map edge).
  const [[x0, y0], [x1, y1]] = country.bounds;
  const countryWidth = Math.max(1, x1 - x0);
  const countryHeight = Math.max(1, y1 - y0);
  const padding = Math.max(4, Math.min(18, Math.max(countryWidth, countryHeight) * 0.14));
  const centerX = (x0 + x1) / 2;
  const centerY = (y0 + y1) / 2;
  const safeAspectRatio = Math.max(0.35, Math.min(3, aspectRatio));
  let width = countryWidth + padding * 2;
  let height = countryHeight + padding * 2;

  if (width / height < safeAspectRatio) width = height * safeAspectRatio;
  else height = width / safeAspectRatio;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}
