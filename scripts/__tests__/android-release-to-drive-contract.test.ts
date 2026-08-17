import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const script = readFileSync(
  join(process.cwd(), 'scripts/android-release-to-drive.sh'),
  'utf8',
);

describe('android release APK build defaults', () => {
  it('keeps the Gradle daemon and skips module clean unless asked', () => {
    expect(script).toContain('CLEAN_NATIVE=0');
    expect(script).toContain('--clean-native) CLEAN_NATIVE=1');
    expect(script).not.toMatch(/\.\/gradlew --no-daemon/);
    expect(script).toContain('./gradlew "${GRADLE_ARGS[@]}"');
  });

  it('builds arm64-only sideload APKs unless --all-abis is set', () => {
    expect(script).toContain('ALL_ABIS=0');
    expect(script).toContain('--all-abis) ALL_ABIS=1');
    expect(script).toContain('-PreactNativeArchitectures=arm64-v8a');
  });
});
