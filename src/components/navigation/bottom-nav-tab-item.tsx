import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Symbol } from '@/components/primitives/symbol';
import type { AppIconName } from '@/design-system/icons';
import { durations, easings } from '@/design-system/motion';
import { useResponsive } from '@/hooks/use-responsive';

/** Chrome settle — short enough to feel snappy, long enough to read as a blend. */
const SELECT_MS = durations.fast;

type BottomNavTabItemProps = {
  selected: boolean;
  icon: AppIconName;
  label: string;
  activeColor: string;
  inactiveColor: string;
  iconSize: number;
  captionStyle: {
    fontSize: number;
    lineHeight: number;
    width: '100%';
    minWidth: number;
    flexShrink: number;
  };
};

/**
 * One bottom-nav slot’s icon + caption. Selection accent eases on the label;
 * icon tint stays discrete (cheap on the infinite repeat track). The active
 * indicator is a fixed center dot on the rail — not per-item — so icons move
 * under a stationary mark.
 */
export function BottomNavTabItem({
  selected,
  icon,
  label,
  activeColor,
  inactiveColor,
  iconSize,
  captionStyle,
}: BottomNavTabItemProps) {
  const { typography } = useResponsive();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, {
      duration: reduceMotion ? 0 : SELECT_MS,
      easing: easings.standard,
    });
  }, [progress, reduceMotion, selected]);

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveColor, activeColor],
    ),
  }));

  return (
    <>
      <View style={styles.iconSlot}>
        <Symbol
          name={icon}
          size={iconSize}
          color={selected ? activeColor : inactiveColor}
        />
      </View>
      <Animated.Text
        allowFontScaling
        maxFontSizeMultiplier={1.1}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.68}
        style={[
          typography.caption,
          captionStyle,
          styles.caption,
          { fontWeight: selected ? '600' : '400' },
          labelStyle,
        ]}>
        {label}
      </Animated.Text>
    </>
  );
}

const styles = StyleSheet.create({
  iconSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    textAlign: 'center',
  },
});
