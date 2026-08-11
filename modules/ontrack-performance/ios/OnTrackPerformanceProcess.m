#import "OnTrackPerformanceProcess.h"

#import <sys/sysctl.h>

double OnTrackProcessUptimeMilliseconds(int32_t processId) {
  int mib[] = {CTL_KERN, KERN_PROC, KERN_PROC_PID, processId};
  struct kinfo_proc info = {0};
  size_t size = sizeof(info);
  if (sysctl(mib, 4, &info, &size, NULL, 0) != 0 || size != sizeof(info)) {
    return 0;
  }

  const struct timeval startedAt = info.kp_proc.p_starttime;
  const double started = (double)startedAt.tv_sec + ((double)startedAt.tv_usec / 1000000.0);
  return MAX(0, ([[NSDate date] timeIntervalSince1970] - started) * 1000.0);
}
