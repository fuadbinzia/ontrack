import * as Location from 'expo-location';

import { formatPlaceAddress, getCurrentPlaceLabel } from '@/utils/device-location';

jest.mock('expo-location', () => ({
  Accuracy: { Low: 1 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const locationMock = Location as jest.Mocked<typeof Location>;

describe('device place address formatting', () => {
  it('uses city and region for North American locations', () => {
    expect(formatPlaceAddress({
      city: 'Brooklyn',
      district: null,
      subregion: null,
      region: 'New York',
      country: 'United States',
      isoCountryCode: 'US',
    })).toBe('Brooklyn, New York');
  });

  it('prefers a borough or district over a broader city', () => {
    expect(formatPlaceAddress({
      city: 'New York',
      district: 'Brooklyn',
      subregion: null,
      region: 'New York',
      country: 'United States',
      isoCountryCode: 'US',
    })).toBe('Brooklyn, New York');
  });

  it('uses city and country for other locations', () => {
    expect(formatPlaceAddress({
      city: 'Lisbon',
      district: null,
      subregion: null,
      region: 'Lisbon District',
      country: 'Portugal',
      isoCountryCode: 'PT',
    })).toBe('Lisbon, Portugal');
  });

  it('falls back to district and removes duplicate areas', () => {
    expect(formatPlaceAddress({
      city: null,
      district: 'Manhattan',
      subregion: null,
      region: 'Manhattan',
      country: 'United States',
      isoCountryCode: 'US',
    })).toBe('Manhattan');
  });

  it('returns no suggestion without a city-level value', () => {
    expect(formatPlaceAddress({
      city: null,
      district: null,
      subregion: null,
      region: null,
      country: 'United States',
      isoCountryCode: 'US',
    })).toBeUndefined();
  });
});

describe('current device place', () => {
  const coordinate = { latitude: 40.6976, longitude: -74.2632 };

  beforeEach(() => {
    jest.clearAllMocks();
    locationMock.getForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    } as never);
    locationMock.getLastKnownPositionAsync.mockResolvedValue({
      coords: coordinate,
    } as never);
  });

  it('returns the coordinate behind the label so weather skips text geocoding', async () => {
    locationMock.reverseGeocodeAsync.mockResolvedValue([
      {
        city: 'Union',
        district: null,
        subregion: 'Union County',
        region: 'New Jersey',
        country: 'United States',
        isoCountryCode: 'US',
      },
    ] as never);

    await expect(getCurrentPlaceLabel()).resolves.toEqual({
      status: 'suggested',
      label: 'Union, New Jersey',
      coordinate,
    });
  });

  it('reports unavailable when the coordinate has no readable place', async () => {
    locationMock.reverseGeocodeAsync.mockResolvedValue([] as never);

    await expect(getCurrentPlaceLabel()).resolves.toEqual({ status: 'unavailable' });
  });

  it('reports denied without geocoding when permission is off', async () => {
    locationMock.getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    } as never);

    await expect(getCurrentPlaceLabel()).resolves.toEqual({ status: 'denied' });
    expect(locationMock.reverseGeocodeAsync).not.toHaveBeenCalled();
  });
});
