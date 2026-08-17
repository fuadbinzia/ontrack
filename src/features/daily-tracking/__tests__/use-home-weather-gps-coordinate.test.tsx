import { renderHook, waitFor } from '@testing-library/react-native';

import {
  getDestinationCurrentWeather,
  getTravelWeather,
} from '@/features/travel/weather/provider';
import { useCurrentPlaceLabel } from '@/hooks/use-current-place-label';
import { usePreferences } from '@/store/preferences';

import { useHomeWeather } from '../use-home-weather';

jest.mock('@/features/travel/weather/provider', () => ({
  ...jest.requireActual('@/features/travel/weather/provider'),
  getDestinationCurrentWeather: jest.fn(),
  getTravelWeather: jest.fn(),
}));

jest.mock('@/hooks/use-current-place-label', () => ({
  useCurrentPlaceLabel: jest.fn(),
}));

const currentWeatherMock = getDestinationCurrentWeather as jest.MockedFunction<
  typeof getDestinationCurrentWeather
>;
const travelWeatherMock = getTravelWeather as jest.MockedFunction<typeof getTravelWeather>;
const currentPlaceMock = useCurrentPlaceLabel as jest.MockedFunction<
  typeof useCurrentPlaceLabel
>;

const GPS_COORDINATE = { latitude: 40.6976, longitude: -74.2632 };

function setGpsPlace(coordinate?: { latitude: number; longitude: number }) {
  currentPlaceMock.mockImplementation((enabled = true) =>
    enabled
      ? {
          status: 'suggested',
          label: 'Union, New Jersey',
          coordinate,
          detail: 'Union, New Jersey',
          refresh: jest.fn(),
        }
      : { status: 'idle', label: '', detail: '—', refresh: jest.fn() },
  );
}

describe('home weather for the live GPS place', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePreferences.setState({ homeLocation: '', currentLocation: '' });
    currentWeatherMock.mockResolvedValue({
      locationLabel: 'Union, New Jersey',
      latitude: GPS_COORDINATE.latitude,
      longitude: GPS_COORDINATE.longitude,
      temperature: 70,
      temperatureUnit: 'fahrenheit',
      weatherCode: 0,
      condition: 'Clear',
      symbol: '☀️',
    });
    travelWeatherMock.mockResolvedValue({
      availability: 'forecast',
      locationLabel: 'Union, New Jersey',
      temperatureUnit: 'fahrenheit',
      days: [],
    });
    setGpsPlace(GPS_COORDINATE);
  });

  it('requests weather at the device coordinate instead of re-geocoding the label', async () => {
    renderHook(() => useHomeWeather());

    await waitFor(() => {
      expect(currentWeatherMock).toHaveBeenCalled();
    });
    expect(currentWeatherMock).toHaveBeenCalledWith(
      'Union, New Jersey',
      'fahrenheit',
      expect.anything(),
      GPS_COORDINATE,
    );
    expect(travelWeatherMock).toHaveBeenCalledWith(
      'Union, New Jersey',
      expect.any(String),
      expect.any(String),
      'fahrenheit',
      expect.anything(),
      expect.objectContaining({ coordinate: GPS_COORDINATE }),
    );
  });

  it('falls back to a text lookup when the device gives no coordinate', async () => {
    setGpsPlace(undefined);

    renderHook(() => useHomeWeather());

    await waitFor(() => {
      expect(currentWeatherMock).toHaveBeenCalled();
    });
    expect(currentWeatherMock).toHaveBeenCalledWith(
      'Union, New Jersey',
      'fahrenheit',
      expect.anything(),
      undefined,
    );
  });

  it('does not attach the GPS coordinate to a user-authored current place', async () => {
    usePreferences.setState({ currentLocation: 'Union City, California' });

    renderHook(() => useHomeWeather());

    await waitFor(() => {
      expect(currentWeatherMock).toHaveBeenCalled();
    });
    expect(currentWeatherMock).toHaveBeenCalledWith(
      'Union City, California',
      'fahrenheit',
      expect.anything(),
      undefined,
    );
  });
});
