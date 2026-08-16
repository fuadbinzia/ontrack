import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  utimesSync,
  mkdirSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  artifactIdentity,
  identityFromPath,
  shouldInstallOntoDevice,
  shouldRebuildArtifact,
  collectNativeSourceMtimes,
  userVirtualDevices,
} from '../lib/native-build-freshness.js';

describe('native build freshness (sim/emu latest build)', () => {
  it('refreshes a warm device when the local debug artifact is newer than the last install', () => {
    // Reproduce: app is installed (bridge would answer) but stamp still names
    // the old binary. Verify must reinstall instead of testing 1.0.68 forever.
    expect(
      shouldInstallOntoDevice({
        appInstalled: true,
        stampIdentity: artifactIdentity({
          version: '1.0.68',
          mtimeMs: 100,
          size: 10,
        }),
        artifactIdentity: artifactIdentity({
          version: '1.0.68',
          mtimeMs: 200,
          size: 11,
        }),
      }),
    ).toBe(true);
  });

  it('reinstalls when the host stamp is fresh but the device binary is still old', () => {
    // Pro can keep 1.0.68 after an agent writes a stamp without installing
    // ("leave Pro untouched"). Compare the on-device binary, not the stamp.
    const fresh = artifactIdentity({
      version: '1.0.112',
      mtimeMs: 200,
      size: 11,
    });
    const stale = artifactIdentity({
      version: '1.0.68',
      mtimeMs: 100,
      size: 10,
    });
    expect(
      shouldInstallOntoDevice({
        appInstalled: true,
        stampIdentity: fresh,
        installedIdentity: stale,
        artifactIdentity: fresh,
      }),
    ).toBe(true);
    expect(
      shouldInstallOntoDevice({
        appInstalled: true,
        stampIdentity: stale,
        installedIdentity: fresh,
        artifactIdentity: fresh,
      }),
    ).toBe(false);
  });

  it('skips reinstall when the current device already has this artifact', () => {
    const identity = artifactIdentity({
      version: '1.0.103',
      mtimeMs: 50,
      size: 8,
    });
    expect(
      shouldInstallOntoDevice({
        appInstalled: true,
        stampIdentity: identity,
        artifactIdentity: identity,
      }),
    ).toBe(false);
  });

  it('installs when the slot has no app even if a stamp is leftover', () => {
    expect(
      shouldInstallOntoDevice({
        appInstalled: false,
        stampIdentity: 'stale-stamp',
        artifactIdentity: '1.0.103:1:1',
      }),
    ).toBe(true);
  });

  it('does not install when there is no local debug artifact', () => {
    expect(
      shouldInstallOntoDevice({
        appInstalled: true,
        stampIdentity: '',
        artifactIdentity: '',
      }),
    ).toBe(false);
  });

  it('rebuilds only when native sources outpace the artifact, not when the artifact is missing', () => {
    // Missing artifact → clone/existing install; do not xcodebuild on every
    // first verify. A newer modules/ file must rebuild the existing artifact.
    expect(
      shouldRebuildArtifact({
        artifactExists: false,
        artifactMtimeMs: 0,
        sourceMtimesMs: [9_999],
        force: false,
      }),
    ).toBe(false);
    expect(
      shouldRebuildArtifact({
        artifactExists: true,
        artifactMtimeMs: 100,
        sourceMtimesMs: [99],
        force: false,
      }),
    ).toBe(false);
    expect(
      shouldRebuildArtifact({
        artifactExists: true,
        artifactMtimeMs: 100,
        sourceMtimesMs: [101],
        force: false,
      }),
    ).toBe(true);
    expect(
      shouldRebuildArtifact({
        artifactExists: false,
        artifactMtimeMs: 0,
        sourceMtimesMs: [],
        force: true,
      }),
    ).toBe(true);
  });

  it('ignores module build outputs when collecting native source mtimes', () => {
    const root = mkdtempSync(join(tmpdir(), 'ontrack-native-fresh-'));
    mkdirSync(join(root, 'modules', 'voice', 'android', 'build'), {
      recursive: true,
    });
    mkdirSync(join(root, 'ios'), { recursive: true });
    writeFileSync(join(root, 'ios', 'Podfile.lock'), 'lock');
    writeFileSync(join(root, 'modules', 'voice', 'index.ts'), 'src');
    writeFileSync(
      join(root, 'modules', 'voice', 'android', 'build', 'out.bin'),
      'stale',
    );
    const now = Date.now() / 1000;
    utimesSync(join(root, 'ios', 'Podfile.lock'), now, now);
    utimesSync(join(root, 'modules', 'voice', 'index.ts'), now + 10, now + 10);
    utimesSync(
      join(root, 'modules', 'voice', 'android', 'build', 'out.bin'),
      now + 10_000,
      now + 10_000,
    );

    const times = collectNativeSourceMtimes(root, 'ios');
    const newest = Math.max(...times);
    const sourceMtime = statSync(join(root, 'modules', 'voice', 'index.ts'))
      .mtimeMs;
    const buildMtime = statSync(
      join(root, 'modules', 'voice', 'android', 'build', 'out.bin'),
    ).mtimeMs;
    expect(newest).toBe(sourceMtime);
    expect(newest).toBeLessThan(buildMtime);
  });

  it('builds an identity from an on-disk artifact', () => {
    const root = mkdtempSync(join(tmpdir(), 'ontrack-artifact-'));
    const file = join(root, 'app-debug.apk');
    writeFileSync(file, 'apk');
    const identity = identityFromPath(file, '1.0.90');
    expect(identity.startsWith('1.0.90:')).toBe(true);
    expect(identity.split(':')).toHaveLength(3);
  });

  it('exposes install/rebuild decisions on the host CLI', () => {
    const cli = join(process.cwd(), 'scripts/lib/native-build-freshness.js');
    const install = execFileSync(
      'node',
      [
        cli,
        'install-needed',
        '--installed',
        '1',
        '--stamp',
        'old',
        '--artifact-id',
        'new',
      ],
      { encoding: 'utf8' },
    ).trim();
    expect(install).toBe('1');

    const skip = execFileSync(
      'node',
      [
        cli,
        'install-needed',
        '--installed',
        '1',
        '--stamp',
        'same',
        '--artifact-id',
        'same',
      ],
      { encoding: 'utf8' },
    ).trim();
    expect(skip).toBe('0');

    const stampLie = execFileSync(
      'node',
      [
        cli,
        'install-needed',
        '--installed',
        '1',
        '--stamp',
        'fresh',
        '--installed-id',
        'stale-on-device',
        '--artifact-id',
        'fresh',
      ],
      { encoding: 'utf8' },
    ).trim();
    expect(stampLie).toBe('1');

    const missing = execFileSync(
      'node',
      [
        cli,
        'rebuild-needed',
        '--root',
        process.cwd(),
        '--platform',
        'ios',
        '--artifact',
        '/tmp/ontrack-missing-debug.app',
      ],
      { encoding: 'utf8' },
    ).trim();
    expect(missing).toBe('0');
  });

  it('includes the headed Pro simulator and restricted Galaxy emulator in app updates', () => {
    const devices = userVirtualDevices();
    expect(devices.ios).toEqual(['onTrack iPhone 17 Pro']);
    expect(devices.android).toEqual(['Galaxy_S26']);
    const listed = execFileSync(
      'node',
      [join(process.cwd(), 'scripts/lib/native-build-freshness.js'), 'user-devices'],
      { encoding: 'utf8' },
    );
    expect(listed).toContain('onTrack iPhone 17 Pro');
    expect(listed).toContain('Galaxy_S26');
  });

  it('compares the on-device iOS binary and does not freeze CFBundleShortVersionString', () => {
    const vd = readFileSync(
      join(process.cwd(), 'scripts/lib/virtual-device-build.sh'),
      'utf8',
    );
    expect(vd).toContain('vd_ios_installed_identity');
    expect(vd).toContain('vd_install_needed "$installed" "$stamp" "$identity" "$installed_identity"');
    expect(vd).toContain('--installed-id');

    const info = readFileSync(
      join(process.cwd(), 'ios/onTrack/Info.plist'),
      'utf8',
    );
    expect(info).toContain('<string>$(MARKETING_VERSION)</string>');
    expect(info).not.toMatch(
      /<key>CFBundleShortVersionString<\/key>\s*<string>1\.0\.\d+<\/string>/,
    );
  });
});
