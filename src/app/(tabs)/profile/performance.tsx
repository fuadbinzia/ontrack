import { DevAccessGate } from '@/features/account/dev-access-gate';
import { PerformanceMonitorScreen } from '@/features/performance/performance-monitor-screen';

export default function PerformanceMonitorRoute() {
  return (
    <DevAccessGate>
      <PerformanceMonitorScreen />
    </DevAccessGate>
  );
}
