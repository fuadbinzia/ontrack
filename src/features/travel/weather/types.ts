export type TemperatureUnit = 'celsius' | 'fahrenheit';

export interface TravelWeatherDay {
  date: string;
  weatherCode: number;
  condition: string;
  symbol: string;
  temperatureMin: number;
  temperatureMax: number;
  precipitationProbability: number;
}

export type TravelWeatherAvailability =
  | 'forecast'
  | 'partial'
  | 'too-early'
  | 'past';

export interface TravelWeather {
  availability: TravelWeatherAvailability;
  locationLabel: string;
  timezone?: string;
  temperatureUnit: TemperatureUnit;
  days: TravelWeatherDay[];
  availableOn?: string;
  availableThrough?: string;
}

/** Live conditions at a destination (Open-Meteo current). */
export interface DestinationCurrentWeather {
  locationLabel: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  temperature: number;
  temperatureUnit: TemperatureUnit;
  weatherCode: number;
  condition: string;
  symbol: string;
  /** Open-Meteo `is_day` — false after local sunset for night chrome icons. */
  isDay?: boolean;
}
