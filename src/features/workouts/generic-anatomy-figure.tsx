import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radii } from '@/design-system';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import type { MovementPattern } from './exercise-motion';
import type { MuscleKey } from './muscle-data';

export const ACTIVE_MUSCLE = '#C75B46';
export const ACTIVE_MUSCLE_LIGHT = '#F19A72';
export const RESTING_MUSCLE = '#9C8B82';
export const RESTING_MUSCLE_DARK = '#75665F';

function smoothStep(value: number) {
  'worklet';
  return value * value * (3 - 2 * value);
}

export function GenericAnatomyFigure({
  hits,
  pattern,
  playing,
}: {
  hits: MuscleKey[];
  pattern: MovementPattern;
  playing: boolean;
}) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const { allowsLoopMotion } = usePerformanceTier();
  const routeIsActive = useRouteIsActive();
  const hitSet = new Set(hits);
  const stillPose = reduceMotion || !allowsLoopMotion || !routeIsActive;

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
        duration: pattern === 'carry' ? 700 : 1050,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [pattern, playing, progress, stillPose]);

  const bodyMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    if (pattern === 'horizontal-push') {
      return { transform: [{ rotate: '-90deg' }, { translateY: 7 * p }] };
    }
    if (pattern === 'core') {
      return { transform: [{ rotate: '-90deg' }, { translateY: 4 * p }] };
    }
    if (pattern === 'squat') {
      return { transform: [{ translateY: 38 * p }, { scaleY: 1 - 0.05 * p }] };
    }
    if (pattern === 'hinge') {
      return { transform: [{ rotate: `${18 * p}deg` }, { translateY: 8 * p }] };
    }
    if (pattern === 'calf') {
      return { transform: [{ translateY: -12 * p }] };
    }
    if (pattern === 'carry') {
      return {
        transform: [{ translateX: -4 + 8 * p }, { translateY: -3 * p }],
      };
    }
    return { transform: [{ translateY: -2 * p }] };
  });

  const leftUpperArmMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    if (pattern === 'vertical-press')
      return { transform: [{ rotate: `${150 * p}deg` }] };
    if (pattern === 'vertical-pull')
      return { transform: [{ rotate: `${150 * (1 - p)}deg` }] };
    if (pattern === 'horizontal-push')
      return { transform: [{ rotate: `${-55 + 28 * p}deg` }] };
    if (pattern === 'row') return { transform: [{ rotate: `${32 * p}deg` }] };
    if (pattern === 'triceps-extension')
      return { transform: [{ rotate: '150deg' }] };
    return { transform: [{ rotate: '6deg' }] };
  });

  const rightUpperArmMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    if (pattern === 'vertical-press')
      return { transform: [{ rotate: `${-150 * p}deg` }] };
    if (pattern === 'vertical-pull')
      return { transform: [{ rotate: `${-150 * (1 - p)}deg` }] };
    if (pattern === 'horizontal-push')
      return { transform: [{ rotate: `${55 - 28 * p}deg` }] };
    if (pattern === 'row') return { transform: [{ rotate: `${-32 * p}deg` }] };
    if (pattern === 'triceps-extension')
      return { transform: [{ rotate: '-150deg' }] };
    return { transform: [{ rotate: '-6deg' }] };
  });

  const leftForearmMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    if (pattern === 'curl')
      return { transform: [{ rotate: `${-112 * p}deg` }] };
    if (pattern === 'vertical-press')
      return { transform: [{ rotate: `${-72 * (1 - p)}deg` }] };
    if (pattern === 'vertical-pull')
      return { transform: [{ rotate: `${-92 * p}deg` }] };
    if (pattern === 'row') return { transform: [{ rotate: `${-88 * p}deg` }] };
    if (pattern === 'triceps-extension')
      return { transform: [{ rotate: `${-105 * (1 - p)}deg` }] };
    return { transform: [{ rotate: '0deg' }] };
  });

  const rightForearmMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    if (pattern === 'curl') return { transform: [{ rotate: `${112 * p}deg` }] };
    if (pattern === 'vertical-press')
      return { transform: [{ rotate: `${72 * (1 - p)}deg` }] };
    if (pattern === 'vertical-pull')
      return { transform: [{ rotate: `${92 * p}deg` }] };
    if (pattern === 'row') return { transform: [{ rotate: `${88 * p}deg` }] };
    if (pattern === 'triceps-extension')
      return { transform: [{ rotate: `${105 * (1 - p)}deg` }] };
    return { transform: [{ rotate: '0deg' }] };
  });

  const leftThighMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    if (pattern === 'squat' || pattern === 'knee-extension') {
      return { transform: [{ rotate: `${20 * p}deg` }] };
    }
    if (pattern === 'hip-abduction')
      return { transform: [{ rotate: `${25 * p}deg` }] };
    return { transform: [{ rotate: '2deg' }] };
  });

  const rightThighMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    if (pattern === 'squat' || pattern === 'knee-extension') {
      return { transform: [{ rotate: `${-20 * p}deg` }] };
    }
    if (pattern === 'hip-abduction')
      return { transform: [{ rotate: `${-25 * p}deg` }] };
    return { transform: [{ rotate: '-2deg' }] };
  });

  const leftCalfMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    if (pattern === 'squat')
      return { transform: [{ rotate: `${-34 * p}deg` }] };
    if (pattern === 'knee-flexion')
      return { transform: [{ rotate: `${-92 * p}deg` }] };
    if (pattern === 'knee-extension')
      return { transform: [{ rotate: `${-70 * (1 - p)}deg` }] };
    return { transform: [{ rotate: '0deg' }] };
  });

  const rightCalfMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    if (pattern === 'squat') return { transform: [{ rotate: `${34 * p}deg` }] };
    if (pattern === 'knee-flexion')
      return { transform: [{ rotate: `${92 * p}deg` }] };
    if (pattern === 'knee-extension')
      return { transform: [{ rotate: `${70 * (1 - p)}deg` }] };
    return { transform: [{ rotate: '0deg' }] };
  });

  const musclePulse = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    return {
      opacity: 0.74 + p * 0.26,
      transform: [{ scale: 0.97 + p * 0.05 }],
    };
  });

  const armsActive = hitSet.has('biceps') || hitSet.has('triceps');
  const thighsActive = hitSet.has('quadriceps') || hitSet.has('hamstrings');
  const torsoBackActive =
    hitSet.has('upper-back') || hitSet.has('lats') || hitSet.has('lower-back');

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.figureStage}
    >
      <View style={styles.motionArcOne} />
      <View style={styles.motionArcTwo} />
      <Animated.View style={[styles.figure, bodyMotion]}>
        <View style={styles.head}>
          <View style={styles.headLine} />
        </View>

        <View style={styles.neck} />
        <View style={styles.torso}>
          <Animated.View
            style={[
              styles.backPlate,
              torsoBackActive && styles.activeMuscle,
              torsoBackActive && musclePulse,
            ]}
          />
          <View style={styles.chestRow}>
            <Animated.View
              style={[
                styles.chestMuscle,
                hitSet.has('chest') && styles.activeMuscleLight,
                hitSet.has('chest') && musclePulse,
              ]}
            />
            <Animated.View
              style={[
                styles.chestMuscle,
                hitSet.has('chest') && styles.activeMuscleLight,
                hitSet.has('chest') && musclePulse,
              ]}
            />
          </View>
          <Animated.View
            style={[
              styles.coreMuscle,
              hitSet.has('core') && styles.activeMuscleLight,
              hitSet.has('core') && musclePulse,
            ]}
          />
        </View>

        <Animated.View
          style={[
            styles.shoulderMuscle,
            styles.leftShoulder,
            hitSet.has('shoulders') && styles.activeMuscleLight,
            hitSet.has('shoulders') && musclePulse,
          ]}
        />
        <Animated.View
          style={[
            styles.shoulderMuscle,
            styles.rightShoulder,
            hitSet.has('shoulders') && styles.activeMuscleLight,
            hitSet.has('shoulders') && musclePulse,
          ]}
        />

        <Animated.View
          style={[
            styles.upperArmAnchor,
            styles.leftUpperArm,
            leftUpperArmMotion,
          ]}
        >
          <Animated.View
            style={[
              styles.upperArmSegment,
              armsActive && styles.activeMuscle,
              armsActive && musclePulse,
            ]}
          />
          <Animated.View style={[styles.forearmAnchor, leftForearmMotion]}>
            <Animated.View
              style={[
                styles.forearmSegment,
                armsActive && styles.activeMuscleLight,
                armsActive && musclePulse,
              ]}
            />
            <View style={styles.hand} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.upperArmAnchor,
            styles.rightUpperArm,
            rightUpperArmMotion,
          ]}
        >
          <Animated.View
            style={[
              styles.upperArmSegment,
              armsActive && styles.activeMuscle,
              armsActive && musclePulse,
            ]}
          />
          <Animated.View style={[styles.forearmAnchor, rightForearmMotion]}>
            <Animated.View
              style={[
                styles.forearmSegment,
                armsActive && styles.activeMuscleLight,
                armsActive && musclePulse,
              ]}
            />
            <View style={styles.hand} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.pelvis,
            hitSet.has('glutes') && styles.activeMuscle,
            hitSet.has('glutes') && musclePulse,
          ]}
        />

        <Animated.View
          style={[styles.thighAnchor, styles.leftThigh, leftThighMotion]}
        >
          <Animated.View
            style={[
              styles.thighSegment,
              thighsActive && styles.activeMuscle,
              thighsActive && musclePulse,
            ]}
          />
          <Animated.View style={[styles.calfAnchor, leftCalfMotion]}>
            <Animated.View
              style={[
                styles.calfSegment,
                hitSet.has('calves') && styles.activeMuscleLight,
                hitSet.has('calves') && musclePulse,
              ]}
            />
            <View style={styles.foot} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[styles.thighAnchor, styles.rightThigh, rightThighMotion]}
        >
          <Animated.View
            style={[
              styles.thighSegment,
              thighsActive && styles.activeMuscle,
              thighsActive && musclePulse,
            ]}
          />
          <Animated.View style={[styles.calfAnchor, rightCalfMotion]}>
            <Animated.View
              style={[
                styles.calfSegment,
                hitSet.has('calves') && styles.activeMuscleLight,
                hitSet.has('calves') && musclePulse,
              ]}
            />
            <View style={styles.foot} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  figureStage: {
    height: 340,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: '#231916',
  },
  motionArcOne: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderWidth: 1,
    borderColor: 'rgba(255, 198, 156, 0.12)',
    borderRadius: 125,
  },
  motionArcTwo: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderWidth: 1,
    borderColor: 'rgba(255, 198, 156, 0.08)',
    borderRadius: 95,
  },
  figure: {
    width: 150,
    height: 282,
    position: 'relative',
  },
  head: {
    position: 'absolute',
    top: 0,
    left: 57,
    width: 36,
    height: 42,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ACTIVE_MUSCLE_LIGHT,
    borderRadius: 18,
    backgroundColor: RESTING_MUSCLE,
  },
  headLine: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  neck: {
    position: 'absolute',
    top: 36,
    left: 67,
    width: 16,
    height: 18,
    borderRadius: 6,
    backgroundColor: RESTING_MUSCLE_DARK,
  },
  torso: {
    position: 'absolute',
    top: 48,
    left: 40,
    width: 70,
    height: 83,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 24,
    backgroundColor: RESTING_MUSCLE_DARK,
  },
  backPlate: {
    position: 'absolute',
    top: 6,
    left: 9,
    width: 52,
    height: 68,
    borderRadius: 18,
    backgroundColor: RESTING_MUSCLE_DARK,
  },
  chestRow: {
    position: 'absolute',
    top: 7,
    left: 7,
    flexDirection: 'row',
    gap: 2,
  },
  chestMuscle: {
    width: 27,
    height: 23,
    borderRadius: 11,
    backgroundColor: RESTING_MUSCLE,
  },
  coreMuscle: {
    position: 'absolute',
    top: 34,
    left: 25,
    width: 20,
    height: 42,
    borderRadius: 8,
    backgroundColor: RESTING_MUSCLE,
  },
  shoulderMuscle: {
    position: 'absolute',
    top: 46,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: RESTING_MUSCLE,
  },
  leftShoulder: { left: 27 },
  rightShoulder: { right: 27 },
  upperArmAnchor: {
    position: 'absolute',
    top: 61,
    width: 20,
    height: 68,
    alignItems: 'center',
    transformOrigin: '50% 0%',
  },
  leftUpperArm: { left: 28 },
  rightUpperArm: { right: 28 },
  upperArmSegment: {
    width: 18,
    height: 62,
    borderRadius: 9,
    backgroundColor: RESTING_MUSCLE,
  },
  forearmAnchor: {
    position: 'absolute',
    top: 58,
    left: 2,
    width: 16,
    height: 69,
    alignItems: 'center',
    transformOrigin: '50% 0%',
  },
  forearmSegment: {
    width: 15,
    height: 58,
    borderRadius: 8,
    backgroundColor: RESTING_MUSCLE_DARK,
  },
  hand: {
    width: 17,
    height: 17,
    borderRadius: 7,
    backgroundColor: '#C4A297',
  },
  pelvis: {
    position: 'absolute',
    top: 124,
    left: 47,
    width: 56,
    height: 31,
    borderRadius: 15,
    backgroundColor: RESTING_MUSCLE_DARK,
  },
  thighAnchor: {
    position: 'absolute',
    top: 145,
    width: 28,
    height: 75,
    alignItems: 'center',
    transformOrigin: '50% 0%',
  },
  leftThigh: { left: 46 },
  rightThigh: { right: 46 },
  thighSegment: {
    width: 27,
    height: 68,
    borderRadius: 14,
    backgroundColor: RESTING_MUSCLE,
  },
  calfAnchor: {
    position: 'absolute',
    top: 63,
    left: 5,
    width: 18,
    height: 74,
    alignItems: 'center',
    transformOrigin: '50% 0%',
  },
  calfSegment: {
    width: 17,
    height: 63,
    borderRadius: 9,
    backgroundColor: RESTING_MUSCLE_DARK,
  },
  foot: {
    width: 25,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#C4A297',
  },
  activeMuscle: { backgroundColor: ACTIVE_MUSCLE },
  activeMuscleLight: { backgroundColor: ACTIVE_MUSCLE_LIGHT },
});
