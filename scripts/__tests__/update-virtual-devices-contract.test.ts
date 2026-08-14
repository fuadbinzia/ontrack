import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'scripts/update-virtual-devices.sh'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

describe('virtual device build sync contract', () => {
  it('targets every onTrack virtual device and no unrelated AVD', () => {
    for (const target of [
      'onTrack Agent 1',
      'onTrack Agent 2',
      'onTrack Agent 3',
      'onTrack Agent 4',
      'onTrack iPhone 17 Pro',
      'Galaxy_S26',
      'onTrack_Agent_1',
      'onTrack_Agent_2',
      'onTrack_Agent_3',
      'onTrack_Agent_4',
    ]) {
      expect(script).toContain(`"${target}"`);
    }
    expect(script).not.toContain('IdeaHome_API_35');
  });

  it('updates in place so simulator and emulator data survive', () => {
    expect(script).toContain('xcrun simctl install');
    expect(script).toContain('install -r -d');
    expect(script).not.toMatch(/simctl uninstall|adb[^\n]* uninstall/);
  });

  it('restores stopped iOS devices and updates Android AVDs sequentially', () => {
    expect(script).toContain('TEMP_IOS_UDIDS+=("$udid")');
    expect(script).toContain('shutdown_temporary_ios');
    expect(script).toContain('prepare_ordered_android_names');
    expect(script).toContain('for name in "${ORDERED_ANDROID_NAMES[@]}"');
    expect(script).toMatch(/prepare_ordered_android_names\(\)[\s\S]*?return 0\n}/);
    expect(script).toContain('android_emu_shutdown_named "$name"');
    expect(script).toMatch(/ensure-android-emulator\.sh[^\n]*<\/dev\/null/g);
  });

  it('rejects incomplete build artifacts before installation', () => {
    expect(script).toContain('validate_ios_app');
    expect(script).toContain('incomplete iOS app (no Info.plist)');
    expect(script).toContain('[[ -s "$ANDROID_APK" ]]');
  });

  it('is exposed as the canonical sync command', () => {
    expect(pkg.scripts['virtual-devices:update']).toBe(
      'bash ./scripts/update-virtual-devices.sh',
    );
    expect(pkg.scripts['ios:update-simulators']).toContain('--ios');
    expect(pkg.scripts['android:update-emulators']).toContain('--android');
  });
});
