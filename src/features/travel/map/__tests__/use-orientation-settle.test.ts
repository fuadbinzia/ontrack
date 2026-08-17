/**
 * Regression: rotating portrait ↔ landscape showed the map layers stretching
 * while the OS resized the window. The screen hides that behind a veil driven
 * by this hook — it must rise at the earliest rotation signal (physical tilt,
 * then the native rotation event, then the dimension flip) and lift only after
 * dimensions have held still, without ever flashing on page open or pinning
 * the veil up when the OS never rotates.
 */
import { act, renderHook } from '@testing-library/react-native';

import {
    gravityAxis,
    ROTATION_PREEMPT_HOLD_MS,
    ROTATION_SETTLE_MS,
    useOrientationSettle,
} from '../use-orientation-settle';

// Controllable native rotation event: the hook must raise the veil on this
// signal, which lands before useWindowDimensions ticks on device.
const mockOrientationListeners = new Set<() => void>();
const mockCapturedEventNames: string[] = [];

jest.mock('../optional-screen-orientation', () => ({
  optionalScreenOrientation: () => ({
    addListener: (eventName: string, listener: () => void) => {
      mockCapturedEventNames.push(eventName);
      mockOrientationListeners.add(listener);
      return { remove: () => mockOrientationListeners.delete(listener) };
    },
  }),
}));

// Controllable device-motion feed for the tilt preemption raiser.
type MotionSample = {
  accelerationIncludingGravity: { x: number; y: number; z: number } | null;
};
const mockMotionListeners = new Set<(sample: MotionSample) => void>();

jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: jest.fn(() => ({})),
}));

jest.mock('expo-sensors/build/DeviceMotion.js', () => ({
  __esModule: true,
  default: {
    isAvailableAsync: async () => true,
    getPermissionsAsync: async () => ({ granted: true }),
    requestPermissionsAsync: async () => ({ granted: true }),
    setUpdateInterval: jest.fn(),
    addListener: (listener: (sample: MotionSample) => void) => {
      mockMotionListeners.add(listener);
      return { remove: () => mockMotionListeners.delete(listener) };
    },
  },
}));

const fireNativeRotation = () =>
  act(() => mockOrientationListeners.forEach((listener) => listener()));

/** Advances past deferAfterPageTransition and flushes the async sensor start. */
const startSensors = async () => {
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
};

const GRAVITY = 9.81;
const tiltTo = (axis: 'portrait' | 'landscape') =>
  act(() =>
    mockMotionListeners.forEach((listener) =>
      listener({
        accelerationIncludingGravity:
          axis === 'landscape'
            ? { x: GRAVITY, y: 0, z: 0 }
            : { x: 0, y: -GRAVITY, z: 0 },
      }),
    ),
  );

const PORTRAIT = { width: 750, height: 1334 };
const LANDSCAPE = { width: 1334, height: 750 };

const renderSettle = (
  initial: { width: number; height: number },
  active = true,
) =>
  renderHook(
    ({ width, height }: { width: number; height: number }) =>
      useOrientationSettle(width, height, active),
    { initialProps: initial },
  );

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('gravityAxis', () => {
  it('classifies upright portrait and both landscape sides', () => {
    expect(gravityAxis(0, -GRAVITY, 0)).toBe('portrait');
    expect(gravityAxis(GRAVITY, 0, 0)).toBe('landscape');
    expect(gravityAxis(-GRAVITY, 0, 0)).toBe('landscape');
  });

  it('stays undecided while flat, mid-turn, or shaken', () => {
    // Flat on a table: gravity is all z — rotating there never rotates the UI.
    expect(gravityAxis(0, 0, -GRAVITY)).toBeUndefined();
    // 45° mid-turn: no axis dominates yet.
    const diagonal = GRAVITY / Math.SQRT2;
    expect(gravityAxis(diagonal, -diagonal, 0)).toBeUndefined();
    // Shake / freefall magnitudes are noise, not posture.
    expect(gravityAxis(20, 0, 0)).toBeUndefined();
    expect(gravityAxis(1, -2, 0)).toBeUndefined();
  });
});

describe('useOrientationSettle', () => {
  it('stays at rest on page open in either orientation', () => {
    expect(renderSettle(PORTRAIT).result.current).toBe(false);
    expect(renderSettle(LANDSCAPE).result.current).toBe(false);
  });

  it('raises on an orientation flip and lifts after dimensions settle', () => {
    const view = renderSettle(PORTRAIT);

    view.rerender(LANDSCAPE);
    expect(view.result.current).toBe(true);

    act(() => jest.advanceTimersByTime(ROTATION_SETTLE_MS));
    expect(view.result.current).toBe(false);
  });

  it('holds while dimensions keep changing mid-rotation', () => {
    const view = renderSettle(PORTRAIT);

    view.rerender({ width: 1000, height: 900 });
    expect(view.result.current).toBe(true);

    // Another resize tick just before the deadline re-arms the timer.
    act(() => jest.advanceTimersByTime(ROTATION_SETTLE_MS - 50));
    view.rerender(LANDSCAPE);
    act(() => jest.advanceTimersByTime(ROTATION_SETTLE_MS - 50));
    expect(view.result.current).toBe(true);

    act(() => jest.advanceTimersByTime(50));
    expect(view.result.current).toBe(false);
  });

  it('ignores same-axis resizes like split screen', () => {
    const view = renderSettle(PORTRAIT);

    view.rerender({ width: 700, height: 1200 });
    expect(view.result.current).toBe(false);
  });

  it('settles once after a quick there-and-back rotation', () => {
    const view = renderSettle(PORTRAIT);

    view.rerender(LANDSCAPE);
    act(() => jest.advanceTimersByTime(100));
    view.rerender(PORTRAIT);
    expect(view.result.current).toBe(true);

    act(() => jest.advanceTimersByTime(ROTATION_SETTLE_MS));
    expect(view.result.current).toBe(false);
  });

  it('raises on the native rotation event before dimensions change', () => {
    const view = renderSettle(PORTRAIT);
    expect(mockCapturedEventNames).toContain('expoDidUpdateDimensions');

    fireNativeRotation();
    expect(view.result.current).toBe(true);

    // Dimensions land mid-hold and re-arm the timer; then the veil lifts.
    act(() => jest.advanceTimersByTime(100));
    view.rerender(LANDSCAPE);
    act(() => jest.advanceTimersByTime(ROTATION_SETTLE_MS));
    expect(view.result.current).toBe(false);
  });

  it('preempts the rotation from a physical tilt before any OS signal', async () => {
    const view = renderSettle(PORTRAIT);
    await startSensors();

    tiltTo('landscape');
    expect(view.result.current).toBe(true);
  });

  it('shortens a preempt hold once the rotation actually lands', async () => {
    const view = renderSettle(PORTRAIT);
    await startSensors();

    tiltTo('landscape');
    act(() => jest.advanceTimersByTime(200));
    view.rerender(LANDSCAPE);

    act(() => jest.advanceTimersByTime(ROTATION_SETTLE_MS));
    expect(view.result.current).toBe(false);
  });

  it('lifts a tilt-only veil when the OS never rotates (rotation lock)', async () => {
    const view = renderSettle(PORTRAIT);
    await startSensors();

    tiltTo('landscape');
    expect(view.result.current).toBe(true);

    act(() => jest.advanceTimersByTime(ROTATION_PREEMPT_HOLD_MS));
    expect(view.result.current).toBe(false);

    // Edge-triggered: the still-mismatched posture cannot re-pin the veil.
    tiltTo('landscape');
    expect(view.result.current).toBe(false);
  });

  it('ignores tilt that matches the current orientation', async () => {
    const view = renderSettle(PORTRAIT);
    await startSensors();

    tiltTo('portrait');
    expect(view.result.current).toBe(false);
  });

  it('does not listen to motion while the route is inactive', async () => {
    renderSettle(PORTRAIT, false);
    await startSensors();

    expect(mockMotionListeners.size).toBe(0);
  });

  it('removes native listeners on unmount', async () => {
    const view = renderSettle(PORTRAIT);
    await startSensors();
    expect(mockOrientationListeners.size).toBeGreaterThan(0);
    expect(mockMotionListeners.size).toBeGreaterThan(0);

    view.unmount();
    expect(mockOrientationListeners.size).toBe(0);
    expect(mockMotionListeners.size).toBe(0);
  });
});
