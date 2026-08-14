import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { AppText, Button } from '@/components/primitives';
import { layout, radii, spacing } from '@/design-system';
import type { ExerciseTemplate } from '@/features/workouts/muscle-data';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { formatCount } from '@/utils/grammar';

interface WorkoutSessionBuilderProps {
  selectedExercises: ExerciseTemplate[];
  selectedSetCount: number;
  estimatedDuration: number;
  onClear: () => void;
  onAddToToday: () => void;
}

/** Dark session-builder panel for the workouts planner tab. */
export function WorkoutSessionBuilder({
  selectedExercises,
  selectedSetCount,
  estimatedDuration,
  onClear,
  onAddToToday,
}: WorkoutSessionBuilderProps) {
  // Hooks must run even when the builder is empty (not yet selected).
  const clearAgent = useAgentUiTarget(
    selectedExercises.length ? AgentUiIds.workouts.builderClear : undefined,
    {
      label: 'Clear selected exercises',
      onPress: onClear,
    },
  );
  if (selectedExercises.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.duration(260)} style={styles.pagePadding}>
      <LinearGradient
        colors={['#35201D', '#1B1210']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.builder}>
        <View style={styles.builderHeader}>
          <View style={styles.flex}>
            <AppText variant="overline" style={styles.builderOverline}>
              Session builder
            </AppText>
            <AppText variant="heading" style={styles.builderTitle}>
              Your workout is taking shape.
            </AppText>
          </View>
          <Pressable
            ref={clearAgent.ref}
            testID={clearAgent.testID}
            onLayout={clearAgent.onLayout}
            accessibilityRole="button"
            accessibilityLabel="Clear selected exercises"
            hitSlop={8}
            onPress={onClear}>
            <AppText variant="caption" style={styles.builderClear}>
              Clear
            </AppText>
          </Pressable>
        </View>

        <View style={styles.builderMetrics}>
          <View style={styles.builderMetric}>
            <AppText variant="metric" style={styles.builderMetricValue}>
              {selectedExercises.length}
            </AppText>
            <AppText variant="caption" style={styles.builderMetricLabel}>
              Exercises
            </AppText>
          </View>
          <View style={styles.builderMetric}>
            <AppText variant="metric" style={styles.builderMetricValue}>
              {selectedSetCount}
            </AppText>
            <AppText variant="caption" style={styles.builderMetricLabel}>
              Working sets
            </AppText>
          </View>
          <View style={styles.builderMetric}>
            <AppText variant="metric" style={styles.builderMetricValue}>
              {estimatedDuration}
            </AppText>
            <AppText variant="caption" style={styles.builderMetricLabel}>
              Minutes
            </AppText>
          </View>
        </View>

        <AppText variant="caption" numberOfLines={2} style={styles.builderNames}>
          {selectedExercises.map((exercise) => exercise.name).join('  ·  ')}
        </AppText>
        <Button
          size="lg"
          icon="calendar-add"
          testID={AgentUiIds.workouts.addToToday}
          onPress={onAddToToday}
          accessibilityLabel={`Add ${formatCount(selectedExercises.length, 'exercise')} to today`}>
          Add workout to today
        </Button>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pagePadding: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  },
  flex: { flex: 1 },
  builder: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  builderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  builderOverline: { color: 'rgba(255,255,255,0.55)' },
  builderTitle: { color: '#FFFFFF' },
  builderClear: { color: 'rgba(255,255,255,0.72)' },
  builderMetrics: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  builderMetric: { flex: 1, gap: spacing.xxs },
  builderMetricValue: { color: '#FFFFFF' },
  builderMetricLabel: { color: 'rgba(255,255,255,0.55)' },
  builderNames: { color: 'rgba(255,255,255,0.72)' },
});
