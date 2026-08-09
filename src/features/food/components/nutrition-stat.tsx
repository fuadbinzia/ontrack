import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, GlassPlate, statusBadgeToneColor, type StatusBadgeTone } from '@/components/primitives';
import { glassMaterials, radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId } from '@/utils/agent-ui';

export interface NutritionStatProps {
  /** Big number, e.g. "420" or "32g". */
  value: string;
  /** Caption below the number, e.g. "Calories". */
  label: string;
  /** 0–1 fill for the optional pill progress bar. */
  progress?: number;
  tone?: StatusBadgeTone;
  /** Layout-anchor testID (non-interactive). */
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Clamped 0–1 progress for the pill bar. */
export function nutritionStatProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}

/** Compact mist-glass stat tile: big number, caption, optional progress pill. */
export function NutritionStat({
  value,
  label,
  progress,
  tone = 'neutral',
  testID,
  style,
}: NutritionStatProps) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const toneColor = statusBadgeToneColor(tone, theme);
  const barHeight = Math.max(4, Math.min(6, s(5)));
  const trackColor =
    theme.name === 'dark'
      ? glassMaterials.fill.mistSolid
      : glassMaterials.fill.mistLightSolid;

  return (
    <AgentTestId testID={testID} label={`${value} ${label}`}>
      <GlassPlate
        mist
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${value} ${label}`}
        style={[
          styles.tile,
          {
            minWidth: s(96),
            minHeight: s(76),
            borderRadius: radii.md,
            padding: spacing.md,
            gap: spacing.xs,
          },
          style,
        ]}>
        <AppText variant="heading" fit>
          {value}
        </AppText>
        <AppText variant="caption" color="secondary" fit>
          {label}
        </AppText>
        {progress != null ? (
          <View
            style={[
              styles.track,
              { height: barHeight, backgroundColor: trackColor },
            ]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${nutritionStatProgress(progress) * 100}%`,
                  backgroundColor: toneColor,
                },
              ]}
            />
          </View>
        ) : null}
      </GlassPlate>
    </AgentTestId>
  );
}

const styles = StyleSheet.create({
  tile: {
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  track: {
    width: '100%',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    borderRadius: radii.pill,
  },
});
