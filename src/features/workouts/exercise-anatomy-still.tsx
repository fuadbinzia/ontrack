import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText, Symbol } from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import { useTheme } from '@/hooks/use-theme';
import { ANATOMY_BEIGE } from './anatomy-art';
import type { MovementPattern } from './exercise-motion';
import {
  formStepsForExercise,
  type ExerciseFormStep,
} from './exercise-form-steps';
import {
  highlightImageForMuscle,
  MUSCLE_HIGHLIGHT_VIEW,
} from './muscle-highlight-images';
import type { AnatomySex, ExerciseTemplate, MuscleTarget } from './muscle-data';

const STAGE_HEIGHT = 300;

function smoothStep(value: number) {
  'worklet';
  return value * value * (3 - 2 * value);
}

function motionForPattern(pattern: MovementPattern, p: number) {
  'worklet';
  if (pattern === 'horizontal-push') {
    return [{ translateY: 4 * p }, { scale: 1 - 0.012 * p }];
  }
  if (pattern === 'squat') {
    return [{ translateY: 10 * p }, { scaleY: 1 - 0.02 * p }];
  }
  if (pattern === 'hinge') {
    return [{ rotate: `${6 * p}deg` }, { translateY: 3 * p }];
  }
  if (pattern === 'calf') {
    return [{ translateY: -6 * p }];
  }
  if (pattern === 'carry') {
    return [{ translateX: -2 + 4 * p }];
  }
  return [{ translateY: -2 + 4 * p }, { scale: 1 + 0.008 * p }];
}

interface ExerciseAnatomyStillProps {
  anatomySex: AnatomySex;
  exercise: ExerciseTemplate;
  pattern: MovementPattern;
  playing: boolean;
  primaryTarget: MuscleTarget;
}

export function ExerciseAnatomyStill({
  anatomySex,
  exercise,
  pattern,
  playing,
  primaryTarget,
}: ExerciseAnatomyStillProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const { allowsLoopMotion } = usePerformanceTier();
  const routeIsActive = useRouteIsActive();
  const stillPose = reduceMotion || !allowsLoopMotion || !routeIsActive;
  const progress = useSharedValue(0);
  const steps = formStepsForExercise(exercise, primaryTarget);
  const [index, setIndex] = useState(0);
  const step: ExerciseFormStep = steps[index] ?? steps[0];

  const bodyView = MUSCLE_HIGHLIGHT_VIEW[primaryTarget.id] ?? 'front';
  const source = highlightImageForMuscle(
    primaryTarget.id,
    bodyView,
    anatomySex,
  );

  useEffect(() => {
    cancelAnimation(progress);
    if (stillPose) {
      progress.value = 0.55;
      return;
    }
    if (!playing) return;
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration: pattern === 'carry' ? 900 : 1400,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [pattern, playing, progress, stillPose]);

  const figureMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    return {
      transform: motionForPattern(pattern, p),
      opacity: 0.92 + 0.08 * p,
    };
  });

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(steps.length - 1, next)));
    },
    [steps.length],
  );

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Animated.View style={[styles.figureWrap, figureMotion]}>
          <Image
            accessibilityIgnoresInvertColors
            accessible={false}
            contentFit="contain"
            priority="high"
            source={source}
            style={styles.figure}
          />
        </Animated.View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous step"
          disabled={index === 0}
          hitSlop={10}
          onPress={() => goTo(index - 1)}
          style={[
            styles.navButton,
            styles.navLeft,
            {
              backgroundColor: theme.backgroundElevated,
              opacity: index === 0 ? 0.35 : 1,
            },
          ]}
        >
          <Symbol name="chevron-left" size="sm" color={theme.textPrimary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next step"
          disabled={index === steps.length - 1}
          hitSlop={10}
          onPress={() => goTo(index + 1)}
          style={[
            styles.navButton,
            styles.navRight,
            {
              backgroundColor: theme.backgroundElevated,
              opacity: index === steps.length - 1 ? 0.35 : 1,
            },
          ]}
        >
          <Symbol name="chevron-right" size="sm" color={theme.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.stepMeta}>
        <View style={styles.stepHeader}>
          <AppText variant="overline" color="accent">
            Step {index + 1} of {steps.length}
          </AppText>
          <AppText variant="heading">{step.title}</AppText>
        </View>
        <AppText variant="callout" color="secondary">
          {step.cue}
        </AppText>

        <View style={styles.dots}>
          {steps.map((item, dotIndex) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Go to step ${dotIndex + 1}: ${item.title}`}
              hitSlop={8}
              onPress={() => goTo(dotIndex)}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    dotIndex === index ? '#C75B46' : theme.separator,
                  width: dotIndex === index ? 18 : 7,
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
  },
  stage: {
    width: '100%',
    height: STAGE_HEIGHT,
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: ANATOMY_BEIGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figureWrap: {
    width: '88%',
    height: '92%',
  },
  figure: {
    width: '100%',
    height: '100%',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  navLeft: { left: 8 },
  navRight: { right: 8 },
  stepMeta: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  stepHeader: {
    gap: 2,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: spacing.xs,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
});
