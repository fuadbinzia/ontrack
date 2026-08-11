import type { NativeProcessSnapshot } from '../../../../modules/ontrack-performance';

import {
  calculatePerformanceSnapshot,
  derivePerformanceWarnings,
  deriveRuntimeWarnings,
  formatPerformanceBytes,
  hourKey,
  mergeSamplesIntoRollups,
  summarizePerformanceSession,
} from '../performance-metrics';
import type { PerformanceSnapshot } from '../types';
import { getPerformanceSampleIntervalMs } from '../performance-monitor-provider';

function native(
  timestampMs: number,
  cumulativeCpuMs: number,
  memoryBytes = 100 * 1024 * 1024,
): NativeProcessSnapshot {
  return {
    timestampMs,
    processId: 42,
    processName: 'onTrack',
    uptimeMs: timestampMs,
    cumulativeCpuMs,
    processorCount: 4,
    memoryBytes,
    batteryState: 'unplugged',
    lowPowerMode: false,
    thermalState: 'nominal',
    memoryPressure: false,
  };
}

function sample(timestampMs: number, patch: Partial<PerformanceSnapshot> = {}): PerformanceSnapshot {
  return {
    ...calculatePerformanceSnapshot(native(timestampMs, timestampMs / 10)),
    ...patch,
  };
}

describe('performance metrics', () => {
  it('normalizes cumulative CPU deltas by processor count', () => {
    const result = calculatePerformanceSnapshot(
      native(2_000, 500),
      native(1_000, 100),
    );
    expect(result.cpuCorePercent).toBe(40);
    expect(result.cpuNormalizedPercent).toBe(10);
  });

  it('switches between lightweight foreground and detailed dashboard sampling', () => {
    expect(getPerformanceSampleIntervalMs(false)).toBe(15_000);
    expect(getPerformanceSampleIntervalMs(true)).toBe(1_000);
  });

  it('formats missing and scaled memory without fabricating zeroes', () => {
    expect(formatPerformanceBytes()).toBe('Unavailable');
    expect(formatPerformanceBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('raises explicit CPU, JS, frame, memory, and thermal warnings', () => {
    const start = 1_000_000;
    const samples = Array.from({ length: 7 }, (_, index) => sample(start + index * 5_000, {
      cpuNormalizedPercent: 40,
      jsEventLoopLagMs: 70,
      slowFrameRatio: 0.3,
      memoryBytes: 100 * 1024 * 1024 + index * 15 * 1024 * 1024,
      thermalState: index === 6 ? 'serious' : 'nominal',
    }));
    expect(derivePerformanceWarnings(samples).map((item) => item.id)).toEqual(
      expect.arrayContaining(['cpu-sustained', 'memory-growth', 'js-lag', 'slow-frames', 'thermal']),
    );
  });

  it('warns after repeated recent network errors', () => {
    const now = 5_000_000;
    expect(deriveRuntimeWarnings([{
      id: 'api.requests', label: 'API requests', category: 'network', status: 'error',
      updatedAt: now, operations: 4, errors: 3, pending: 0, receivedBytes: 0, sentBytes: 0,
    }], now)).toEqual([
      expect.objectContaining({ id: 'network-errors.api.requests', kind: 'network' }),
    ]);
  });

  it('merges hourly rollups and prunes entries older than 30 days', () => {
    const now = Date.UTC(2026, 7, 11, 12);
    const stale = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString();
    const next = mergeSamplesIntoRollups(
      {
        [stale]: {
          hour: stale, sampleCount: 1, cpuNormalizedTotal: 1, cpuNormalizedPeak: 1,
          memoryTotalBytes: 1, memoryPeakBytes: 1, jsLagTotalMs: 0, jsLagPeakMs: 0,
          slowFrameRatioTotal: 0, networkReceivedBytes: 0, networkSentBytes: 0,
          thermalPressureSamples: 0, lowPowerSamples: 0, memoryWarnings: 0,
        },
      },
      [sample(now, { cpuNormalizedPercent: 20, memoryBytes: 200 })],
      1,
      now,
    );
    expect(next[stale]).toBeUndefined();
    expect(next[hourKey(now)]).toMatchObject({
      sampleCount: 1,
      cpuNormalizedTotal: 20,
      memoryPeakBytes: 200,
      memoryWarnings: 1,
    });
  });

  it('summarizes session averages, peaks, lag, battery, and foreground time', () => {
    const summary = summarizePerformanceSession([
      sample(1_000, { cpuNormalizedPercent: 10, jsEventLoopLagMs: 5, batteryLevel: 0.8 }),
      sample(2_000, {
        cpuNormalizedPercent: 30,
        jsEventLoopLagMs: 55,
        batteryLevel: 0.78,
        memoryBytes: 300 * 1024 * 1024,
      }),
    ], 1_500, 1);
    expect(summary).toMatchObject({
      foregroundDurationMs: 1_500,
      sampleCount: 2,
      cpuNormalizedAverage: 20,
      cpuNormalizedPeak: 30,
      memoryPeakBytes: 300 * 1024 * 1024,
      jsLagP95Ms: 55,
      batteryStart: 0.8,
      batteryEnd: 0.78,
      memoryWarnings: 1,
    });
  });
});
