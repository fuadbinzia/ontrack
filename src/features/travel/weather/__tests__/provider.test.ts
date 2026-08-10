import {
  describeWeatherCode,
  forecastWindow,
  normalizeTravelWeatherDays,
  weatherIconForCode,
} from '../provider';

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
