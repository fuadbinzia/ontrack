import {
  optionalScreenOrientation,
  TravelMapOrientationLock,
  type ScreenOrientationNativeModule,
} from '../optional-screen-orientation';

describe('optionalScreenOrientation', () => {
  it('returns undefined when the installed binary lacks the native module', () => {
    expect(optionalScreenOrientation(() => null)).toBeUndefined();
  });

  it('does not crash if optional native-module lookup throws', () => {
    expect(optionalScreenOrientation(() => {
      throw new Error('Native module registry unavailable');
    })).toBeUndefined();
  });

  it('returns the module when the installed binary supports orientation', () => {
    const module: ScreenOrientationNativeModule = { lockAsync: jest.fn() };

    expect(optionalScreenOrientation(() => module)).toBe(module);
  });

  it('uses Expo native orientation lock values without importing its JS package', () => {
    expect(TravelMapOrientationLock).toEqual({ all: 1, portraitUp: 3 });
  });
});
