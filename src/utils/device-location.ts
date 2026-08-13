import * as Location from 'expo-location';
import { Platform } from 'react-native';

const LAST_KNOWN_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const LOCATION_TIMEOUT_MS = 12_000;

export type DevicePlaceResult =
  | { status: 'suggested'; label: string }
  | { status: 'denied' }
  | { status: 'unavailable' };

export type DeviceCoordinateResult =
  | {
      status: 'suggested';
      coordinate: { latitude: number; longitude: number };
    }
  | { status: 'denied' }
  | { status: 'unavailable' };

export type DevicePlaceAddress = Pick<
  Location.LocationGeocodedAddress,
  'city' | 'country' | 'district' | 'isoCountryCode' | 'region' | 'subregion'
>;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Location request timed out.')),
      LOCATION_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

/** Most specific locality + region/country label from a reverse-geocoded address. */
export function formatPlaceAddress(address: DevicePlaceAddress): string | undefined {
  // iOS reports NYC as `city` for all boroughs, while preserving the borough in
  // `district` (for example, Brooklyn). Prefer that more precise locality.
  const locality = address.district ?? address.city ?? address.subregion ?? address.region;
  if (!locality) return undefined;

  const countryCode = address.isoCountryCode?.toUpperCase();
  const area =
    countryCode === 'US' || countryCode === 'CA'
      ? address.region
      : address.country;
  return [locality, area]
    .filter((part, index, parts): part is string =>
      typeof part === 'string' && part.length > 0 && parts.indexOf(part) === index)
    .join(', ');
}

/**
 * Resolves the device’s current coordinate using foreground permission only.
 * Requests foreground permission when needed. Web always returns unavailable.
 */
export async function getCurrentDeviceCoordinate(): Promise<DeviceCoordinateResult> {
  if (Platform.OS === 'web') return { status: 'unavailable' };

  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) return { status: 'denied' };

    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: 50_000,
    });
    const position =
      lastKnown ??
      (await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      ));
    return {
      status: 'suggested',
      coordinate: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

/** Resolves an approximate place label from the device’s current location. */
export async function getCurrentPlaceLabel(
  formatAddress: (address: DevicePlaceAddress) => string | undefined = formatPlaceAddress,
): Promise<DevicePlaceResult> {
  const coordinateResult = await getCurrentDeviceCoordinate();
  if (coordinateResult.status !== 'suggested') return coordinateResult;

  try {
    const addresses = await withTimeout(
      Location.reverseGeocodeAsync(coordinateResult.coordinate),
    );
    const label = addresses[0] ? formatAddress(addresses[0]) : undefined;
    return label ? { status: 'suggested', label } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}
