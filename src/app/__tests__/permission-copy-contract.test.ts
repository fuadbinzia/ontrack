import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appJsonPath = join(__dirname, '../../../app.json');
const appJsonText = readFileSync(appJsonPath, 'utf8');
const appJson = JSON.parse(appJsonText) as {
  expo: {
    android?: { permissions?: string[] };
    ios?: { infoPlist?: Record<string, unknown> };
    plugins?: Array<string | [string, Record<string, unknown>?]>;
  };
};

function pluginConfig(name: string): Record<string, unknown> | undefined {
  const entry = appJson.expo.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === name,
  );
  if (!Array.isArray(entry)) return undefined;
  return (entry[1] ?? {}) as Record<string, unknown>;
}

describe('store permission copy', () => {
  it('lists real camera and photo uses and drops Android fine location', () => {
    expect(appJsonText).toContain('E-ZPass');
    expect(appJsonText).toContain('travel confirmations');
    expect(appJsonText).toContain('tax documents');
    expect(appJsonText).toContain('avatars');
    expect(appJsonText).toContain('motion sensors');
    expect(appJsonText).not.toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(appJsonText).toContain('android.permission.ACCESS_COARSE_LOCATION');
    expect(appJsonText).toMatch(/photosPermission[\s\S]*E-ZPass/);
    expect(appJsonText).toMatch(/cameraPermission[\s\S]*E-ZPass/);
    expect(appJsonText).toMatch(/NSMicrophoneUsageDescription[\s\S]*dock search voice/);
    expect(appJsonText).toMatch(/microphonePermission[\s\S]*dock search voice/);
  });

  it('declares RECORD_AUDIO so Android app permissions show a Microphone row', () => {
    const permissions = appJson.expo.android?.permissions ?? [];
    expect(permissions).toContain('android.permission.RECORD_AUDIO');
  });

  it('keeps coarse location without fine location next to the Microphone permission', () => {
    const permissions = appJson.expo.android?.permissions ?? [];
    expect(permissions).toContain('android.permission.ACCESS_COARSE_LOCATION');
    expect(permissions).not.toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(appJsonText).not.toContain('android.permission.ACCESS_FINE_LOCATION');
  });

  it('does not set image-picker microphonePermission false (that blocks RECORD_AUDIO app-wide)', () => {
    const imagePicker = pluginConfig('expo-image-picker');
    expect(imagePicker).toBeDefined();
    expect(imagePicker?.microphonePermission).not.toBe(false);
    expect(typeof imagePicker?.microphonePermission).toBe('string');
    expect(String(imagePicker?.microphonePermission)).toContain('dock search voice');
  });

  it('keeps expo-audio recording enabled so dock search voice can use the microphone', () => {
    const audio = pluginConfig('expo-audio');
    expect(audio).toBeDefined();
    expect(audio?.recordAudioAndroid).not.toBe(false);
    expect(typeof audio?.microphonePermission).toBe('string');
    expect(String(audio?.microphonePermission)).toContain('dock search voice');
    expect(String(appJson.expo.ios?.infoPlist?.NSMicrophoneUsageDescription)).toContain(
      'dock search voice',
    );
  });

  it('does not block RECORD_AUDIO via blockedPermissions or microphonePermission false', () => {
    expect(appJsonText).not.toMatch(/"blockedPermissions"/);
    expect(appJsonText).not.toMatch(/"microphonePermission"\s*:\s*false/);
    for (const plugin of appJson.expo.plugins ?? []) {
      if (!Array.isArray(plugin) || !plugin[1]) continue;
      const config = plugin[1];
      expect(config.microphonePermission).not.toBe(false);
      expect(config).not.toHaveProperty('blockedPermissions');
    }
  });
});
