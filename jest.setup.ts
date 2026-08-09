import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const Animated = {
    View,
    createAnimatedComponent: (Component: unknown) => Component,
    Text: require('react-native').Text,
  };
  return {
    __esModule: true,
    default: Animated,
    Easing: {
      bezier: () => ({}),
      quad: (t: number) => t,
      inOut: (fn: unknown) => fn,
    },
    FadeIn: {},
    FadeInDown: {},
    FadeOut: {},
    LinearTransition: {},
    ReduceMotion: { System: 'system', Never: 'never', Always: 'always' },
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: () => ({}),
    // jest.fn so suites can flip Reduce Motion per case.
    useReducedMotion: jest.fn(() => false),
    withTiming: (value: unknown) => value,
    withSpring: (value: unknown) => value,
    withRepeat: (value: unknown) => value,
    withSequence: (...values: unknown[]) => values[0],
    withDelay: (_ms: number, value: unknown) => value,
    cancelAnimation: () => {},
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: () => 0,
  };
});

// Frosted chrome renders in component tests — stub the native blur layer.
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return { BlurView: View };
});

jest.mock('react-native-worklets', () => ({
  __esModule: true,
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Warning: 'Warning', Error: 'Error' },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000001',
}));
