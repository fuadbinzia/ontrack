import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ProfileBiometricUnlockRow } from '@/features/account/profile-biometric-unlock-row';
import * as biometricUnlock from '@/features/auth/biometric-unlock';
import { useBiometricUnlock } from '@/store/biometric-unlock';
import { AgentUiIds } from '@/utils/agent-ui/ids';

const LocalAuthentication = jest.requireMock('expo-local-authentication') as {
  hasHardwareAsync: jest.Mock;
  isEnrolledAsync: jest.Mock;
  supportedAuthenticationTypesAsync: jest.Mock;
};

const mockEnable = jest.spyOn(biometricUnlock, 'enableBiometricUnlockForUser');

jest.mock('@/features/auth/auth-provider', () => ({
  useAuthSession: () => ({
    user: { id: 'user-1' },
    isGuest: false,
  }),
}));

describe('ProfileBiometricUnlockRow', () => {
  beforeEach(() => {
    mockEnable.mockClear();
    mockEnable.mockResolvedValue('enabled');
    useBiometricUnlock.setState({ enabledUserId: null });
    LocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
    LocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
    LocalAuthentication.supportedAuthenticationTypesAsync.mockResolvedValue([2]);
  });

  it('hides when this device has no biometric hardware', async () => {
    LocalAuthentication.hasHardwareAsync.mockResolvedValue(false);
    render(<ProfileBiometricUnlockRow />);

    await waitFor(() => {
      expect(LocalAuthentication.hasHardwareAsync).toHaveBeenCalled();
    });
    expect(screen.queryByTestId(AgentUiIds.profile.biometricUnlock)).toBeNull();
  });

  it('turns on only through a successful Face ID prompt', async () => {
    render(<ProfileBiometricUnlockRow />);

    await waitFor(() => {
      expect(screen.getByTestId(AgentUiIds.profile.biometricUnlock)).toBeTruthy();
    });
    expect(screen.getByText('Unlock with Face ID')).toBeTruthy();
    expect(
      screen.getByText('Unlock from the sign-in screen after you close the app'),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId(AgentUiIds.profile.biometricUnlock));
    await waitFor(() => {
      expect(mockEnable).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          capability: expect.objectContaining({ available: true, label: 'Unlock With Face ID' }),
        }),
      );
    });
  });
});
