import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WelcomeOnboardScreen } from '@/features/auth/welcome-onboard-screen';
import { AgentUiIds } from '@/utils/agent-ui/ids';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

const mockContinueAsGuest = jest.fn(async () => undefined);
const mockCompleteOnboarding = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@/features/auth/auth-atmosphere', () => ({
  AuthAtmosphere: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/auth/auth-constellation', () => ({
  HERO_MAX_WIDTH: 620,
  useAuthCopyScale: () => 1,
  AuthConstellation: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    phase: 'welcome',
    session: null,
    workingProvider: undefined,
    continueWithProvider: jest.fn(),
    continueAsGuest: mockContinueAsGuest,
  }),
}));

jest.mock('@/store/preferences', () => ({
  usePreferences: (
    selector: (state: {
      completeOnboarding: typeof mockCompleteOnboarding;
      hasOnboarded: boolean;
    }) => unknown,
  ) =>
    selector({
      completeOnboarding: mockCompleteOnboarding,
      hasOnboarded: false,
    }),
}));

describe('WelcomeOnboardScreen', () => {
  beforeEach(() => {
    mockContinueAsGuest.mockClear();
    mockCompleteOnboarding.mockClear();
    mockReplace.mockClear();
  });

  it('renders the celestial first-run canvas', () => {
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <WelcomeOnboardScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Your day, one place.')).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.onboarding.getStarted)).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.onboarding.skip)).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.auth.guest)).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.onboarding.name)).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.onboarding.goal)).toBeTruthy();
  });

  it('try-first enters guest, completes onboarding, and leaves welcome', async () => {
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <WelcomeOnboardScreen />
      </SafeAreaProvider>,
    );

    fireEvent.press(
      screen.getByLabelText('I want to try the app out first'),
    );

    await waitFor(() => {
      expect(mockContinueAsGuest).toHaveBeenCalled();
      expect(mockCompleteOnboarding).toHaveBeenCalledWith({
        name: 'Guest',
        goal: 'Live intentionally',
      });
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });
});
