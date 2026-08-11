import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  degradePerformanceTierSession,
  resolvePerformancePressureCap,
  setPerformancePressureCap,
} from '@/hooks/use-performance-tier';
import { useAccountFlags } from '@/store/account-flags';
import { usePerformanceHistory } from '@/store/performance-history';
import { usePerformanceRuntime } from '@/store/performance-runtime';

import {
  getNativePerformanceSnapshot,
  subscribeNativeMemoryWarnings,
} from './native-performance';
import {
  calculatePerformanceSnapshot,
  summarizePerformanceSession,
} from './performance-metrics';
import { setRuntimeActivity } from './runtime-activity';
import type { PerformanceSnapshot } from './types';

const DETAIL_SAMPLE_MS = 1_000;
const FOREGROUND_SAMPLE_MS = 15_000;
const HISTORY_FLUSH_MS = 5 * 60_000;

export function getPerformanceSampleIntervalMs(detailed: boolean): number {
  return detailed ? DETAIL_SAMPLE_MS : FOREGROUND_SAMPLE_MS;
}

export function PerformanceMonitorProvider() {
  const developerTools = useAccountFlags((state) => state.developerTools);
  const detailed = usePerformanceRuntime((state) => state.detailed);
  const enabled = developerTools;
  const detailedRef = useRef(detailed);
  const [foreground, setForeground] = useState(
    () => AppState.currentState === 'active',
  );
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const previousNative = useRef<
    Awaited<ReturnType<typeof getNativePerformanceSnapshot>> | undefined
  >(undefined);
  const pendingHistory = useRef<PerformanceSnapshot[]>([]);
  const lastFlushAt = useRef(0);
  const memoryWarningsSinceFlush = useRef(0);
  const sessionSamples = useRef<PerformanceSnapshot[]>([]);
  const sessionMemoryWarnings = useRef(0);
  const foregroundStartedAt = useRef(0);
  const foregroundDuration = useRef(0);
  const frameStats = useRef({ frames: 0, slow: 0, startedAt: 0, lastAt: 0 });

  useEffect(() => {
    detailedRef.current = detailed;
  }, [detailed]);

  useEffect(() => {
    if (!enabled) {
      setPerformancePressureCap(null);
      return;
    }
    setRuntimeActivity(
      {
        id: 'performance.collector',
        label: 'Performance collector',
        category: 'system',
      },
      {
        status: AppState.currentState === 'active' ? 'running' : 'paused',
        detail: detailed ? '1 second samples' : '15 second samples',
      },
    );
    return () => setPerformancePressureCap(null);
  }, [detailed, enabled]);

  useEffect(() => {
    if (!enabled || !detailed || !foreground) return;
    let raf = 0;
    frameStats.current = {
      frames: 0,
      slow: 0,
      startedAt: performance.now(),
      lastAt: 0,
    };
    const tick = (now: number) => {
      const stats = frameStats.current;
      if (stats.lastAt > 0) {
        stats.frames += 1;
        if (now - stats.lastAt > 34) stats.slow += 1;
      }
      stats.lastAt = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [detailed, enabled, foreground]);

  useEffect(() => {
    if (!enabled) return;
    if (appState.current === 'active' && foregroundStartedAt.current === 0) {
      foregroundStartedAt.current = Date.now();
    }
    if (lastFlushAt.current === 0) lastFlushAt.current = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flushHistory = () => {
      const samples = pendingHistory.current;
      const warnings = memoryWarningsSinceFlush.current;
      if (samples.length === 0 && warnings === 0) return;
      pendingHistory.current = [];
      memoryWarningsSinceFlush.current = 0;
      lastFlushAt.current = Date.now();
      usePerformanceHistory.getState().appendSamples(samples, warnings);
    };

    const finishSession = () => {
      const duration = foregroundDuration.current + (
        foregroundStartedAt.current > 0 ? Date.now() - foregroundStartedAt.current : 0
      );
      const summary = summarizePerformanceSession(
        sessionSamples.current,
        duration,
        sessionMemoryWarnings.current,
      );
      if (summary) usePerformanceHistory.getState().appendSession(summary);
      sessionSamples.current = [];
      sessionMemoryWarnings.current = 0;
      foregroundDuration.current = 0;
      foregroundStartedAt.current = 0;
    };

    const sample = async (expectedAt: number) => {
      if (cancelled || appState.current !== 'active') return;
      const native = await getNativePerformanceSnapshot();
      if (cancelled) return;
      if (!native) {
        usePerformanceRuntime.getState().setSupported(false);
        return;
      }
      const stats = frameStats.current;
      const elapsedFramesMs =
        stats.startedAt > 0 ? performance.now() - stats.startedAt : 0;
      const isDetailed = detailedRef.current;
      const runtime = isDetailed
        ? {
            jsEventLoopLagMs: Math.max(0, Date.now() - expectedAt),
            slowFrameRatio: stats.frames > 0 ? stats.slow / stats.frames : 0,
            framesPerSecond:
              elapsedFramesMs > 0
                ? stats.frames / (elapsedFramesMs / 1000)
                : undefined,
          }
        : { jsEventLoopLagMs: Math.max(0, Date.now() - expectedAt) };
      if (isDetailed) {
        frameStats.current = {
          frames: 0,
          slow: 0,
          startedAt: performance.now(),
          lastAt: 0,
        };
      }
      const next = calculatePerformanceSnapshot(
        native,
        previousNative.current ?? undefined,
        runtime,
      );
      previousNative.current = native;
      usePerformanceRuntime.getState().addSample(next);
      pendingHistory.current.push(next);
      sessionSamples.current.push(next);
      setPerformancePressureCap(resolvePerformancePressureCap(next));
      if (Date.now() - lastFlushAt.current >= HISTORY_FLUSH_MS) flushHistory();
    };

    const arm = () => {
      if (cancelled) return;
      const interval = getPerformanceSampleIntervalMs(detailedRef.current);
      const expectedAt = Date.now() + interval;
      timer = setTimeout(() => {
        void sample(expectedAt).finally(arm);
      }, interval);
    };

    void sample(Date.now()).finally(arm);
    const appStateSubscription = AppState.addEventListener('change', (next) => {
      appState.current = next;
      setForeground(next === 'active');
      setRuntimeActivity(
        {
          id: 'performance.collector',
          label: 'Performance collector',
          category: 'system',
        },
        {
          status: next === 'active' ? 'running' : 'paused',
          detail: detailedRef.current ? '1 second samples' : '15 second samples',
        },
      );
      if (next !== 'active') {
        if (foregroundStartedAt.current > 0) {
          foregroundDuration.current += Date.now() - foregroundStartedAt.current;
          foregroundStartedAt.current = 0;
        }
        flushHistory();
        finishSession();
      } else if (foregroundStartedAt.current === 0) {
        foregroundStartedAt.current = Date.now();
      }
    });
    const removeNativeWarning = subscribeNativeMemoryWarnings(() => {
      memoryWarningsSinceFlush.current += 1;
      sessionMemoryWarnings.current += 1;
      usePerformanceRuntime.getState().recordMemoryWarning();
      degradePerformanceTierSession();
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      flushHistory();
      finishSession();
      appStateSubscription.remove();
      removeNativeWarning();
    };
  }, [enabled]);

  return null;
}
