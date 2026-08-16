import { forwardRef, type ComponentProps } from 'react';
import type { View } from 'react-native';
import {
    InnerScreen,
    ScreenContext,
    type ScreenProps,
} from 'react-native-screens';

/**
 * iOS 26 UIScrollView defaults to an automatic `UIScrollEdgeEffect`.
 * Overscroll on a glass page (Calendar, Today, …) paints a stuck material
 * overlay over BlurView plates — a blank atmosphere you cannot dismiss.
 * Hide every edge so bounce/PTR never cover the page.
 */
export const HIDDEN_SCROLL_EDGE_EFFECTS = {
  top: 'hidden',
  bottom: 'hidden',
  left: 'hidden',
  right: 'hidden',
} as const satisfies NonNullable<ScreenProps['scrollEdgeEffects']>;

export function resolveScrollEdgeEffects(
  explicit: ScreenProps['scrollEdgeEffects'] | undefined,
): NonNullable<ScreenProps['scrollEdgeEffects']> {
  return explicit ?? HIDDEN_SCROLL_EDGE_EFFECTS;
}

/** Tab `Screen` hosts omit `scrollEdgeEffects`; default them to hidden. */
export const HideIosScrollEdgeScreen = forwardRef<
  View,
  ComponentProps<typeof InnerScreen>
>(function HideIosScrollEdgeScreen({ scrollEdgeEffects, ...rest }, ref) {
  return (
    <InnerScreen
      ref={ref}
      {...rest}
      scrollEdgeEffects={resolveScrollEdgeEffects(scrollEdgeEffects)}
    />
  );
});

export const hideIosScrollEdgeScreenContext =
  HideIosScrollEdgeScreen as typeof InnerScreen;

export { ScreenContext };
