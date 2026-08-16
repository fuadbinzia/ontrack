import fs from 'node:fs';
import path from 'node:path';

/**
 * Local Android release APKs only receive EAS Update when the channel header is
 * embedded under the meta-data name expo-updates actually reads.
 * Wrong suffix `_JSON` (vs `_KEY`) → server 400 "channel-name: Required".
 */
describe('android OTA device channel contract', () => {
  const root = path.resolve(__dirname, '../../../../');
  const manifestPath = path.join(
    root,
    'android/app/src/main/AndroidManifest.xml',
  );
  const appJsonPath = path.join(root, 'app.json');

  it('AndroidManifest uses REQUEST_HEADERS_KEY with device channel', () => {
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    expect(manifest).not.toContain(
      'UPDATES_CONFIGURATION_REQUEST_HEADERS_JSON',
    );
    expect(manifest).toContain(
      'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY',
    );
    expect(manifest).toContain('expo-channel-name');
    expect(manifest).toContain('device');
  });

  it('app.json declares updates.requestHeaders for local prebuild/sync', () => {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')) as {
      expo?: { updates?: { requestHeaders?: Record<string, string> } };
    };
    expect(appJson.expo?.updates?.requestHeaders?.['expo-channel-name']).toBe(
      'device',
    );
  });

  it('waits at launch so a published OTA can apply on the same cold start', () => {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')) as {
      expo?: { updates?: { fallbackToCacheTimeout?: number } };
    };
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    const expoPlist = fs.readFileSync(
      path.join(root, 'ios/onTrack/Supporting/Expo.plist'),
      'utf8',
    );
    expect(appJson.expo?.updates?.fallbackToCacheTimeout).toBe(8000);
    expect(manifest).toContain(
      'expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS" android:value="8000"',
    );
    expect(expoPlist).toMatch(
      /<key>EXUpdatesLaunchWaitMs<\/key>\s*<integer>8000<\/integer>/,
    );
  });
});
