import { render, screen } from '@testing-library/react-native';

import WelcomeScreen from '@/app/welcome';

let mockPhase = 'welcome';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ returnTo: '/f/friend-code' }),
}));

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({ phase: mockPhase }),
}));

jest.mock('@/features/auth/welcome-preview', () => ({
  useShouldShowWelcome: () => false,
}));

jest.mock('@/store/preferences', () => ({
  usePreferences: (selector: (state: { hasOnboarded: boolean }) => unknown) =>
    selector({ hasOnboarded: true }),
}));

jest.mock('@/features/auth/auth-screen', () => ({
  AuthScreen: ({
    variant,
    returnTo,
  }: {
    variant: string;
    returnTo?: string;
  }) => {
    const { Text } = jest.requireActual('react-native') as typeof import('react-native');
    return <Text>{`${variant}:${returnTo ?? ''}`}</Text>;
  },
}));

jest.mock('@/features/auth/welcome-onboard-screen', () => ({
  WelcomeOnboardScreen: () => {
    const { Text } = jest.requireActual('react-native') as typeof import('react-native');
    return <Text>First Run</Text>;
  },
}));

describe('WelcomeScreen authentication return route', () => {
  beforeEach(() => {
    mockPhase = 'welcome';
  });

  it('passes a friend invite through the returning-user sign-in screen', () => {
    render(<WelcomeScreen />);
    expect(screen.getByText('welcome:/f/friend-code')).toBeTruthy();
  });

  it('also preserves the invite when the existing session is locked', () => {
    mockPhase = 'locked';
    render(<WelcomeScreen />);
    expect(screen.getByText('locked:/f/friend-code')).toBeTruthy();
  });
});
