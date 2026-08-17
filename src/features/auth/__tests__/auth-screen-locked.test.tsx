import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthScreen } from '@/features/auth/auth-screen';
import { useBiometricUnlock } from '@/store/biometric-unlock';
import { AgentUiIds } from '@/utils/agent-ui/ids';

const LocalAuthentication = jest.requireMock('expo-local-authentication') as {
  hasHardwareAsync: jest.Mock;
  isEnrolledAsync: jest.Mock;
  supportedAuthenticationTypesAsync: jest.Mock;
};

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function renderAuth(variant: 'locked' | 'welcome' = 'locked') {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AuthScreen variant={variant} />
    </SafeAreaProvider>,
  );
}

const mockSignOutCurrentDevice = jest.fn(async () => ({ status: 'signed-out' as const }));
const mockContinueWithProvider = jest.fn(async () => undefined);
const mockUnlockWithBiometrics = jest.fn(async () => undefined);
const mockAuthSession = {
  phase: 'locked' as string,
  session: null as { user: { id: string } } | null,
  user: null as { id: string } | null,
  isGuest: false,
  lockedEmail: 'alex.rivera@example.com' as string | undefined,
  lockedUserId: 'user-1' as string | undefined,
  continueWithProvider: mockContinueWithProvider,
  unlockWithBiometrics: mockUnlockWithBiometrics,
  continueAsGuest: jest.fn(),
  signOutCurrentDevice: mockSignOutCurrentDevice,
  clearError: jest.fn(),
};

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
  useAuthSession: () => mockAuthSession,
}));

async function enrollFaceId() {
  LocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
  LocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
  LocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
}

describe('AuthScreen locked variant', () => {
  beforeEach(() => {
    mockSignOutCurrentDevice.mockClear();
    mockContinueWithProvider.mockClear();
    mockUnlockWithBiometrics.mockClear();
    mockAuthSession.phase = 'locked';
    mockAuthSession.session = null;
    mockAuthSession.user = null;
    mockAuthSession.isGuest = false;
    mockAuthSession.lockedEmail = 'alex.rivera@example.com';
    mockAuthSession.lockedUserId = 'user-1';
    useBiometricUnlock.setState({ enabledUserId: null });
    LocalAuthentication.hasHardwareAsync.mockResolvedValue(false);
    LocalAuthentication.isEnrolledAsync.mockResolvedValue(false);
    LocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([]);
  });

  it('offers providers to re-authenticate the locked account', async () => {
    renderAuth();
    await waitFor(() => {
      expect(LocalAuthentication.hasHardwareAsync).toHaveBeenCalled();
    });
    expect(screen.getByText('This device is locked')).toBeTruthy();
    expect(screen.queryByText('alex.rivera@example.com')).toBeNull();

    fireEvent.press(screen.getByTestId(AgentUiIds.auth.apple));
    expect(mockContinueWithProvider).toHaveBeenCalledWith('apple', undefined);
  });

  it('shows Face ID when enrolled even before this account enables it', async () => {
    await enrollFaceId();
    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId(AgentUiIds.auth.unlockBiometric)).toBeTruthy();
    });
    expect(screen.getByText('Unlock with Face ID')).toBeTruthy();
    expect(mockUnlockWithBiometrics).not.toHaveBeenCalled();
  });

  it('shows Face ID on the welcome sign-in shell when enrolled', async () => {
    await enrollFaceId();
    mockAuthSession.phase = 'guest';
    mockAuthSession.isGuest = true;
    mockAuthSession.lockedEmail = undefined;
    mockAuthSession.lockedUserId = undefined;
    renderAuth('welcome');

    await waitFor(() => {
      expect(screen.getByTestId(AgentUiIds.auth.unlockBiometric)).toBeTruthy();
    });
    expect(screen.getByText('Unlock with Face ID')).toBeTruthy();
    expect(mockUnlockWithBiometrics).not.toHaveBeenCalled();
  });

  it('offers Face ID and auto-prompts once when this account enabled it', async () => {
    await enrollFaceId();
    useBiometricUnlock.setState({ enabledUserId: 'user-1' });
    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId(AgentUiIds.auth.unlockBiometric)).toBeTruthy();
    });
    expect(screen.getByText('Unlock with Face ID')).toBeTruthy();
    await waitFor(() => {
      expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(screen.getByTestId(AgentUiIds.auth.unlockBiometric));
    expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(2);
  });

  it('replaces the guest row with an account switch that signs out', async () => {
    renderAuth();
    await waitFor(() => {
      expect(LocalAuthentication.hasHardwareAsync).toHaveBeenCalled();
    });
    expect(screen.queryByTestId(AgentUiIds.auth.guest)).toBeNull();

    fireEvent.press(screen.getByTestId(AgentUiIds.auth.switchAccount));
    expect(mockSignOutCurrentDevice).toHaveBeenCalledWith(true);
  });
});
