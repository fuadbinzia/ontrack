import type { NativeProcessSnapshot } from '../../../modules/ontrack-performance';

import type {
  PerformanceHourlyRollup,
  PerformanceSessionSummary,
  PerformanceSnapshot,
  PerformanceWarning,
  RuntimeActivitySnapshot,
} from './types';

export const PERFORMANCE_HISTORY_DAYS = 30;
const HOUR_MS = 60 * 60 * 1000;

export function formatPerformanceBytes(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return 'Unavailable';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0]!;
  for (let i = 1; i < units.length && value >= 1024; i += 1) {
    value /= 1024;
    unit = units[i]!;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

export function calculatePerformanceSnapshot(
  native: NativeProcessSnapshot,
  previous?: NativeProcessSnapshot,
  runtime?: { jsEventLoopLagMs?: number; slowFrameRatio?: number; framesPerSecond?: number },
): PerformanceSnapshot {
  const elapsed = previous ? native.timestampMs - previous.timestampMs : 0;
  const cpuDelta = previous ? native.cumulativeCpuMs - previous.cumulativeCpuMs : 0;
  const cpuCorePercent = elapsed > 0 && cpuDelta >= 0 ? (cpuDelta / elapsed) * 100 : undefined;
  const cpuNormalizedPercent =
    cpuCorePercent == null
      ? undefined
      : Math.min(100, cpuCorePercent / Math.max(1, native.processorCount));
  return {
    ...native,
    cpuCorePercent,
    cpuNormalizedPercent,
    networkReceivedDeltaBytes:
      previous?.networkReceivedBytes != null && native.networkReceivedBytes != null
        ? Math.max(0, native.networkReceivedBytes - previous.networkReceivedBytes)
        : undefined,
    networkSentDeltaBytes:
      previous?.networkSentBytes != null && native.networkSentBytes != null
        ? Math.max(0, native.networkSentBytes - previous.networkSentBytes)
        : undefined,
    ...runtime,
  };
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]!;
}

export function summarizePerformanceSession(
  samples: readonly PerformanceSnapshot[],
  foregroundDurationMs: number,
  memoryWarnings = 0,
): PerformanceSessionSummary | null {
  const first = samples[0];
  const last = samples.at(-1);
  if (!first || !last) return null;
  const cpu = samples.flatMap((sample) =>
    sample.cpuNormalizedPercent == null ? [] : [sample.cpuNormalizedPercent],
  );
  const jsLag = samples.flatMap((sample) =>
    sample.jsEventLoopLagMs == null ? [] : [sample.jsEventLoopLagMs],
  );
  return {
    id: `${first.timestampMs}-${last.timestampMs}`,
    startedAt: first.timestampMs,
    endedAt: last.timestampMs,
    foregroundDurationMs,
    sampleCount: samples.length,
    cpuNormalizedAverage:
      cpu.length > 0 ? cpu.reduce((sum, value) => sum + value, 0) / cpu.length : 0,
    cpuNormalizedPeak: cpu.length > 0 ? Math.max(...cpu) : 0,
    memoryPeakBytes: Math.max(...samples.map((sample) => sample.memoryBytes)),
    jsLagP95Ms: percentile(jsLag, 0.95),
    networkReceivedBytes: samples.reduce(
      (sum, sample) => sum + (sample.networkReceivedDeltaBytes ?? 0), 0,
    ),
    networkSentBytes: samples.reduce(
      (sum, sample) => sum + (sample.networkSentDeltaBytes ?? 0), 0,
    ),
    thermalPressureSamples: samples.filter(
      (sample) => sample.thermalState === 'serious' || sample.thermalState === 'critical',
    ).length,
    memoryWarnings,
    batteryStart: first.batteryLevel,
    batteryEnd: last.batteryLevel,
  };
}

export function derivePerformanceWarnings(
  samples: readonly PerformanceSnapshot[],
): PerformanceWarning[] {
  const warnings: PerformanceWarning[] = [];
  const latest = samples.at(-1);
  if (!latest) return warnings;
  const recent30 = samples.filter((sample) => sample.timestampMs >= latest.timestampMs - 30_000);
  const sustainedCpu =
    recent30.length >= 2 &&
    recent30.every((sample) => (sample.cpuNormalizedPercent ?? 0) >= 35);
  if (sustainedCpu) {
    warnings.push({
      id: 'cpu-sustained', kind: 'cpu', severity: 'warning', title: 'Sustained CPU load',
      detail: 'CPU stayed above 35% of device capacity for about 30 seconds. Check active visual effects and repeated work.',
    });
  }
  const recentFive = samples.filter((sample) => sample.timestampMs >= latest.timestampMs - 5 * 60_000);
  const earliest = recentFive[0];
  if (
    earliest &&
    latest.memoryBytes - earliest.memoryBytes > 64 * 1024 * 1024 &&
    latest.memoryBytes > earliest.memoryBytes * 1.25
  ) {
    warnings.push({
      id: 'memory-growth', kind: 'memory', severity: 'warning', title: 'Memory is climbing',
      detail: 'The process grew by more than 64 MB and 25% in five minutes. Repeat the current flow and inspect retained images or listeners.',
    });
  }
  if (latest.memoryPressure) {
    warnings.push({
      id: 'memory-pressure', kind: 'memory', severity: 'critical', title: 'Memory pressure',
      detail: 'The operating system reported low memory. onTrack reduced optional visual work for this session.',
    });
  }
  if (percentile(recent30.flatMap((sample) => sample.jsEventLoopLagMs == null ? [] : [sample.jsEventLoopLagMs]), 0.95) > 50) {
    warnings.push({
      id: 'js-lag', kind: 'javascript', severity: 'warning', title: 'JavaScript thread delay',
      detail: 'The 95th-percentile event-loop delay exceeded 50 ms. Look for synchronous parsing, large state updates, or repeated renders.',
    });
  }
  const slowFrames = recent30.flatMap((sample) => sample.slowFrameRatio == null ? [] : [sample.slowFrameRatio]);
  if (slowFrames.length > 0 && slowFrames.reduce((sum, value) => sum + value, 0) / slowFrames.length > 0.2) {
    warnings.push({
      id: 'slow-frames', kind: 'frames', severity: 'warning', title: 'Slow frame rate',
      detail: 'More than 20% of measured frames missed a 34 ms budget. Reduce simultaneous motion or expensive glass effects.',
    });
  }
  if (latest.thermalState === 'serious' || latest.thermalState === 'critical') {
    warnings.push({
      id: 'thermal', kind: 'thermal', severity: latest.thermalState === 'critical' ? 'critical' : 'warning',
      title: 'Device is running hot', detail: 'Optional blur, sensors, and looping motion are being reduced until thermal pressure clears.',
    });
  }
  const recentMinute = samples.filter((sample) => sample.timestampMs >= latest.timestampMs - 60_000);
  const networkBytes = recentMinute.reduce(
    (sum, sample) => sum + (sample.networkReceivedDeltaBytes ?? 0) + (sample.networkSentDeltaBytes ?? 0),
    0,
  );
  if (networkBytes > 10 * 1024 * 1024) {
    warnings.push({
      id: 'network-burst', kind: 'network', severity: 'warning', title: 'Heavy network activity',
      detail: 'More than 10 MB moved in the last minute. Check image transfers, imports, and repeated refreshes.',
    });
  }
  return warnings;
}

export function deriveRuntimeWarnings(
  activities: readonly RuntimeActivitySnapshot[],
  now = Date.now(),
): PerformanceWarning[] {
  return activities
    .filter(
      (activity) =>
        (activity.category === 'network' || activity.category === 'sync') &&
        activity.errors >= 3 &&
        now - activity.updatedAt <= 5 * 60_000,
    )
    .map((activity) => ({
      id: `network-errors.${activity.id}`,
      kind: 'network' as const,
      severity: 'warning' as const,
      title: `Repeated errors: ${activity.label}`,
      detail: `${activity.errors} failures were recorded by this runtime activity. Check connectivity, retries, and request logs.`,
    }));
}

export function hourKey(timestampMs: number): string {
  const date = new Date(Math.floor(timestampMs / HOUR_MS) * HOUR_MS);
  return date.toISOString();
}

export function mergeSamplesIntoRollups(
  current: Record<string, PerformanceHourlyRollup>,
  samples: readonly PerformanceSnapshot[],
  memoryWarnings = 0,
  now = Date.now(),
): Record<string, PerformanceHourlyRollup> {
  const next = { ...current };
  for (const sample of samples) {
    const hour = hourKey(sample.timestampMs);
    const existing = next[hour];
    const row = existing ? { ...existing } : {
      hour, sampleCount: 0, cpuNormalizedTotal: 0, cpuNormalizedPeak: 0,
      memoryTotalBytes: 0, memoryPeakBytes: 0, jsLagTotalMs: 0, jsLagPeakMs: 0,
      slowFrameRatioTotal: 0, networkReceivedBytes: 0, networkSentBytes: 0,
      thermalPressureSamples: 0, lowPowerSamples: 0, memoryWarnings: 0,
    };
    row.sampleCount += 1;
    row.cpuNormalizedTotal += sample.cpuNormalizedPercent ?? 0;
    row.cpuNormalizedPeak = Math.max(row.cpuNormalizedPeak, sample.cpuNormalizedPercent ?? 0);
    row.memoryTotalBytes += sample.memoryBytes;
    row.memoryPeakBytes = Math.max(row.memoryPeakBytes, sample.memoryBytes);
    row.jsLagTotalMs += sample.jsEventLoopLagMs ?? 0;
    row.jsLagPeakMs = Math.max(row.jsLagPeakMs, sample.jsEventLoopLagMs ?? 0);
    row.slowFrameRatioTotal += sample.slowFrameRatio ?? 0;
    row.networkReceivedBytes += sample.networkReceivedDeltaBytes ?? 0;
    row.networkSentBytes += sample.networkSentDeltaBytes ?? 0;
    row.thermalPressureSamples += sample.thermalState === 'serious' || sample.thermalState === 'critical' ? 1 : 0;
    row.lowPowerSamples += sample.lowPowerMode ? 1 : 0;
    row.batteryStart ??= sample.batteryLevel;
    row.batteryEnd = sample.batteryLevel ?? row.batteryEnd;
    next[hour] = row;
  }
  const latestHour = samples.at(-1) ? hourKey(samples.at(-1)!.timestampMs) : undefined;
  if (latestHour && next[latestHour]) next[latestHour]!.memoryWarnings += memoryWarnings;
  const cutoff = now - PERFORMANCE_HISTORY_DAYS * 24 * HOUR_MS;
  return Object.fromEntries(Object.entries(next).filter(([key]) => Date.parse(key) >= cutoff));
}
