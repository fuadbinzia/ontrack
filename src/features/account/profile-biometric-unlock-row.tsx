import { SettingsGroup, SettingsToggleRow } from '@/components/primitives';
import { useAuthSession } from '@/features/auth/auth-provider';
import {
    disableBiometricUnlock,
    enableBiometricUnlockForUser,
    useBiometricCapability,
} from '@/features/auth/biometric-unlock';
import { useBiometricUnlock } from '@/store/biometric-unlock';
import { AgentUiIds } from '@/utils/agent-ui';

/** Signed-in Face ID / fingerprint opt-in. Hidden when this device has no hardware. */
export function ProfileBiometricUnlockRow() {
  const { user, isGuest } = useAuthSession();
  const capability = useBiometricCapability();
  const enabledUserId = useBiometricUnlock((state) => state.enabledUserId);
  const userId = user?.id;
  const enabled = Boolean(userId) && enabledUserId === userId;

  if (isGuest || !userId || !capability.hasHardware) return null;

  return (
    <SettingsGroup>
      <SettingsToggleRow
        label={capability.label}
        detail={
          capability.enrolled
            ? 'Unlock from the sign-in screen after you close the app'
            : 'Set up Face ID or a fingerprint in system settings first'
        }
        icon={capability.icon}
        value={enabled}
        disabled={!capability.enrolled}
        onValueChange={(next) => {
          if (!next) {
            disableBiometricUnlock();
            return;
          }
          void enableBiometricUnlockForUser(userId, { capability });
        }}
        testID={AgentUiIds.profile.biometricUnlock}
      />
    </SettingsGroup>
  );
}
