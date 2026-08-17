import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const app = JSON.parse(readFileSync(resolve(process.cwd(), 'app.json'), 'utf8')) as {
  expo: {
    ios?: { infoPlist?: Record<string, string> };
    plugins?: (string | [string, unknown])[];
  };
};
const provider = readFileSync(resolve(process.cwd(), 'src/features/auth/auth-provider.tsx'), 'utf8');
const storage = readFileSync(resolve(process.cwd(), 'src/services/cloud/supabase.ts'), 'utf8');

describe('biometric unlock native contract', () => {
  it('declares Face ID usage and the local-authentication plugin', () => {
    expect(app.expo.ios?.infoPlist?.NSFaceIDUsageDescription).toMatch(/Face ID/i);
    const pluginNames = (app.expo.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin,
    );
    expect(pluginNames).toContain('expo-local-authentication');
  });

  it('unlocks the existing disk session instead of wrapping SecureStore in Face ID', () => {
    expect(provider).toContain('unlockWithBiometrics');
    expect(provider).toContain('authenticateBiometricUnlock');
    expect(provider).toContain('setBiometricUnlockUserId');
    expect(provider).toContain('applyRememberMeForUser');
    expect(provider).toContain('initializeAccount(disk)');
    expect(provider).not.toContain('Face ID unlocks this device after that');
    expect(provider).not.toContain('isBiometricUnlockEnabledFor');
    expect(provider).not.toContain('requireAuthentication');
    expect(storage).not.toContain('requireAuthentication');
  });
});
