import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

import { motion } from '@/design-system';

import { SwipeBackScene } from './swipe-back-scene';

type StackProps = ComponentProps<typeof Stack>;
type ScreenOptions = NonNullable<StackProps['screenOptions']>;
type ScreenLayout = NonNullable<StackProps['screenLayout']>;

export const appStackScreenOptions = {
  headerShown: false,
  fullScreenGestureEnabled: true,
  animation:
    process.env.EXPO_OS === 'android' || Platform.OS === 'android'
      ? ('ios_from_right' as const)
      : ('default' as const),
  animationDuration: motion.page,
  contentStyle: { backgroundColor: 'transparent' },
};

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
  return (props) => {
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
  return (
    <Stack
      {...rest}
      screenOptions={mergeAppStackScreenOptions(screenOptions)}
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
