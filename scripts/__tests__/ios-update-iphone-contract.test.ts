import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const picker = join(root, 'scripts/lib/ios-usb-iphone.mjs');

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8');
}

function pick(payload: unknown): string {
  return execFileSync('node', [picker], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  }).trim();
}

describe('ios USB iPhone update', () => {
  it('prefers a wired connected iPhone over a paired-but-unavailable one', () => {
    expect(
      pick({
        result: {
          devices: [
            {
              identifier: '15-core',
              hardwareProperties: {
                marketingName: 'iPhone 15',
                udid: '00008120-UNAVAILABLE',
              },
              connectionProperties: {
                pairingState: 'paired',
                tunnelState: 'unavailable',
              },
            },
            {
              identifier: '17-core',
              hardwareProperties: {
                marketingName: 'iPhone 17 Pro',
                udid: '00008150-CONNECTED',
              },
              connectionProperties: {
                transportType: 'wired',
                tunnelState: 'connected',
              },
            },
          ],
        },
      }),
    ).toBe('00008150-CONNECTED');
  });

  it('accepts a wired iPhone whose developer tunnel is still disconnected', () => {
    expect(
      pick({
        result: {
          devices: [
            {
              identifier: '15-core',
              hardwareProperties: {
                marketingName: 'iPhone 15',
                udid: '00008120-UNAVAILABLE',
              },
              connectionProperties: {
                pairingState: 'paired',
                tunnelState: 'unavailable',
              },
            },
            {
              identifier: '17-core',
              hardwareProperties: {
                marketingName: 'iPhone 17 Pro',
                udid: '00008150-WIRED',
              },
              connectionProperties: {
                transportType: 'wired',
                tunnelState: 'disconnected',
              },
            },
          ],
        },
      }),
    ).toBe('00008150-WIRED');
  });

  it('errors when no iPhone is connected', () => {
    expect(() => pick({ result: { devices: [] } })).toThrow(/no connected iPhone/);
  });

  it('defaults to device-channel OTA and keeps IPA behind --ipa', () => {
    const script = read('scripts/ios-update-iphone.sh');
    const pkg = JSON.parse(read('package.json')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.['ios:update-iphone']).toContain('ios-update-iphone.sh');
    expect(script).toContain('--channel device');
    expect(script).toContain('--environment preview');
    expect(script).toContain('ON_LOAD');
    expect(script).toContain('--ipa|--native');
    expect(script).toContain('--profile device');
    expect(script).toContain('--local');
    expect(script).not.toContain('refresh-ad-hoc-provisioning-profile');
    expect(script).toContain('com.imtihoss.ontracknow');
    expect(script).toContain('--terminate-existing');
    expect(script).toContain('[[ -n "$UDID" ]]');
  });
});
