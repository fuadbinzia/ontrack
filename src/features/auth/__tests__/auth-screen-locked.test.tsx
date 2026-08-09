import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthScreen } from '@/features/auth/auth-screen';
import { AgentUiIds } from '@/utils/agent-ui/ids';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function renderLocked() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AuthScreen variant="locked" />
    </SafeAreaProvider>,
  );
}

const mockSignOutCurrentDevice = jest.fn(async () => ({ status: 'signed-out' as const }));
const mockContinueWithProvider = jest.fn(async () => undefined);

// Safe-area chrome registers through router focus effects; there is no
// navigation tree in this render.
jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

// Decorative shell only, and it needs a navigation context for safe-area chrome.
jest.mock('@/features/auth/auth-atmosphere', () => ({
  AuthAtmosphere: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    phase: 'locked',
    session: null,
    user: null,
    isGuest: false,
    lockedEmail: 'alex.rivera@example.com',
    continueWithProvider: mockContinueWithProvider,
    continueAsGuest: jest.fn(),
    signOutCurrentDevice: mockSignOutCurrentDevice,
    clearError: jest.fn(),
  }),
}));

describe('AuthScreen locked variant', () => {
  beforeEach(() => {
    mockSignOutCurrentDevice.mockClear();
    mockContinueWithProvider.mockClear();
  });

  it('offers providers to re-authenticate the locked account', () => {
    renderLocked();
    expect(screen.getByText('Signed in as alex.rivera@example.com')).toBeTruthy();

    fireEvent.press(screen.getByTestId(AgentUiIds.auth.apple));
    expect(mockContinueWithProvider).toHaveBeenCalledWith('apple', undefined);
  });

  it('replaces the guest row with an account switch that signs out', () => {
    renderLocked();
    expect(screen.queryByTestId(AgentUiIds.auth.guest)).toBeNull();

    fireEvent.press(screen.getByTestId(AgentUiIds.auth.switchAccount));
    expect(mockSignOutCurrentDevice).toHaveBeenCalledWith(true);
  });
});
