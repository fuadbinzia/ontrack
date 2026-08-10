import type {
  DestinationCurrentWeather,
  TravelWeather,
} from '@/features/travel/weather/types';

import {
  formatHomeWeatherPrimaryLabel,
  formatHomeWeatherRangeLabel,
  formatHomeWeatherTemperatureLabel,
  formatWeatherPlaceLabel,
  weatherPlaceLabelLadder,
  weatherPlacesMatch,
  homeWeatherForecastThrough,
  homeWeatherHistoryFrom,
  isHomeWeatherDateInWindow,
  resolveHomeWeatherForDate,
} from '../resolve-home-weather-day';

describe('formatWeatherPlaceLabel', () => {
  it('keeps city + state + country abbreviations', () => {
    expect(formatWeatherPlaceLabel('Brooklyn, New York, United States')).toBe(
      'Brooklyn, NY, US',
    );
    expect(
      formatWeatherPlaceLabel('Union Square, California, United States', {
        detail: 'full',
      }),
    ).toBe('Union Square, CA, US');
    expect(
      formatWeatherPlaceLabel('Brooklyn, New York, United States', {
        detail: 'region',
      }),
    ).toBe('Brooklyn, NY');
    expect(
      formatWeatherPlaceLabel('Brooklyn, New York, United States', {
        detail: 'city',
      }),
    ).toBe('Brooklyn');
    expect(formatWeatherPlaceLabel('Paris, France')).toBe('Paris, FR');
    expect(formatWeatherPlaceLabel('Austin')).toBe('Austin');
  });

  it('builds a longest-to-shortest ladder', () => {
    expect(weatherPlaceLabelLadder('Brooklyn, New York, United States')).toEqual([
      'Brooklyn, NY, US',
      'Brooklyn, NY',
      'Brooklyn',
    ]);
  });

  it('matches equivalent home/current place strings', () => {
    expect(
      weatherPlacesMatch(
        'Brooklyn, New York, United States',
        'brooklyn, new york, united states',
      ),
    ).toBe(true);
    expect(
      weatherPlacesMatch('Brooklyn, NY, US', 'Brooklyn, New York, United States'),
    ).toBe(true);
    expect(weatherPlacesMatch('Brooklyn, New York, United States', 'Austin, TX')).toBe(
      false,
    );
  });
});

const current: DestinationCurrentWeather = {
  locationLabel: 'Austin, Texas, United States',
  latitude: 30.27,
  longitude: -97.74,
  timezone: 'America/Chicago',
  temperature: 88,
  temperatureUnit: 'fahrenheit',
  weatherCode: 0,
  condition: 'Clear',
  symbol: '☀️',
  isDay: true,
};

const forecast: TravelWeather = {
  availability: 'forecast',
  locationLabel: 'Austin, Texas, United States',
  timezone: 'America/Chicago',
  temperatureUnit: 'fahrenheit',
  days: [
    {
      date: '2026-08-07',
      weatherCode: 61,
      condition: 'Rain',
      symbol: '🌧️',
      temperatureMin: 71,
      temperatureMax: 89,
      precipitationProbability: 40,
    },
    {
      date: '2026-08-08',
      weatherCode: 0,
      condition: 'Clear',
      symbol: '☀️',
      temperatureMin: 72,
      temperatureMax: 94,
      precipitationProbability: 5,
    },
    {
      date: '2026-08-09',
      weatherCode: 61,
      condition: 'Rain',
      symbol: '🌧️',
      temperatureMin: 70,
      temperatureMax: 86,
      precipitationProbability: 60,
    },
    {
      date: '2026-08-23',
      weatherCode: 3,
      condition: 'Cloudy',
      symbol: '☁️',
      temperatureMin: 68,
      temperatureMax: 90,
      precipitationProbability: 20,
    },
  ],
};

describe('resolveHomeWeatherForDate', () => {
  it('keeps the Open-Meteo past→16-day window', () => {
    expect(homeWeatherHistoryFrom('2026-08-08')).toBe('2026-05-08');
    expect(homeWeatherForecastThrough('2026-08-08')).toBe('2026-08-23');
    expect(isHomeWeatherDateInWindow('2026-05-08', '2026-08-08')).toBe(true);
    expect(isHomeWeatherDateInWindow('2026-08-07', '2026-08-08')).toBe(true);
    expect(isHomeWeatherDateInWindow('2026-08-08', '2026-08-08')).toBe(true);
    expect(isHomeWeatherDateInWindow('2026-08-23', '2026-08-08')).toBe(true);
    expect(isHomeWeatherDateInWindow('2026-08-24', '2026-08-08')).toBe(false);
    expect(isHomeWeatherDateInWindow('2026-05-07', '2026-08-08')).toBe(false);
  });

  it('prefers live conditions for today and attaches daily high/low', () => {
    expect(
      resolveHomeWeatherForDate({
        date: '2026-08-08',
        current,
        forecast,
        today: '2026-08-08',
      }),
    ).toEqual({
      temperature: 88,
      temperatureHigh: 94,
      temperatureLow: 72,
      temperatureUnit: 'fahrenheit',
      condition: 'Clear',
      weatherCode: 0,
      locationLabel: 'Austin, Texas, United States',
      timezone: 'America/Chicago',
      isLive: true,
      isDay: true,
    });
  });

  it('uses daily high/low for previous days in the API window', () => {
    expect(
      resolveHomeWeatherForDate({
        date: '2026-08-07',
        current,
        forecast,
        today: '2026-08-08',
      }),
    ).toEqual({
      temperature: 89,
      temperatureHigh: 89,
      temperatureLow: 71,
      temperatureUnit: 'fahrenheit',
      condition: 'Rain',
      weatherCode: 61,
      locationLabel: 'Austin, Texas, United States',
      timezone: 'America/Chicago',
      isLive: false,
    });
  });

  it('uses daily high/low for upcoming forecast days', () => {
    expect(
      resolveHomeWeatherForDate({
        date: '2026-08-09',
        current,
        forecast,
        today: '2026-08-08',
      }),
    ).toEqual({
      temperature: 86,
      temperatureHigh: 86,
      temperatureLow: 70,
      temperatureUnit: 'fahrenheit',
      condition: 'Rain',
      weatherCode: 61,
      locationLabel: 'Austin, Texas, United States',
      timezone: 'America/Chicago',
      isLive: false,
    });
  });

  it('returns undefined outside the API window', () => {
    expect(
      resolveHomeWeatherForDate({
        date: '2026-08-24',
        current,
        forecast,
        today: '2026-08-08',
      }),
    ).toBeUndefined();
    expect(
      resolveHomeWeatherForDate({
        date: '2026-05-07',
        current,
        forecast,
        today: '2026-08-08',
      }),
    ).toBeUndefined();
  });

  it('falls back to today’s forecast day when live current is missing', () => {
    expect(
      resolveHomeWeatherForDate({
        date: '2026-08-08',
        forecast,
        today: '2026-08-08',
      }),
    ).toMatchObject({
      temperature: 94,
      temperatureHigh: 94,
      temperatureLow: 72,
      isLive: false,
      condition: 'Clear',
    });
  });
});

describe('formatHomeWeather labels', () => {
  const live = {
    temperature: 88,
    temperatureHigh: 94,
    temperatureLow: 72,
    temperatureUnit: 'fahrenheit' as const,
    condition: 'Clear',
    weatherCode: 0,
    locationLabel: 'Austin',
    isLive: true,
  };

  it('keeps live primary short and puts H/L on the range line', () => {
    expect(formatHomeWeatherPrimaryLabel(live)).toBe('88°F · Clear');
    expect(formatHomeWeatherRangeLabel(live)).toBe('H 94° · L 72°');
    expect(formatHomeWeatherTemperatureLabel(live)).toBe(
      '88°F · Clear · H 94° · L 72°',
    );
  });

  it('formats daily high/low on the primary line', () => {
    expect(
      formatHomeWeatherPrimaryLabel({
        temperature: 86,
        temperatureHigh: 86,
        temperatureLow: 70,
        temperatureUnit: 'fahrenheit',
        condition: 'Rain',
        weatherCode: 61,
        locationLabel: 'Austin',
        isLive: false,
      }),
    ).toBe('H 86°F · L 70°F · Rain');
    expect(
      formatHomeWeatherRangeLabel({
        temperature: 86,
        temperatureHigh: 86,
        temperatureLow: 70,
        temperatureUnit: 'fahrenheit',
        condition: 'Rain',
        weatherCode: 61,
        locationLabel: 'Austin',
        isLive: false,
      }),
    ).toBeUndefined();
  });
});
