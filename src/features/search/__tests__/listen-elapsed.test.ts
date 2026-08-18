import { formatVoiceDuration } from '@/features/journal/model';

import { listenElapsedMs } from '../listen-elapsed';

describe('listenElapsedMs', () => {
  it('counts wall-clock elapsed from startedAt even when durationMillis is 0', () => {
    const durationMillis = 0;
    expect(listenElapsedMs(1_000, 1_000)).toBe(0);
    expect(listenElapsedMs(1_000, 2_500)).toBe(1_500);
    expect(listenElapsedMs(1_000, 2_000)).toBe(1_000);
    expect(durationMillis).toBe(0);
    expect(formatVoiceDuration(listenElapsedMs(1_000, 1_000))).toBe('0:00');
    expect(formatVoiceDuration(listenElapsedMs(1_000, 2_000))).toBe('0:01');
    expect(formatVoiceDuration(listenElapsedMs(1_000, 61_000))).toBe('1:00');
  });

  it('stays at 0 when listen has not started', () => {
    expect(listenElapsedMs(null, 5_000)).toBe(0);
    expect(listenElapsedMs(undefined, 5_000)).toBe(0);
    expect(listenElapsedMs(0, 5_000)).toBe(0);
    expect(formatVoiceDuration(listenElapsedMs(null, 5_000))).toBe('0:00');
  });

  it('does not go negative when now is before startedAt', () => {
    expect(listenElapsedMs(5_000, 4_000)).toBe(0);
  });
});
