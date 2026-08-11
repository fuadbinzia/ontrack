import { useEffect } from 'react';
import { Image } from 'expo-image';
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
import { ANATOMY_BEIGE } from './anatomy-art';
import type { AnatomySex, MuscleKey } from './muscle-data';

const MALE_PLANK = require('../../../assets/images/workouts/front-plank-anatomy.jpg');
const FEMALE_PLANK = require('../../../assets/images/workouts/female-front-plank-anatomy.jpg');

function smoothStep(value: number) {
  'worklet';
  return value * value * (3 - 2 * value);
}

/**
 * Muscle Explorer–style anatomical plate in a real forearm plank.
 * Hold animation only — no limb cropping or joint pivots.
 */
export function FrontPlankAnimation({
  anatomySex = 'male',
  playing,
}: {
  anatomySex?: AnatomySex;
  hits: MuscleKey[];
  playing: boolean;
}) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const { allowsLoopMotion } = usePerformanceTier();
  const routeIsActive = useRouteIsActive();
  const stillPose = reduceMotion || !allowsLoopMotion || !routeIsActive;
  const source = anatomySex === 'female' ? FEMALE_PLANK : MALE_PLANK;

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
        duration: 2200,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );

    return () => cancelAnimation(progress);
  }, [playing, progress, stillPose]);

  const figureMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    return {
      transform: [
        { translateY: -1.2 + 2.4 * p },
        { scaleX: 1 + 0.003 * p },
        { scaleY: 1 - 0.006 * p },
      ],
    };
  });

  const shadowMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    return {
      opacity: 0.12 + 0.07 * (1 - p),
      transform: [
        { scaleX: 0.95 + 0.05 * (1 - p) },
        { scaleY: 0.88 + 0.12 * p },
      ],
    };
  });

  const engagementMotion = useAnimatedStyle(() => {
    const p = smoothStep(progress.value);
    return {
      opacity: 0.55 + 0.45 * p,
    };
  });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.stage}
    >
      <View style={styles.scene}>
        <View style={styles.floorLine} />
        <Animated.View style={[styles.contactShadow, shadowMotion]} />

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

        <Animated.View style={[styles.engagementCue, engagementMotion]}>
          <View style={styles.engagementDot} />
          <View style={styles.engagementDot} />
          <View style={styles.engagementDot} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    height: 340,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: ANATOMY_BEIGE,
  },
  scene: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorLine: {
    position: 'absolute',
    bottom: 58,
    left: 28,
    right: 28,
    height: 1,
    backgroundColor: 'rgba(90, 74, 64, 0.16)',
  },
  contactShadow: {
    position: 'absolute',
    bottom: 52,
    width: 250,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#2C211C',
  },
  figureWrap: {
    width: '94%',
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },
  figure: {
    width: '100%',
    height: '100%',
  },
  engagementCue: {
    position: 'absolute',
    top: 18,
    right: 18,
    flexDirection: 'row',
    gap: 5,
  },
  engagementDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C75B46',
  },
});
