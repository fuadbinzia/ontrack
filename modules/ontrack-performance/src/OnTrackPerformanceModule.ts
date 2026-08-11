import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  NativeMemoryWarningEvent,
  NativeProcessSnapshot,
} from './OnTrackPerformance.types';

declare class OnTrackPerformanceModule extends NativeModule<{
  onMemoryWarning(event: NativeMemoryWarningEvent): void;
}> {
  getSnapshotAsync(): Promise<NativeProcessSnapshot>;
}

export default requireOptionalNativeModule<OnTrackPerformanceModule>(
  'OnTrackPerformance',
);
