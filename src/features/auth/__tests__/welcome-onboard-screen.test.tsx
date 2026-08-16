import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WelcomeOnboardScreen } from '@/features/auth/welcome-onboard-screen';
import { AgentUiIds } from '@/utils/agent-ui/ids';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

const mockContinueAsGuest = jest.fn(async () => undefined);
const mockContinueWithProvider = jest.fn(async () => undefined);
const mockCompleteOnboarding = jest.fn();
const mockReplace = jest.fn();
let mockReturnTo: unknown;

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ returnTo: mockReturnTo }),
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
    continueWithProvider: mockContinueWithProvider,
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
    mockContinueWithProvider.mockClear();
    mockCompleteOnboarding.mockClear();
    mockReplace.mockClear();
    mockReturnTo = undefined;
  });

  it('renders the celestial first-run canvas', () => {
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <WelcomeOnboardScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Your day, one place.')).toBeTruthy();
    expect(screen.getByText('What Should We Call You?')).toBeTruthy();
    expect(screen.getByText('Primary Goal')).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.onboarding.getStarted)).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.onboarding.skip)).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.auth.guest)).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.onboarding.name)).toBeTruthy();
    expect(screen.getByTestId(AgentUiIds.onboarding.goal)).toBeTruthy();
  });

  it('keeps welcome field labels at caption size without overline tracking', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/auth/welcome-onboard-screen.tsx'),
      'utf8',
    );
    expect(source).toContain('function WelcomeField');
    expect(source).toContain('variant="caption"');
    expect(source).not.toMatch(
      /<Input[\s\S]*?label="What should we call you\?"/,
    );
  });

  it('try-first enters guest, completes onboarding, and opens Today by default', async () => {
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

  it('preserves a safe in-app return route after onboarding', async () => {
    mockReturnTo = '/l/secure-code';
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <WelcomeOnboardScreen />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByLabelText('I want to try the app out first'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/l/secure-code');
    });
  });

  it('preserves a friend invite return route when signing in from first run', () => {
    mockReturnTo = '/f/friend-code';
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <WelcomeOnboardScreen />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByTestId(AgentUiIds.onboarding.signIn));
    fireEvent.press(screen.getByTestId(AgentUiIds.auth.google));

    expect(mockContinueWithProvider).toHaveBeenCalledWith(
      'google',
      '/f/friend-code',
    );
  });

  it.each([
    ['an absolute URL', 'https://example.com/phish'],
    ['a protocol-relative URL', '//example.com/phish'],
    ['a repeated query value', ['/travel', '/profile']],
  ])('rejects %s as a return route', async (_label, unsafeReturnTo) => {
    mockReturnTo = unsafeReturnTo;
    render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <WelcomeOnboardScreen />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByLabelText('I want to try the app out first'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });
});
