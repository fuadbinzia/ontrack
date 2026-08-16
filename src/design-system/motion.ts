import { Easing } from 'react-native-reanimated';

/** Short settles for chrome; keep under ~300ms so motion never feels sticky. */
export const durations = {
  fast: 160,
  base: 260,
  slow: 420,
  cinematic: 700,
} as const;

export const easings = {
  standard: Easing.bezier(0.3, 0, 0.15, 1),
  enter: Easing.bezier(0.16, 1, 0.3, 1),
  exit: Easing.bezier(0.6, 0, 0.9, 0.4),
} as const;

export const springs = {
  gentle: { damping: 22, stiffness: 200, mass: 1 },
  bouncy: { damping: 14, stiffness: 220, mass: 0.9 },
  stiff: { damping: 26, stiffness: 380, mass: 1 },
  /** Modal sheets — near-critical so tall SlideInDown settles without bounce. */
  sheet: { damping: 36, stiffness: 280, mass: 1 },
} as const;

/** Named settles — prefer these over ad-hoc ms so surfaces stay consistent. */
export const motion = {
  /** Collapsing menus, section bodies, card expand/collapse. */
  disclosure: durations.base,
  /** Opacity crossfades / menu panel enter. */
  fade: durations.fast,
  /** Surrounding layout reflow after disclose. */
  layout: durations.base,
  /** Native stack push/pop settle (ms). */
  page: 280,
  /** Sheet / modal rise and dismiss. */
  sheet: durations.base,
  /** Chevron / small chrome rotates. */
  chrome: durations.fast,
} as const;
