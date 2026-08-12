import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';
const OUTPUT_URL = new URL(
  '../src/features/travel/map/natural-earth-cities.json',
  import.meta.url,
);
const MAX_CITIES_PER_COUNTRY = 24;
const EXCLUDED_COUNTRY_CODES = new Set([
  // Natural Earth represents Antarctic research facilities with the operating
  // nation as their place name. Antarctica has no cities, so those labels do
  // not belong in the Travel Atlas city layer.
  'AQ',
]);

const response = await fetch(SOURCE_URL);
if (!response.ok) {
  throw new Error(`Natural Earth city download failed (${response.status}).`);
}

const collection = await response.json();
if (!Array.isArray(collection?.features)) {
  throw new Error('Natural Earth city data did not contain a feature collection.');
}

const byCountry = new Map();
for (const feature of collection.features) {
  const properties = feature?.properties ?? {};
  const countryCode = String(properties.iso_a2 ?? '').trim().toUpperCase();
  const name = String(properties.namepar || properties.name || '').trim();
  const coordinates = feature?.geometry?.coordinates;
  if (
    !/^[A-Z]{2}$/.test(countryCode)
    || EXCLUDED_COUNTRY_CODES.has(countryCode)
    || !name
    || !Array.isArray(coordinates)
  ) continue;

  const longitude = Number(properties.longitude ?? coordinates[0]);
  const latitude = Number(properties.latitude ?? coordinates[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

  const cities = byCountry.get(countryCode) ?? [];
  cities.push({
    countryCode,
    name,
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    population: Math.max(0, Math.round(Number(properties.pop_max) || 0)),
    rank: Math.max(0, Math.round(Number(properties.scalerank) || 10)),
    capital: properties.adm0cap === 1,
  });
  byCountry.set(countryCode, cities);
}

const output = [];
for (const countryCities of byCountry.values()) {
  const unique = new Map();
  for (const city of countryCities) {
    const key = city.name.toLocaleLowerCase();
    const current = unique.get(key);
    if (
      !current
      || (city.capital && !current.capital)
      || city.population > current.population
    ) {
      unique.set(key, city);
    }
  }
  output.push(
    ...[...unique.values()]
      .sort(
        (left, right) =>
          Number(right.capital) - Number(left.capital)
          || left.rank - right.rank
          || right.population - left.population,
      )
      .slice(0, MAX_CITIES_PER_COUNTRY),
  );
}

output.sort(
  (left, right) =>
    left.countryCode.localeCompare(right.countryCode)
    || Number(right.capital) - Number(left.capital)
    || left.rank - right.rank
    || right.population - left.population,
);

await writeFile(fileURLToPath(OUTPUT_URL), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${output.length} Travel Atlas cities to ${fileURLToPath(OUTPUT_URL)}.`);
