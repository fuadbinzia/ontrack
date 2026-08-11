import type {
  NativeMemoryWarningEvent,
  NativeProcessSnapshot,
} from '../../../modules/ontrack-performance';
import OnTrackPerformance from '../../../modules/ontrack-performance';

export async function getNativePerformanceSnapshot(): Promise<NativeProcessSnapshot | null> {
  if (!OnTrackPerformance) return null;
  try {
    return await OnTrackPerformance.getSnapshotAsync();
  } catch {
    return null;
  }
}

export function subscribeNativeMemoryWarnings(
  listener: (event: NativeMemoryWarningEvent) => void,
): () => void {
  if (!OnTrackPerformance) return () => undefined;
  const subscription = OnTrackPerformance.addListener('onMemoryWarning', listener);
  return () => subscription.remove();
}
