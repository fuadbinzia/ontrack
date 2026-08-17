import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

import { formatVoiceDuration } from './model';
import {
  useJournalRecorderLiveState,
  type JournalAudioRecorder,
} from './use-journal-recorder';
import { meteringToWaveLevel, pushWaveSample } from './voice-wave';

/**
 * Live take readout for the composer pill: a scrolling level wave plus the
 * elapsed clock. Owns the 10Hz recorder polling so only this leaf re-renders.
 */
export function JournalRecordingWave({
  audioRecorder,
  testID,
}: {
  audioRecorder: JournalAudioRecorder;
  testID?: string;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const { meteringDb, elapsedMs } = useJournalRecorderLiveState(audioRecorder);
  const [levels, setLevels] = useState<number[]>([]);
  const meteringRef = useRef(meteringDb);
  meteringRef.current = meteringDb;

  useEffect(() => {
    // Each duration tick appends one bar so the wave scrolls like a live take.
    setLevels((prev) => pushWaveSample(prev, meteringToWaveLevel(meteringRef.current)));
  }, [elapsedMs]);

  const trackHeight = Math.max(24, s(26));
  const barWidth = Math.max(2.5, s(3));

  return (
    <View style={[styles.row, { gap: spacing.sm }]} testID={testID} pointerEvents="none">
      <View style={[styles.track, { height: trackHeight, gap: Math.max(2, s(2)) }]}>
        {levels.map((level, index) => (
          <View
            key={index}
            style={{
              width: barWidth,
              borderRadius: barWidth / 2,
              height: Math.max(barWidth, level * trackHeight),
              backgroundColor: theme.accentPrimary,
            }}
          />
        ))}
      </View>
      <AppText variant="caption" color="secondary" style={styles.elapsed}>
        {formatVoiceDuration(elapsedMs)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  track: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  elapsed: {
    fontVariant: ['tabular-nums'],
  },
});
