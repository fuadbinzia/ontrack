import { fetchWithTimeout } from '@/services/http/fetch-with-timeout';

import {
  describeWeatherCode,
  forecastWindow,
  getDestinationCurrentWeather,
  normalizeTravelWeatherDays,
  pickGeocodeMatch,
  weatherIconForCode,
} from '../provider';

jest.mock('@/services/http/fetch-with-timeout', () => ({
  fetchWithTimeout: jest.fn(),
}));

const fetchMock = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe('travel weather provider', () => {
  it('does not request forecasts before the 16-day window', () => {
    expect(forecastWindow('2026-09-08', '2026-09-13', '2026-07-26')).toEqual({
      availability: 'too-early',
      availableOn: '2026-08-24',
    });
  });

  it('clips a partially available trip to the forecast window', () => {
    expect(forecastWindow('2026-08-08', '2026-08-15', '2026-07-26')).toEqual({
      availability: 'partial',
      requestStart: '2026-08-08',
      requestEnd: '2026-08-10',
      availableThrough: '2026-08-10',
    });
  });

  it('clips an active trip to today', () => {
    expect(forecastWindow('2026-07-24', '2026-07-30', '2026-07-26')).toEqual({
      availability: 'forecast',
      requestStart: '2026-07-26',
      requestEnd: '2026-07-30',
      availableThrough: undefined,
    });
  });

  it('can request recent past days when pastDays is set (home weather)', () => {
    expect(
      forecastWindow('2026-05-08', '2026-08-23', '2026-08-08', { pastDays: 92 }),
    ).toEqual({
      availability: 'forecast',
      requestStart: '2026-05-08',
      requestEnd: '2026-08-23',
      availableThrough: undefined,
    });
    expect(
      forecastWindow('2026-01-01', '2026-08-08', '2026-08-08', { pastDays: 92 }),
    ).toEqual({
      availability: 'forecast',
      requestStart: '2026-05-08',
      requestEnd: '2026-08-08',
      availableThrough: undefined,
    });
  });

  it('skips null past-day placeholders instead of failing the forecast', () => {
    const days = normalizeTravelWeatherDays({
      daily: {
        time: ['2026-05-08', '2026-08-09'],
        weather_code: [null, 3],
        temperature_2m_min: [null, 74],
        temperature_2m_max: [null, 97],
        precipitation_probability_max: [95, 3],
      },
    });
    expect(days).toEqual([
      expect.objectContaining({
        date: '2026-08-09',
        weatherCode: 3,
        temperatureMax: 97,
        temperatureMin: 74,
        precipitationProbability: 3,
      }),
    ]);
  });

  it('maps WMO weather codes to readable conditions', () => {
    expect(describeWeatherCode(0)).toEqual({ condition: 'Clear', symbol: '☀️' });
    expect(describeWeatherCode(63)).toEqual({ condition: 'Rain', symbol: '🌧️' });
    expect(describeWeatherCode(95)).toEqual({ condition: 'Thunderstorms', symbol: '⛈️' });
  });

  it('maps WMO weather codes to monochrome app icons', () => {
    expect(weatherIconForCode(0)).toBe('weather-clear');
    expect(weatherIconForCode(2)).toBe('weather-partly-cloudy');
    expect(weatherIconForCode(3)).toBe('weather-cloudy');
    expect(weatherIconForCode(45)).toBe('weather-fog');
    expect(weatherIconForCode(61)).toBe('weather-rain');
    expect(weatherIconForCode(71)).toBe('weather-snow');
    expect(weatherIconForCode(80)).toBe('weather-showers');
    expect(weatherIconForCode(95)).toBe('weather-thunder');
  });

  it('maps clear / partly cloudy / showers to night icons after sunset', () => {
    expect(weatherIconForCode(0, { isDay: false })).toBe('weather-clear-night');
    expect(weatherIconForCode(2, { isDay: false })).toBe('weather-partly-cloudy-night');
    expect(weatherIconForCode(80, { isDay: false })).toBe('weather-showers-night');
    expect(weatherIconForCode(3, { isDay: false })).toBe('weather-cloudy');
    expect(weatherIconForCode(0, { isDay: true })).toBe('weather-clear');
  });
});

describe('weather geocode matching', () => {
  const unionNewJersey = {
    name: 'Union',
    admin1: 'New Jersey',
    country: 'United States',
    feature_code: 'PPL',
    latitude: 40.6976,
    longitude: -74.2632,
  };
  const unionCalifornia = {
    name: 'Union',
    admin1: 'California',
    country: 'United States',
    feature_code: 'PPL',
    latitude: 38.3213,
    longitude: -122.30997,
  };
  const arcataCalifornia = {
    name: 'Arcata',
    admin1: 'California',
    country: 'United States',
    feature_code: 'PPL',
    latitude: 40.86652,
    longitude: -124.08284,
  };

  it('keeps a state-qualified place in its own state', () => {
    expect(
      pickGeocodeMatch(
        [unionCalifornia, arcataCalifornia, unionNewJersey],
        'Union, New Jersey',
      ),
    ).toBe(unionNewJersey);
    expect(pickGeocodeMatch([unionCalifornia, unionNewJersey], 'Union, NJ')).toBe(
      unionNewJersey,
    );
  });

  it('prefers the exact name over a fuzzy hit that only matches the state', () => {
    expect(pickGeocodeMatch([arcataCalifornia, unionCalifornia], 'Union, CA')).toBe(
      unionCalifornia,
    );
  });

  it('prefers a longer exact name over a same-prefix neighbor', () => {
    const unionCity = {
      name: 'Union City',
      admin1: 'New Jersey',
      country: 'United States',
      feature_code: 'PPL',
      latitude: 40.7795,
      longitude: -74.0238,
    };
    expect(pickGeocodeMatch([unionCity, unionNewJersey], 'Union, New Jersey')).toBe(
      unionNewJersey,
    );
    expect(pickGeocodeMatch([unionNewJersey, unionCity], 'Union City, New Jersey')).toBe(
      unionCity,
    );
  });

  it('keeps airports and parks behind real localities', () => {
    const airport = {
      name: 'Union County Airport',
      admin1: 'New Jersey',
      country: 'United States',
      feature_code: 'AIRP',
      latitude: 40.6,
      longitude: -74.2,
    };
    expect(pickGeocodeMatch([airport, unionNewJersey], 'Union, New Jersey')).toBe(
      unionNewJersey,
    );
    expect(pickGeocodeMatch([airport], 'Union County Airport')).toBe(airport);
  });

  it('keeps Open-Meteo order when nothing matches better and rejects unusable rows', () => {
    expect(pickGeocodeMatch([arcataCalifornia, unionCalifornia], 'Nowhere')).toBe(
      arcataCalifornia,
    );
    expect(pickGeocodeMatch([{ name: 'Union' }], 'Union')).toBeUndefined();
    expect(pickGeocodeMatch([], 'Union')).toBeUndefined();
  });
});

describe('current weather for a device coordinate', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('uses the device coordinate and label instead of geocoding the text', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        timezone: 'America/New_York',
        current: { temperature_2m: 71.4, weather_code: 0, is_day: 1 },
      }),
    );

    const weather = await getDestinationCurrentWeather(
      'Union, New Jersey',
      'fahrenheit',
      undefined,
      { latitude: 40.6976, longitude: -74.2632 },
    );

    expect(weather.locationLabel).toBe('Union, New Jersey');
    expect(weather.temperature).toBe(71);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requested = String(fetchMock.mock.calls[0]![0]);
    expect(requested).toContain('api.open-meteo.com/v1/forecast');
    expect(requested).not.toContain('geocoding-api');
    expect(requested).toContain('latitude=40.6976');
    expect(requested).toContain('longitude=-74.2632');
  });

  it('still geocodes when no coordinate is known', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              name: 'Union',
              admin1: 'New Jersey',
              country: 'United States',
              feature_code: 'PPL',
              latitude: 40.6976,
              longitude: -74.2632,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          timezone: 'America/New_York',
          current: { temperature_2m: 68, weather_code: 3, is_day: 1 },
        }),
      );

    const weather = await getDestinationCurrentWeather('Union, NJ', 'fahrenheit');

    expect(weather.locationLabel).toBe('Union, New Jersey, United States');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('geocoding-api');
  });
});
