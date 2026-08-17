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
    useBiometricUnlock.setState({ enabledUserId: null, rememberMe: false });
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

  it('lists Google above Apple with Face ID as a toggle below them', async () => {
    await enrollFaceId();
    const view = renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId(AgentUiIds.auth.unlockBiometric)).toBeTruthy();
    });
    const tree = JSON.stringify(view.toJSON());
    expect(tree.indexOf(AgentUiIds.auth.google)).toBeGreaterThan(-1);
    expect(tree.indexOf(AgentUiIds.auth.google)).toBeLessThan(
      tree.indexOf(AgentUiIds.auth.apple),
    );
    expect(tree.indexOf(AgentUiIds.auth.apple)).toBeLessThan(
      tree.indexOf(AgentUiIds.auth.unlockBiometric),
    );
    expect(screen.getByRole('switch', { name: 'Remember Me' })).toBeTruthy();
  });

  it('shows Remember Me when enrolled even before this account enables it', async () => {
    await enrollFaceId();
    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId(AgentUiIds.auth.unlockBiometric)).toBeTruthy();
    });
    expect(screen.getByText('Remember Me')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Remember Me' })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: false }),
    );
    expect(mockUnlockWithBiometrics).not.toHaveBeenCalled();
  });

  it('shows Remember Me on the welcome sign-in shell when enrolled', async () => {
    await enrollFaceId();
    mockAuthSession.phase = 'guest';
    mockAuthSession.isGuest = true;
    mockAuthSession.lockedEmail = undefined;
    mockAuthSession.lockedUserId = undefined;
    renderAuth('welcome');

    await waitFor(() => {
      expect(screen.getByTestId(AgentUiIds.auth.unlockBiometric)).toBeTruthy();
    });
    expect(screen.getByText('Remember Me')).toBeTruthy();
    expect(mockUnlockWithBiometrics).not.toHaveBeenCalled();
  });

  it('keeps Remember Me for fingerprint hardware', async () => {
    LocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
    LocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
    LocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([1]);
    mockAuthSession.phase = 'guest';
    mockAuthSession.isGuest = true;
    mockAuthSession.lockedEmail = undefined;
    mockAuthSession.lockedUserId = undefined;
    renderAuth('welcome');

    await waitFor(() => {
      expect(screen.getByTestId(AgentUiIds.auth.unlockBiometric)).toBeTruthy();
    });
    expect(screen.getByText('Remember Me')).toBeTruthy();
    expect(screen.queryByText('Unlock with Fingerprint')).toBeNull();
    expect(screen.queryByText('Unlock with Touch ID')).toBeNull();
  });

  it('opts in on welcome without unlocking or showing a sign-in-first error', async () => {
    await enrollFaceId();
    mockAuthSession.phase = 'guest';
    mockAuthSession.isGuest = true;
    mockAuthSession.lockedEmail = undefined;
    mockAuthSession.lockedUserId = undefined;
    renderAuth('welcome');

    await waitFor(() => {
      expect(screen.getByTestId(AgentUiIds.auth.unlockBiometric)).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId(AgentUiIds.auth.unlockBiometric));
    expect(mockUnlockWithBiometrics).not.toHaveBeenCalled();
    expect(useBiometricUnlock.getState().rememberMe).toBe(true);
    expect(
      screen.queryByText('Sign in with Apple or Google first. Face ID unlocks this device after that.'),
    ).toBeNull();
  });

  it('turns Remember Me off to disable biometric unlock', async () => {
    await enrollFaceId();
    useBiometricUnlock.setState({ enabledUserId: 'user-1', rememberMe: true });
    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId(AgentUiIds.auth.unlockBiometric)).toBeTruthy();
    });
    expect(screen.getByRole('switch', { name: 'Remember Me' })).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: true }),
    );
    await waitFor(() => {
      expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1);
    });

    fireEvent.press(screen.getByTestId(AgentUiIds.auth.unlockBiometric));
    expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1);
    expect(useBiometricUnlock.getState().enabledUserId).toBeNull();
    expect(useBiometricUnlock.getState().rememberMe).toBe(false);
  });

  it('unlocks when Remember Me is off and the locked toggle is turned on', async () => {
    await enrollFaceId();
    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId(AgentUiIds.auth.unlockBiometric)).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId(AgentUiIds.auth.unlockBiometric));
    expect(mockUnlockWithBiometrics).toHaveBeenCalledTimes(1);
    expect(useBiometricUnlock.getState().rememberMe).toBe(true);
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
