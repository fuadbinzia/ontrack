import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthScreen } from '@/features/auth/auth-screen';
import { AgentUiIds } from '@/utils/agent-ui/ids';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

let mockWorkingProvider: 'apple' | 'google' | undefined;
let mockError: string | undefined;

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/features/auth/auth-atmosphere', () => ({
  AuthAtmosphere: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    phase: mockWorkingProvider ? 'authenticating' : 'guest',
    session: null,
    user: null,
    isGuest: true,
    lockedEmail: undefined,
    workingProvider: mockWorkingProvider,
    error: mockError,
    continueWithProvider: jest.fn(),
    continueAsGuest: jest.fn(),
    signOutCurrentDevice: jest.fn(),
    clearError: jest.fn(),
  }),
}));

describe('AuthScreen layout stability', () => {
  beforeEach(() => {
    mockWorkingProvider = undefined;
    mockError = undefined;
  });

  it('keeps provider chrome mounted while Opening… floats above on upgrade', () => {
    mockWorkingProvider = 'apple';
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <AuthScreen variant="upgrade" />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Opening Apple…')).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.auth.apple)).toBeTruthy();
    expect(screen.queryByTestId(AgentUiIds.auth.guest)).toBeNull();
    expect(screen.getByTestId(AgentUiIds.auth.section.providers)).toBeTruthy();
  });

  it('surfaces sign-in errors above the card without dropping providers', () => {
    mockError = 'Could not reach Apple.';
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <AuthScreen variant="upgrade" />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Could not reach Apple.')).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.auth.dismissError)).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.auth.apple)).toBeTruthy();
  });

  it('omits Continue as Guest on sign-in and upgrade gates', () => {
    const { unmount } = render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <AuthScreen variant="welcome" />
      </SafeAreaProvider>,
    );

    expect(screen.queryByTestId(AgentUiIds.auth.guest)).toBeNull();
    expect(screen.queryByText('Continue as Guest')).toBeNull();
    expect(screen.getByTestId(AgentUiIds.auth.privacy)).toBeTruthy();
    unmount();

    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <AuthScreen variant="upgrade" />
      </SafeAreaProvider>,
    );
    expect(screen.queryByTestId(AgentUiIds.auth.guest)).toBeNull();
    expect(screen.getByTestId(AgentUiIds.auth.terms)).toBeTruthy();
  });
});
