import {
  ATLAS_COUNTRIES,
  TRAVEL_MAP_FLAT_VIEWBOX,
  TRAVEL_MAP_MAX_COUNTRY_PATH_LENGTH,
  atlasCountryAtCoordinate,
  atlasCountryByCode,
  atlasCountryContainsCoordinate,
  atlasCountryDetail,
  countryViewBox,
  invertTravelCoordinate,
  projectTravelCoordinate,
  travelMapStrokeWidth,
} from '../country-data';

describe('travel atlas country geometry', () => {
  it('bundles interactive Natural Earth country paths and ISO lookup', () => {
    expect(ATLAS_COUNTRIES.length).toBeGreaterThan(230);
    expect(new Set(ATLAS_COUNTRIES.map((country) => country.code)).size).toBe(
      ATLAS_COUNTRIES.length,
    );
    expect(atlasCountryByCode('IS')).toMatchObject({ code: 'IS', name: 'Iceland' });
    expect(atlasCountryByCode('AG')).toMatchObject({
      code: 'AG',
      name: 'Antigua and Barbuda',
    });
    expect(atlasCountryAtCoordinate(64.1466, -21.9426)?.code).toBe('IS');
    expect(atlasCountryContainsCoordinate('IS', 64.1466, -21.9426)).toBe(true);
    expect(atlasCountryContainsCoordinate('unknown', 64.1466, -21.9426)).toBe(false);
  });

  it('keeps the primary country geometry when an atlas repeats an ISO code', () => {
    expect(ATLAS_COUNTRIES.filter((country) => country.code === 'AU')).toHaveLength(1);
    expect(atlasCountryContainsCoordinate('AU', -33.8688, 151.2093)).toBe(true);
  });

  it('round-trips projected travel coordinates', () => {
    const point = projectTravelCoordinate(48.8566, 2.3522);
    expect(point).toBeDefined();
    const coordinate = point ? invertTravelCoordinate(point[0], point[1]) : undefined;
    expect(coordinate?.latitude).toBeCloseTo(48.8566, 5);
    expect(coordinate?.longitude).toBeCloseTo(2.3522, 5);
  });

  it('places Antarctica flush with the flat-map bottom edge', () => {
    const antarctica = atlasCountryByCode('AQ');
    expect(antarctica).toBeDefined();
    expect(antarctica?.bounds[1][1]).toBeCloseTo(TRAVEL_MAP_FLAT_VIEWBOX.height, 5);
  });

  it('fits small countries closely to the screen aspect ratio', () => {
    const iceland = atlasCountryByCode('IS');
    expect(iceland).toBeDefined();
    if (!iceland) return;
    const viewBox = countryViewBox(iceland, 2);
    const countryWidth = iceland.bounds[1][0] - iceland.bounds[0][0];

    expect(viewBox.width / viewBox.height).toBeCloseTo(2, 5);
    expect(countryWidth / viewBox.width).toBeGreaterThan(0.5);
  });

  it.each(['KN', 'AG'])('makes tiny island countries readable in portrait (%s)', (code) => {
    const country = atlasCountryByCode(code);
    expect(country).toBeDefined();
    if (!country) return;

    const viewBox = countryViewBox(country, 0.5);
    const countryWidth = country.bounds[1][0] - country.bounds[0][0];
    const countryHeight = country.bounds[1][1] - country.bounds[0][1];
    const paintedShare = Math.max(
      countryWidth / viewBox.width,
      countryHeight / viewBox.height,
    );

    expect(viewBox.width / viewBox.height).toBeCloseTo(0.5, 5);
    expect(paintedShare).toBeGreaterThan(0.25);
    expect(viewBox.x).toBeLessThan(country.bounds[0][0]);
    expect(viewBox.y).toBeLessThan(country.bounds[0][1]);
    expect(viewBox.x + viewBox.width).toBeGreaterThan(country.bounds[1][0]);
    expect(viewBox.y + viewBox.height).toBeGreaterThan(country.bounds[1][1]);
  });

  it('uses recognizable detail geometry for country drill-downs', () => {
    const iceland = atlasCountryByCode('IS');
    expect(iceland).toBeDefined();
    if (!iceland) return;
    const detail = atlasCountryDetail(iceland);

    expect(detail.path.length).toBeGreaterThan(iceland.path.length * 20);
    expect(detail.bounds).not.toEqual(iceland.bounds);
  });

  it('bounds complex country paths so selecting the United States stays responsive', () => {
    const unitedStates = atlasCountryByCode('US');
    expect(unitedStates).toBeDefined();
    if (!unitedStates) return;

    const detail = atlasCountryDetail(unitedStates);

    expect(detail.path.length).toBeGreaterThan(unitedStates.path.length);
    expect(detail.path.length).toBeLessThanOrEqual(TRAVEL_MAP_MAX_COUNTRY_PATH_LENGTH);
  });

  it('frames the United States as a country instead of nearly the whole world', () => {
    const unitedStates = atlasCountryByCode('US');
    expect(unitedStates).toBeDefined();
    if (!unitedStates) return;

    const detail = atlasCountryDetail(unitedStates);
    const detailWidth = detail.bounds[1][0] - detail.bounds[0][0];
    const viewBox = countryViewBox(unitedStates, 1.2);

    expect(detailWidth).toBeGreaterThan(TRAVEL_MAP_FLAT_VIEWBOX.width * 0.9);
    expect(viewBox.width).toBeLessThan(TRAVEL_MAP_FLAT_VIEWBOX.width * 0.4);
    expect(viewBox.x).toBeLessThan(unitedStates.center[0]);
    expect(viewBox.x + viewBox.width).toBeGreaterThan(unitedStates.center[0]);
  });

  it('keeps tiny island rings from painting the ocean as land', () => {
    const maldives = atlasCountryByCode('MV');
    expect(maldives).toBeDefined();
    if (!maldives) return;

    const detail = atlasCountryDetail(maldives);
    const detailWidth = detail.bounds[1][0] - detail.bounds[0][0];
    const detailHeight = detail.bounds[1][1] - detail.bounds[0][1];

    expect(detailWidth).toBeLessThan(TRAVEL_MAP_FLAT_VIEWBOX.width / 4);
    expect(detailHeight).toBeLessThan(TRAVEL_MAP_FLAT_VIEWBOX.height / 4);
    expect(detail.bounds.flat().every(Number.isFinite)).toBe(true);
  });

  it('keeps country borders at a stable screen thickness while drilled in', () => {
    expect(
      travelMapStrokeWidth(
        { width: 40, height: 20 },
        { width: 800, height: 400 },
        3,
      ),
    ).toBeCloseTo(0.15, 5);
  });
});
