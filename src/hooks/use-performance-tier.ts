import * as Device from 'expo-device';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { motion } from '@/design-system';
import { useAppIsActive } from '@/hooks/use-app-activity';
import {
  degradePerformanceTier,
  minPerformanceTier,
  performanceGatesFor,
  resolvePerformanceTier,
  type PerformanceGates,
  type PerformanceTier,
} from '@/utils/device-capability';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';

/** Session floor shared across features — only ever steps down. */
let sessionFloor: PerformanceTier | null = null;
let pressureCap: PerformanceTier | null = null;
let floorVersion = 0;
const floorListeners = new Set<() => void>();
let fpsSampleArmed = false;

function subscribeFloor(listener: () => void): () => void {
  floorListeners.add(listener);
  return () => {
    floorListeners.delete(listener);
  };
}

function getFloorVersion(): number {
  return floorVersion;
}

function publishSessionFloor(next: PerformanceTier): void {
  const merged = sessionFloor ? minPerformanceTier(sessionFloor, next) : next;
  if (merged === sessionFloor) return;
  sessionFloor = merged;
  floorVersion += 1;
  floorListeners.forEach((listener) => listener());
}

/** Test helper — reset session degradation between cases. */
export function resetPerformanceTierSessionForTests(): void {
  sessionFloor = null;
  pressureCap = null;
  fpsSampleArmed = false;
  floorVersion += 1;
  floorListeners.forEach((listener) => listener());
}

/** Reversible device-pressure cap. Unlike the session floor, this may recover. */
export function setPerformancePressureCap(next: PerformanceTier | null): void {
  if (pressureCap === next) return;
  pressureCap = next;
  floorVersion += 1;
  floorListeners.forEach((listener) => listener());
}

/** Persistent-for-session degradation after an OS memory warning. */
export function degradePerformanceTierSession(): void {
  publishSessionFloor(degradePerformanceTier(sessionFloor ?? 'full'));
}

export function resolvePerformancePressureCap(input: {
  lowPowerMode: boolean;
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';
}): PerformanceTier | null {
  if (input.thermalState === 'critical') return 'static';
  if (input.lowPowerMode || input.thermalState === 'serious') return 'minimal';
  return null;
}

export type PerformanceTierState = PerformanceGates & {
  /** Raw capability before session floor. */
  capability: PerformanceTier;
  /** Step the whole-app session floor down one notch. */
  degrade: () => void;
};

/**
 * App-wide performance tier from device capability + Reduce Motion, with a
 * shared session floor that can step down after FPS stutter (or manually).
 */
export function usePerformanceTier(): PerformanceTierState {
  const appIsActive = useAppIsActive();
  const reduceMotion = useReducedMotion();
  useSyncExternalStore(subscribeFloor, getFloorVersion, getFloorVersion);

  const capability = useMemo(
    () =>
      resolvePerformanceTier({
        deviceYearClass: Device.deviceYearClass,
        totalMemory: Device.totalMemory,
        isDevice: Device.isDevice,
        reduceMotion: !!reduceMotion,
        platformOs: Platform.OS,
      }),
    [reduceMotion],
  );

  useEffect(() => {
    publishSessionFloor(capability);
  }, [capability]);

  const sessionTier = minPerformanceTier(
    sessionFloor ?? capability,
    capability,
  );
  const tier = pressureCap
    ? minPerformanceTier(sessionTier, pressureCap)
    : sessionTier;
  const baseGates = performanceGatesFor(tier, Platform.OS);
  const gates = appIsActive
    ? baseGates
    : {
        ...baseGates,
        allowsLoopMotion: false,
        allowsSensors: false,
        particleScale: 0,
        allowsAnimatedSvgProps: false,
      };

  const degrade = () => {
    publishSessionFloor(degradePerformanceTier(sessionFloor ?? capability));
  };

  // One short FPS sample per session while loops are still allowed.
  useEffect(() => {
    if (!appIsActive || fpsSampleArmed) return;
    if (tier === 'static' || tier === 'minimal') return;
    fpsSampleArmed = true;

    let frames = 0;
    let slow = 0;
    let last = 0;
    let raf = 0;
    let samples = 0;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      if (last > 0) {
        const dt = now - last;
        frames += 1;
        if (dt > 34) slow += 1;
      }
      last = now;
      if (frames >= 40) {
        samples += 1;
        const ratio = slow / frames;
        frames = 0;
        slow = 0;
        if (ratio > 0.38) {
          publishSessionFloor(
            degradePerformanceTier(sessionFloor ?? capability),
          );
          return;
        }
        if (samples >= 2) return;
      }
      raf = requestAnimationFrame(tick);
    };

    const cancelStart = deferAfterPageTransition(() => {
      if (!cancelled) raf = requestAnimationFrame(tick);
    }, motion.page + 200);

    return () => {
      cancelled = true;
      cancelStart();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [appIsActive, capability, tier]);

  return {
    ...gates,
    capability,
    degrade,
  };
}

/**
 * Local post-transition gate for mounting loop drivers after a route settle.
 * Combine with `allowsLoopMotion` / feature FX plans.
 */
export function useLiveFxReady(enabled: boolean): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }
    return deferAfterPageTransition(() => setReady(true), motion.page + 120);
  }, [enabled]);

  return ready;
}
