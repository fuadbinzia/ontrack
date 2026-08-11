export type NativeThermalState = 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';

export type NativeBatteryState =
  | 'charging'
  | 'full'
  | 'unplugged'
  | 'unknown';

export type NativeProcessSnapshot = {
  timestampMs: number;
  processId: number;
  processName: string;
  uptimeMs: number;
  cumulativeCpuMs: number;
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
  batteryLevel?: number;
  batteryState: NativeBatteryState;
  lowPowerMode: boolean;
  thermalState: NativeThermalState;
  networkReceivedBytes?: number;
  networkSentBytes?: number;
  memoryPressure: boolean;
};

export type NativeMemoryWarningEvent = {
  timestampMs: number;
  level: 'warning' | 'critical';
};
