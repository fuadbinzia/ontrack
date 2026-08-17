import { requireOptionalNativeModule } from 'expo-modules-core';

export type ScreenOrientationNativeModule = {
  lockAsync?: (orientationLock: number) => Promise<void>;
  /** Fires at the start of the OS rotation transition — before Dimensions. */
  addListener?: (
    eventName: 'expoDidUpdateDimensions',
    listener: () => void,
  ) => { remove: () => void };
};

type ScreenOrientationLoader = () => ScreenOrientationNativeModule | null;

const loadScreenOrientation: ScreenOrientationLoader = () =>
  requireOptionalNativeModule<ScreenOrientationNativeModule>('ExpoScreenOrientation');

// These values are part of Expo Screen Orientation's native contract. Keeping
// them local prevents Metro from evaluating the JS package in an older binary.
export const TravelMapOrientationLock = {
  all: 1,
  portraitUp: 3,
} as const;

export function optionalScreenOrientation(
  load: ScreenOrientationLoader = loadScreenOrientation,
): ScreenOrientationNativeModule | undefined {
  try {
    return load() ?? undefined;
  } catch {
    return undefined;
  }
}
