import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { VoicePendingOp } from './OnTrackVoiceLists.types';

declare class OnTrackVoiceListsModule extends NativeModule<{
  onPending(): void;
}> {
  publishSnapshotAsync(json: string): Promise<void>;
  takePendingAsync(): Promise<VoicePendingOp[]>;
}

export default requireOptionalNativeModule<OnTrackVoiceListsModule>(
  'OnTrackVoiceLists',
);
