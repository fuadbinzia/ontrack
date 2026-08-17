import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useRef, useState } from 'react';

import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';

import { optionalScreenOrientation } from './optional-screen-orientation';

/**
 * How long window dimensions must hold still before the rotation veil lifts.
 * Dimensions tick at the start of the OS rotation (~300ms); the eased fade-out
 * overlaps the nearly-still animation tail, so this stays just under it.
 */
export const ROTATION_SETTLE_MS = 300;
/** How long a tilt-predicted veil waits for the OS rotation to follow through. */
export const ROTATION_PREEMPT_HOLD_MS = 900;

/** ~15 Hz — fast enough to lead the OS rotation without burning JS. */
const TILT_SAMPLE_INTERVAL_MS = 66;

type Axis = 'portrait' | 'landscape';

/**
 * Dominant gravity axis of a device-motion sample (m/s²), or undefined while
 * the device is flat, mid-turn, shaken, or in freefall. Thresholds sit just
 * past 45° so a decisive tilt classifies a beat before iOS commits the UI
 * rotation, while a casual lean does not.
 */
export function gravityAxis(
  x: number,
  y: number,
  z: number,
): Axis | undefined {
  const magnitude = Math.hypot(x, y, z);
  if (magnitude < 6 || magnitude > 14) return undefined;
  const acrossX = Math.abs(x) / magnitude;
  const acrossY = Math.abs(y) / magnitude;
  if (acrossX > 0.7 && acrossY < 0.48) return 'landscape';
  if (acrossY > 0.7 && acrossX < 0.48) return 'portrait';
  return undefined;
}

/**
 * True from the first hint of a portrait ↔ landscape rotation until the
 * window's dimensions have held still for ROTATION_SETTLE_MS. During the OS
 * rotation animation every full-bleed layer is mid-relayout and looks
 * stretched; the map screen hides that behind a sky veil while this is true.
 *
 * Raisers, earliest first:
 * 1. Physical tilt (gravity axis flip) — the device turns a few hundred ms
 *    before iOS commits the rotation, so the veil is up before any stretch
 *    is visible. Holds ROTATION_PREEMPT_HOLD_MS in case the OS never follows
 *    (Control Center rotation lock, casual tilt).
 * 2. The native screen-orientation event — start of the rotation transition.
 * 3. The dimension-axis flip — always available, latest.
 *
 * Same-axis resizes (split screen, window drags) never raise the veil.
 */
export function useOrientationSettle(
  width: number,
  height: number,
  active = true,
): boolean {
  const landscape = width > height;
  const [settling, setSettling] = useState(false);
  const holdRef = useRef(ROTATION_SETTLE_MS);
  const landscapeRef = useRef(landscape);
  landscapeRef.current = landscape;
  const previousLandscapeRef = useRef(landscape);

  // Raiser 1: physical tilt. Edge-triggered per axis flip so a device held in
  // a mismatching orientation (rotation lock) cannot pin the veil up forever.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let subscription: { remove: () => void } | undefined;

    const start = async () => {
      try {
        // Probe first — the expo-sensors barrel fatals on binaries without
        // the native module (same guard as use-tilt-sky-motion).
        if (!requireOptionalNativeModule('ExponentDeviceMotion')) return;
        const { default: DeviceMotion } = await import(
          'expo-sensors/build/DeviceMotion.js'
        );
        if (!(await DeviceMotion.isAvailableAsync()) || cancelled) return;
        const permission = await DeviceMotion.getPermissionsAsync();
        const granted =
          permission.granted ||
          (await DeviceMotion.requestPermissionsAsync()).granted;
        if (!granted || cancelled) return;

        DeviceMotion.setUpdateInterval(TILT_SAMPLE_INTERVAL_MS);
        let lastAxis: Axis = landscapeRef.current ? 'landscape' : 'portrait';
        subscription = DeviceMotion.addListener((sample) => {
          if (cancelled) return;
          const gravity = sample.accelerationIncludingGravity;
          if (!gravity) return;
          const axis = gravityAxis(gravity.x, gravity.y, gravity.z);
          if (!axis || axis === lastAxis) return;
          lastAxis = axis;
          if ((axis === 'landscape') === landscapeRef.current) return;
          holdRef.current = ROTATION_PREEMPT_HOLD_MS;
          setSettling(true);
        });
      } catch {
        // Sensors unavailable (old binary, simulator, permission denied) —
        // the rotation event and dimension flip still veil, a beat later.
      }
    };

    const cancelDefer = deferAfterPageTransition(() => void start());
    return () => {
      cancelled = true;
      cancelDefer();
      subscription?.remove();
    };
  }, [active]);

  // Raiser 2: native rotation event — start of the OS transition, before
  // useWindowDimensions ticks.
  useEffect(() => {
    const screenOrientation = optionalScreenOrientation();
    if (!screenOrientation?.addListener) return;
    const subscription = screenOrientation.addListener(
      'expoDidUpdateDimensions',
      () => {
        holdRef.current = ROTATION_SETTLE_MS;
        setSettling(true);
      },
    );
    return () => subscription.remove();
  }, []);

  // Raiser 3: dimension-axis flip — fallback when native signals are missing.
  useEffect(() => {
    if (previousLandscapeRef.current === landscape) return;
    previousLandscapeRef.current = landscape;
    holdRef.current = ROTATION_SETTLE_MS;
    setSettling(true);
  }, [landscape]);

  // Lift timer. Re-arms on every dimension tick; a tick means the rotation is
  // truly underway, so a preempt hold shortens to the settle window.
  const dimensionsRef = useRef({ width, height });
  useEffect(() => {
    if (
      dimensionsRef.current.width !== width ||
      dimensionsRef.current.height !== height
    ) {
      dimensionsRef.current = { width, height };
      holdRef.current = ROTATION_SETTLE_MS;
    }
    if (!settling) return;
    const timer = setTimeout(() => setSettling(false), holdRef.current);
    return () => clearTimeout(timer);
  }, [settling, width, height]);

  return settling;
}
