import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8');
}

function groupId(raw: string): string {
  return execFileSync('node', [join(root, 'scripts/lib/eas-update-group-id.mjs')], {
    input: raw,
    encoding: 'utf8',
  });
}

describe('publish OTA once then republish', () => {
  it('parses the eas update --json group for non-interactive republish', () => {
    expect(
      groupId(
        JSON.stringify([
          {
            id: 'ios-update',
            group: '11111111-1111-4111-8111-111111111111',
            platform: 'ios',
          },
          {
            id: 'android-update',
            group: '11111111-1111-4111-8111-111111111111',
            platform: 'android',
          },
        ]),
      ),
    ).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('parses a wrapped updates array and rejects empty or group-less stdout', () => {
    expect(
      groupId(
        JSON.stringify({
          updates: [{ group: '22222222-2222-4222-8222-222222222222' }],
        }),
      ),
    ).toBe('22222222-2222-4222-8222-222222222222');

    expect(() => groupId('')).toThrow();
    expect(() => groupId('{"ok":true}')).toThrow();
  });

  it('does not treat a complete dist as export failure when eas env:exec exits non-zero', () => {
    const publish = read('scripts/publish-ota.sh');
    const ship = read('scripts/ship-push.sh');
    expect(publish).toContain('export_complete');
    expect(publish).toContain('complete dist/; continuing');
    expect(ship).toContain('dist/metadata.json');
    expect(ship).toContain('dist/assetmap.json');
    expect(ship).toContain('dist/ is complete, continuing');
    expect(ship).not.toMatch(/wait "\$export_pid" \|\| die "OTA export failed"/);
  });

  it('exports once without source maps then skip-bundler uploads and republishes', () => {
    const publish = read('scripts/publish-ota.sh');
    const ship = read('scripts/ship-push.sh');
    const pkg = JSON.parse(read('package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(publish).toContain('npx expo export');
    expect(publish).toContain('--platform ios');
    expect(publish).toContain('--platform android');
    expect(publish).toContain('--dump-assetmap');
    expect(publish).not.toMatch(/dump-sourcemap|--source-maps true/);
    expect(publish).toContain('--source-maps false');
    expect(publish).toContain('--skip-bundler');
    expect(publish).toContain('update:republish');
    expect(publish).toContain('--destination-channel device');
    expect(publish).toContain('--export-only');
    expect(publish).toContain('--upload-only');
    expect(publish).toContain('dist/metadata.json');
    expect(publish).toContain('complete dist/');
    expect(ship).toContain('--export-only');
    expect(ship).toContain('--upload-only');
    expect(ship).toContain('dist/metadata.json');
    expect(ship).toContain('dist/ is complete, continuing');
    expect(ship).not.toContain('npm run update:device');
    expect(pkg.scripts?.['update:preview']).toContain('publish-ota.sh');
  });

  it('deploys EAS Hosting so new API routes such as Drive backup go live with push', () => {
    const ship = read('scripts/ship-push.sh');
    expect(ship).toContain("npx expo export -p web");
    expect(ship).toContain('deploy --prod --environment production');
  });
});
