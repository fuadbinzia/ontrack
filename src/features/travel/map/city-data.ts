import cityData from './natural-earth-cities.json';

/**
 * Offline Natural Earth 1:10m populated places. The checked-in atlas is
 * preprocessed by scripts/generate-travel-map-cities.mjs, prioritizing each
 * country's capital and most prominent regional cities.
 */
export interface TravelMapCity {
  countryCode: string;
  name: string;
  latitude: number;
  longitude: number;
  population: number;
  rank: number;
  capital: boolean;
}

const cities = cityData as TravelMapCity[];
const citiesByCountry = new Map<string, TravelMapCity[]>();

for (const city of cities) {
  const countryCities = citiesByCountry.get(city.countryCode) ?? [];
  countryCities.push(city);
  citiesByCountry.set(city.countryCode, countryCities);
}

export function atlasCitiesForCountry(countryCode: string | undefined): readonly TravelMapCity[] {
  return countryCode ? citiesByCountry.get(countryCode.toUpperCase()) ?? [] : [];
}

function normalizeCitySearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();
}

export function searchAtlasCities(
  countryCode: string | undefined,
  query: string,
): readonly TravelMapCity[] {
  const needle = normalizeCitySearchValue(query);
  const countryCities = atlasCitiesForCountry(countryCode);
  if (!needle) return countryCities;
  return countryCities.filter((city) =>
    normalizeCitySearchValue(city.name).includes(needle),
  );
}

const toRadians = (degrees: number) => degrees * Math.PI / 180;

function cityDistanceScore(
  latitude: number,
  longitude: number,
  city: TravelMapCity,
): number {
  const latitudeDelta = toRadians(city.latitude - latitude);
  const longitudeDelta = toRadians(city.longitude - longitude);
  const startLatitude = toRadians(latitude);
  const cityLatitude = toRadians(city.latitude);
  const latitudeTerm = Math.sin(latitudeDelta / 2);
  const longitudeTerm = Math.sin(longitudeDelta / 2);
  return latitudeTerm * latitudeTerm
    + Math.cos(startLatitude) * Math.cos(cityLatitude) * longitudeTerm * longitudeTerm;
}

export function nearestAtlasCity(
  countryCode: string | undefined,
  latitude: number,
  longitude: number,
): TravelMapCity | undefined {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  let nearest: TravelMapCity | undefined;
  let nearestScore = Number.POSITIVE_INFINITY;
  for (const city of atlasCitiesForCountry(countryCode)) {
    const score = cityDistanceScore(latitude, longitude, city);
    if (score >= nearestScore) continue;
    nearest = city;
    nearestScore = score;
  }
  return nearest;
}
