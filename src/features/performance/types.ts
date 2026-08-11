import type {
  NativeBatteryState,
  NativeThermalState,
} from '../../../modules/ontrack-performance';

export type PerformanceSnapshot = {
  timestampMs: number;
  processId: number;
  processName: string;
  uptimeMs: number;
  processorCount: number;
  threadCount?: number;
  memoryBytes: number;
  totalMemoryBytes?: number;
  availableMemoryBytes?: number;
  nativeHeapBytes?: number;
  javaHeapBytes?: number;
  graphicsBytes?: number;
  codeBytes?: number;
  stackBytes?: number;
  systemMemoryBytes?: number;
  cpuCorePercent?: number;
  cpuNormalizedPercent?: number;
  batteryLevel?: number;
  batteryState: NativeBatteryState;
  lowPowerMode: boolean;
  thermalState: NativeThermalState;
  networkReceivedBytes?: number;
  networkSentBytes?: number;
  networkReceivedDeltaBytes?: number;
  networkSentDeltaBytes?: number;
  memoryPressure: boolean;
  jsEventLoopLagMs?: number;
  slowFrameRatio?: number;
  framesPerSecond?: number;
};

export type RuntimeActivityCategory =
  | 'sync'
  | 'network'
  | 'system'
  | 'visual';

export type RuntimeActivityStatus = 'idle' | 'running' | 'paused' | 'error';

export type RuntimeActivitySnapshot = {
  id: string;
  label: string;
  category: RuntimeActivityCategory;
  status: RuntimeActivityStatus;
  startedAt?: number;
  updatedAt: number;
  operations: number;
  errors: number;
  pending: number;
  receivedBytes: number;
  sentBytes: number;
  detail?: string;
};

export type PerformanceWarningKind =
  | 'cpu'
  | 'memory'
  | 'javascript'
  | 'frames'
  | 'thermal'
  | 'network';

export type PerformanceWarning = {
  id: string;
  kind: PerformanceWarningKind;
  severity: 'warning' | 'critical';
  title: string;
  detail: string;
};

export type PerformanceHourlyRollup = {
  hour: string;
  sampleCount: number;
  cpuNormalizedTotal: number;
  cpuNormalizedPeak: number;
  memoryTotalBytes: number;
  memoryPeakBytes: number;
  jsLagTotalMs: number;
  jsLagPeakMs: number;
  slowFrameRatioTotal: number;
  networkReceivedBytes: number;
  networkSentBytes: number;
  thermalPressureSamples: number;
  lowPowerSamples: number;
  memoryWarnings: number;
  batteryStart?: number;
  batteryEnd?: number;
};

export type PerformanceSessionSummary = {
  id: string;
  startedAt: number;
  endedAt: number;
  foregroundDurationMs: number;
  sampleCount: number;
  cpuNormalizedAverage: number;
  cpuNormalizedPeak: number;
  memoryPeakBytes: number;
  jsLagP95Ms: number;
  networkReceivedBytes: number;
  networkSentBytes: number;
  thermalPressureSamples: number;
  memoryWarnings: number;
  batteryStart?: number;
  batteryEnd?: number;
};
