import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, SheetScaffold, Symbol } from '@/components/primitives';
import { categoryColors, layout, radii, spacing } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import { formatCount } from '@/utils/grammar';
import { BenchPressAnimation } from './bench-press-animation';
import { ExerciseAnatomyStill } from './exercise-anatomy-still';
import {
    MOVEMENT_LABELS,
    movementPatternForExercise,
    muscleHitsForExercise,
    type MovementPattern,
} from './exercise-motion';
import { FrontPlankAnimation } from './front-plank-animation';
import {
    ACTIVE_MUSCLE,
    RESTING_MUSCLE,
} from './generic-anatomy-figure';
import {
    MUSCLE_GROUPS_BY_KEY,
    type AnatomySex,
    type ExerciseTemplate,
    type MuscleKey,
    type MuscleTarget,
} from './muscle-data';

interface ExerciseAnatomyDemoProps {
  anatomySex?: AnatomySex;
  exercise?: ExerciseTemplate;
  primaryGroup: MuscleKey;
  primaryTarget: MuscleTarget;
  selected: boolean;
  visible: boolean;
  onClose: () => void;
  onToggleSelected: () => void;
}

interface DemoContentProps extends Omit<ExerciseAnatomyDemoProps, 'exercise'> {
  exercise: ExerciseTemplate;
}

function AnimatedAnatomyFigure({
  anatomySex,
  exercise,
  hits,
  pattern,
  playing,
  primaryTarget,
}: {
  anatomySex: AnatomySex;
  exercise: ExerciseTemplate;
  hits: MuscleKey[];
  pattern: MovementPattern;
  playing: boolean;
  primaryTarget: MuscleTarget;
}) {
  if (exercise.id === 'bench-press') {
    return <BenchPressAnimation anatomySex={anatomySex} hits={hits} playing={playing} />;
  }
  if (exercise.id === 'front-plank') {
    return (
      <FrontPlankAnimation anatomySex={anatomySex} hits={hits} playing={playing} />
    );
  }

  return (
    <ExerciseAnatomyStill
      anatomySex={anatomySex}
      exercise={exercise}
      pattern={pattern}
      playing={playing}
      primaryTarget={primaryTarget}
    />
  );
}

function usesCustomStepSlides(exerciseId: string) {
  return exerciseId === 'bench-press';
}

function DemoContent({
  anatomySex = 'male',
  exercise,
  primaryGroup,
  primaryTarget,
  selected,
  visible,
  onClose,
  onToggleSelected,
}: DemoContentProps) {
  const theme = useTheme();
  const gymColors = categoryColors(theme, 'gym');
  const [playing, setPlaying] = useState(true);
  const pattern = movementPatternForExercise(exercise);
  const hits = muscleHitsForExercise(exercise, primaryGroup);
  const stepMode = usesCustomStepSlides(exercise.id);
  const showPlayControls = exercise.id === 'front-plank' || !stepMode;

  useEffect(() => {
    if (!visible) return;
    setPlaying(true);
  }, [visible, exercise.id, anatomySex]);

  return (
    <SheetScaffold
      visible={visible}
      eyebrow="Anatomy in Motion"
      title={exercise.name}
      subtitle={`${MOVEMENT_LABELS[pattern]} · ${formatCount(exercise.sets, 'set')} × ${formatCount(exercise.reps, 'rep')} · ${anatomySex === 'female' ? 'Female' : 'Male'}`}
      closeAccessibilityLabel="Close animation"
      onClose={onClose}>
            <View
              style={[
                styles.animationCard,
                { backgroundColor: theme.backgroundSunken, borderColor: theme.separator },
              ]}>
              {stepMode ? (
                <View style={[styles.loopPill, { backgroundColor: theme.backgroundElevated, alignSelf: 'flex-start' }]}>
                  <View style={[styles.loopDot, { backgroundColor: gymColors.main }]} />
                  <AppText variant="overline" color="secondary">Form steps</AppText>
                </View>
              ) : (
                <View style={styles.animationMeta}>
                  <View style={[styles.loopPill, { backgroundColor: theme.backgroundElevated }]}>
                    <View style={[styles.loopDot, { backgroundColor: gymColors.main }]} />
                    <AppText variant="overline" color="secondary">
                      {playing ? 'Form steps · looping' : 'Form steps · paused'}
                    </AppText>
                  </View>
                  {showPlayControls ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={playing ? 'Pause animation' : 'Play animation'}
                      onPress={() => setPlaying((current) => !current)}
                      style={[styles.playButton, { backgroundColor: theme.backgroundElevated }]}>
                      <Symbol name={playing ? 'pause.fill' : 'play.fill'} size="sm" color={gymColors.main} />
                      <AppText variant="caption" color="accent">{playing ? 'Pause' : 'Play'}</AppText>
                    </Pressable>
                  ) : null}
                </View>
              )}

              <AnimatedAnatomyFigure
                anatomySex={anatomySex}
                exercise={exercise}
                hits={hits}
                pattern={pattern}
                playing={playing}
                primaryTarget={primaryTarget}
              />

              <View style={styles.motionLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: ACTIVE_MUSCLE }]} />
                  <AppText variant="caption" color="secondary">Muscles Working</AppText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: RESTING_MUSCLE }]} />
                  <AppText variant="caption" color="secondary">Supporting Anatomy</AppText>
                </View>
              </View>
            </View>

            <View style={styles.targetSection}>
              <View>
                <AppText variant="overline" color="tertiary">Primary Target</AppText>
                <AppText variant="heading">{primaryTarget.label}</AppText>
                <AppText variant="callout" color="secondary">
                  {primaryTarget.description}
                </AppText>
              </View>

              <View style={styles.hitChips}>
                {hits.map((key, index) => (
                  <View
                    key={key}
                    style={[
                      styles.hitChip,
                      {
                        backgroundColor: index === 0 ? gymColors.tint : theme.backgroundSunken,
                        borderColor: index === 0 ? gymColors.main : theme.separator,
                      },
                    ]}>
                    <View
                      style={[
                        styles.hitChipDot,
                        { backgroundColor: index === 0 ? gymColors.main : theme.textTertiary },
                      ]}
                    />
                    <AppText variant="caption" color={index === 0 ? 'accent' : 'secondary'}>
                      {MUSCLE_GROUPS_BY_KEY[key].label}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.demoCue, { backgroundColor: gymColors.tint }]}>
              <Symbol name="scope" size="md" color={gymColors.main} />
              <View style={styles.flex}>
                <AppText variant="overline" color="accent">What to Feel</AppText>
                <AppText variant="callout" color="secondary">{primaryTarget.cue}</AppText>
              </View>
            </View>

            <Button
              icon={selected ? 'minus-circle' : 'plus-circle'}
              onPress={onToggleSelected}
              size="lg"
              variant={selected ? 'secondary' : 'primary'}>
              {selected ? 'Remove from Session' : 'Add to Session'}
            </Button>
    </SheetScaffold>
  );
}

export function ExerciseAnatomyDemo(props: ExerciseAnatomyDemoProps) {
  if (!props.exercise) return null;
  return <DemoContent {...props} exercise={props.exercise} />;
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
    sheet: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    maxHeight: '94%',
    alignSelf: 'center',
    overflow: 'hidden',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    boxShadow: '0 -18px 50px rgba(0,0,0,0.22)',
  },
    sheetContent: {
    gap: spacing.xl,
    padding: layout.screenPadding,
  },
    sheetHeader: {
    gap: spacing.sm,
  },
    animationCard: {
    gap: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
  },
    animationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
    loopPill: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
    loopDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
    playButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
    motionLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
    legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
    legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
    targetSection: {
    gap: spacing.md,
  },
    hitChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
    hitChip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
  },
    hitChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
    demoCue: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
});
