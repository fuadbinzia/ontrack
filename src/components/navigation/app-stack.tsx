import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

import { motion } from '@/design-system/motion';

import { HIDDEN_SCROLL_EDGE_EFFECTS } from './scroll-edge-effects';
import { SwipeBackScene } from './swipe-back-scene';

type StackProps = ComponentProps<typeof Stack>;
type ScreenOptions = NonNullable<StackProps['screenOptions']>;
type ScreenLayout = NonNullable<StackProps['screenLayout']>;

const isAndroid =
  process.env.EXPO_OS === 'android' || Platform.OS === 'android';

/**
 * iOS 26 maps `default` / `ios_from_right` onto Apple's
 * `interactiveContentPopGestureRecognizer`, which loses to ScrollView and
 * hidden headers. `simple_push` is a custom animation, so screens uses its
 * own full-screen pan instead.
 */
export const IOS_SWIPE_BACK_ANIMATION = 'simple_push' as const;
export const ANDROID_SWIPE_BACK_ANIMATION = 'ios_from_right' as const;

export const appStackSwipeAnimation = isAndroid
  ? ANDROID_SWIPE_BACK_ANIMATION
  : IOS_SWIPE_BACK_ANIMATION;

export const appStackScreenOptions = {
  headerShown: false,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  animationMatchesGesture: true,
  animation: appStackSwipeAnimation,
  animationDuration: motion.page,
  contentStyle: { backgroundColor: 'transparent' },
  // Native-stack always forwards a value (default `automatic`). Pin hidden
  // so iOS 26 overscroll cannot blank glass pages.
  scrollEdgeEffects: HIDDEN_SCROLL_EDGE_EFFECTS,
};

/** Tab hub `index` stays at rest. Pushed screens keep the swipe animation. */
export function isAppStackTabRoot(routeName: string | undefined): boolean {
  return routeName === 'index';
}

export function mergeAppStackScreenOptions(
  extra?: ScreenOptions,
): ScreenOptions {
  if (!extra) return appStackScreenOptions;
  if (typeof extra === 'function') {
    return (props) => ({ ...appStackScreenOptions, ...extra(props) });
  }
  return { ...appStackScreenOptions, ...extra };
}

export function composeSwipeBackScreenLayout(
  callerLayout?: ScreenLayout,
): ScreenLayout {
  return function SwipeBackScreenLayout(props) {
    const inner = callerLayout ? callerLayout(props) : props.children;
    return (
      <SwipeBackScene
        gestureEnabled={props.options.gestureEnabled}
        presentation={props.options.presentation}>
        {inner}
      </SwipeBackScene>
    );
  };
}

function AppStackImpl({
  screenOptions,
  screenLayout,
  children,
  ...rest
}: StackProps) {
  const merged = mergeAppStackScreenOptions(screenOptions);
  return (
    <Stack
      {...rest}
      screenOptions={(props) => {
        const resolved =
          typeof merged === 'function' ? merged(props) : { ...merged };
        if (
          resolved.animation != null &&
          resolved.animation !== appStackSwipeAnimation
        ) {
          return resolved;
        }
        if (isAppStackTabRoot(props.route.name)) {
          return { ...resolved, animation: 'none' };
        }
        return resolved;
      }}
      screenLayout={
        Platform.OS === 'android'
          ? composeSwipeBackScreenLayout(screenLayout)
          : screenLayout
      }>
      {children}
    </Stack>
  );
}

export const AppStack = Object.assign(AppStackImpl, {
  Screen: Stack.Screen,
  Protected: Stack.Protected,
});
