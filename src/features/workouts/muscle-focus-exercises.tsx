import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, GlassPlate, SectionHeader, Symbol } from '@/components/primitives';
import { layout, radii, spacing } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { formatCount } from '@/utils/grammar';

import {
  type ExerciseLoadKind,
  filterExercisesByLoadKind,
} from './exercise-load';
import type { ExerciseTemplate } from './muscle-data';

const LOAD_TABS: { id: ExerciseLoadKind; label: string }[] = [
  { id: 'weighted', label: 'Weighted' },
  { id: 'bodyweight', label: 'Bodyweight' },
];

interface MuscleFocusExercisesProps {
  muscleLabel: string;
  exercises: ExerciseTemplate[];
  loadKind: ExerciseLoadKind;
  selectedExerciseIds: string[];
  accentTint: string;
  accentMain: string;
  onChangeLoadKind: (kind: ExerciseLoadKind) => void;
  onPreview: (exercise: ExerciseTemplate) => void;
  onToggle: (exerciseId: string) => void;
}

export function MuscleFocusExercises({
  muscleLabel,
  exercises,
  loadKind,
  selectedExerciseIds,
  accentTint,
  accentMain,
  onChangeLoadKind,
  onPreview,
  onToggle,
}: MuscleFocusExercisesProps) {
  const theme = useTheme();
  const { s, spacing: rs } = useResponsive();
  const visibleExercises = filterExercisesByLoadKind(exercises, loadKind);
  const bodyweightCount = filterExercisesByLoadKind(exercises, 'bodyweight').length;
  const weightedCount = filterExercisesByLoadKind(exercises, 'weighted').length;
  const tabMinHeight = Math.max(44, s(36));

  const changeLoadKind = (kind: ExerciseLoadKind) => {
    if (kind === loadKind) return;
    haptics.select();
    onChangeLoadKind(kind);
  };

  return (
    <View style={styles.pagePadding}>
      <SectionHeader title={`Workouts for ${muscleLabel}`} />

      {exercises.length > 0 ? (
        <GlassPlate
          style={[
            styles.loadToggle,
            {
              borderColor: theme.separator,
              marginBottom: rs.md,
            },
          ]}>
          <View style={[styles.loadToggleRow, styles.glassContent]}>
            {LOAD_TABS.map((tab) => {
              const selected = loadKind === tab.id;
              const count = tab.id === 'bodyweight' ? bodyweightCount : weightedCount;
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="tab"
                  accessibilityLabel={`${tab.label} workouts`}
                  accessibilityState={{ selected }}
                  onPress={() => changeLoadKind(tab.id)}
                  style={[
                    styles.loadTab,
                    {
                      minHeight: tabMinHeight,
                      paddingHorizontal: rs.md,
                    },
                    selected && styles.selectedLoadTab,
                  ]}>
                  {selected ? (
                    <GlassPlate airy style={StyleSheet.absoluteFill} />
                  ) : null}
                  <View style={[styles.loadTabLabel, styles.glassContent]}>
                    <AppText
                      variant="caption"
                      color={selected ? 'primary' : 'secondary'}
                      fit
                      style={styles.loadTabText}>
                      {tab.label}
                    </AppText>
                    <AppText
                      variant="caption"
                      color={selected ? 'accent' : 'tertiary'}
                      fit>
                      {count}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </GlassPlate>
      ) : null}

      <View style={styles.exerciseList}>
        {visibleExercises.map((exercise, index) => (
          <MuscleFocusExerciseCard
            key={exercise.id}
            exercise={exercise}
            index={index}
            selected={selectedExerciseIds.includes(exercise.id)}
            accentTint={accentTint}
            accentMain={accentMain}
            onPreview={onPreview}
            onToggle={onToggle}
          />
        ))}

        {exercises.length === 0 ? (
          <AppText variant="callout" color="secondary">
            This muscle is in the atlas for learning. Choose a training-linked body part like Chest
            or Back for programmed workouts.
          </AppText>
        ) : visibleExercises.length === 0 ? (
          <AppText variant="callout" color="secondary">
            No {loadKind === 'bodyweight' ? 'bodyweight' : 'weighted'} workouts for this muscle yet.
            Switch to {loadKind === 'bodyweight' ? 'Weighted' : 'Bodyweight'} to see available
            options.
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function MuscleFocusExerciseCard({
  exercise,
  index,
  selected,
  accentTint,
  accentMain,
  onPreview,
  onToggle,
}: {
  exercise: ExerciseTemplate;
  index: number;
  selected: boolean;
  accentTint: string;
  accentMain: string;
  onPreview: (exercise: ExerciseTemplate) => void;
  onToggle: (exerciseId: string) => void;
}) {
  const theme = useTheme();
  const previewAgent = useAgentUiTarget(
    AgentUiIds.workouts.exercisePreview(exercise.id),
    {
      label: `Watch ${exercise.name} anatomy animation`,
      onPress: () => onPreview(exercise),
    },
  );
  const addAgent = useAgentUiTarget(AgentUiIds.workouts.exerciseAdd(exercise.id), {
    label: `${selected ? 'Remove' : 'Add'} ${exercise.name}`,
    onPress: () => onToggle(exercise.id),
  });

  return (
    <GlassPlate
      style={[
        styles.exerciseCard,
        {
          borderColor: selected ? accentMain : theme.separator,
          overflow: selected ? 'hidden' : undefined,
        },
      ]}>
      {selected ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: accentTint, zIndex: 0 }]} />
      ) : null}
      <View style={[styles.exerciseTopRow, styles.glassContent]}>
        <Pressable
          ref={previewAgent.ref}
          testID={previewAgent.testID}
          onLayout={previewAgent.onLayout}
          accessibilityRole="button"
          accessibilityLabel={`Watch ${exercise.name} anatomy animation`}
          onPress={() => onPreview(exercise)}
          style={({ pressed }) => [
            styles.exercisePreviewButton,
            { opacity: pressed ? 0.72 : 1 },
          ]}>
          {selected ? (
            <View
              style={[
                styles.exerciseIndex,
                { backgroundColor: accentMain },
              ]}>
              <Symbol name="checkmark" size="sm" color={theme.textOnAccent} />
            </View>
          ) : (
            <GlassPlate airy style={styles.exerciseIndex}>
              <AppText variant="caption" color="secondary" fit style={styles.glassContent}>
                0{index + 1}
              </AppText>
            </GlassPlate>
          )}
          <View style={styles.flex}>
            <AppText variant="subheading">{exercise.name}</AppText>
            <AppText variant="caption" color="secondary">
              {exercise.equipment}
            </AppText>
          </View>
          <GlassPlate airy style={styles.previewControl}>
            <View style={[styles.previewControlInner, styles.glassContent]}>
              <Symbol name="play.fill" size={10} color={accentMain} />
            </View>
          </GlassPlate>
        </Pressable>
        <Pressable
          ref={addAgent.ref}
          testID={addAgent.testID}
          onLayout={addAgent.onLayout}
          accessibilityRole="checkbox"
          accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${exercise.name}`}
          accessibilityState={{ checked: selected }}
          hitSlop={6}
          onPress={() => onToggle(exercise.id)}
          style={({ pressed }) => [
            styles.addControl,
            {
              backgroundColor: selected ? accentMain : theme.backgroundPrimary,
              borderColor: selected ? accentMain : theme.separator,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <Symbol
            name={selected ? 'minus' : 'plus'}
            size="sm"
            color={selected ? theme.textOnAccent : theme.textPrimary}
          />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View muscles worked by ${exercise.name}`}
        onPress={() => onPreview(exercise)}
        style={({ pressed }) => [
          styles.exerciseMeta,
          styles.glassContent,
          { borderTopColor: theme.separator, opacity: pressed ? 0.72 : 1 },
        ]}>
        <View style={styles.metaItem}>
          <Symbol name="square.stack.3d.up" size="sm" color={theme.textTertiary} />
          <AppText variant="caption" color="secondary">
            {formatCount(exercise.sets, 'set')}
          </AppText>
        </View>
        <View style={styles.metaItem}>
          <Symbol name="repeat" size="sm" color={theme.textTertiary} />
          <AppText variant="caption" color="secondary">
            {formatCount(exercise.reps, 'rep')}
          </AppText>
        </View>
        <View style={styles.metaItem}>
          <Symbol name="timer" size="sm" color={theme.textTertiary} />
          <AppText variant="caption" color="secondary">
            {exercise.restSeconds}s rest
          </AppText>
        </View>
        <View style={styles.watchHint}>
          <AppText variant="caption" color="accent">
            Watch Anatomy
          </AppText>
          <Symbol name="chevron.right" size={10} color={accentMain} />
        </View>
      </Pressable>
    </GlassPlate>
  );
}

const styles = StyleSheet.create({
  pagePadding: {
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  glassContent: { zIndex: 1 },
  loadToggle: {
    borderWidth: 1,
    borderRadius: radii.pill,
    padding: 2,
  },
  loadToggleRow: {
    flexDirection: 'row',
    gap: 2,
  },
  selectedLoadTab: {
    overflow: 'hidden',
  },
  loadTab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  loadTabLabel: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  loadTabText: {
    flexShrink: 1,
    minWidth: 0,
  },
  exerciseList: {
    gap: spacing.md,
  },
  exerciseCard: {
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    boxShadow: '0 4px 18px rgba(27, 24, 21, 0.045)',
  },
  exerciseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  exercisePreviewButton: {
    minHeight: layout.minTapTarget,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  exerciseIndex: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  addControl: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 20,
  },
  previewControl: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  previewControlInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseMeta: {
    minHeight: layout.minTapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    paddingLeft: 54,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  watchHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
});
