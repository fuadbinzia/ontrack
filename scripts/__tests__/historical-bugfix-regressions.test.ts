import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('historical bug-fix regressions', () => {
  it('keeps sharp optional so native TestFlight installs do not require it', () => {
    const pkg = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };

    expect(pkg.dependencies?.sharp).toBeUndefined();
    expect(pkg.devDependencies?.sharp).toBeUndefined();
    expect(pkg.optionalDependencies?.sharp).toMatch(/^\^0\.34\./);
  });

  it('keeps OTA runtime updates isolated from routine app-version bumps', () => {
    const app = JSON.parse(read('app.json')) as {
      expo: { runtimeVersion?: unknown; version?: string };
    };

    expect(typeof app.expo.runtimeVersion).toBe('string');
    expect(app.expo.runtimeVersion).not.toBe(app.expo.version);
  });

  it('builds a compatible TestFlight binary before publishing an orphaned runtime', () => {
    const ship = read('scripts/ship-push.sh');
    const compatibilityCheck = ship.indexOf('ensure_testflight_runtime');
    const testflightPublish = ship.indexOf('npm run update:testflight');

    expect(ship).toContain('--build-profile testflight');
    expect(ship).toContain('--status finished');
    expect(ship).toContain('npm run build:testflight');
    expect(compatibilityCheck).toBeGreaterThan(-1);
    expect(testflightPublish).toBeGreaterThan(compatibilityCheck);
  });

  it('adds both Siri Swift sources through the supported Xcode helper', () => {
    const plugin = read('plugins/with-ontrack-voice-lists.js');

    expect(plugin).toContain('IOSConfig.XcodeUtils.ensureGroupRecursively');
    expect(plugin).toContain('IOSConfig.XcodeProjectFile.createBuildSourceFile');
    expect(plugin).toContain('fileContents: fs.readFileSync(file.from');
    expect(plugin).toContain('overwrite: true');
    expect(plugin).not.toContain('project.addSourceFile');
  });

  it('keeps the iOS Simulator Keychain re-signing path wired into builds', () => {
    const app = JSON.parse(read('app.json')) as {
      expo: { plugins?: (string | [string, unknown])[] };
    };
    const pkg = JSON.parse(read('package.json')) as {
      scripts?: Record<string, string>;
    };
    const pluginNames = (app.expo.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin,
    );
    const plugin = read('plugins/with-simulator-keychain-codesign.js');
    const resigner = read('scripts/resign-ios-simulator-app.js');

    expect(pluginNames).toContain('./plugins/with-simulator-keychain-codesign.js');
    expect(pkg.scripts?.['ios:run']).toContain('ensure-ios-simulator-codesign.sh');
    expect(plugin).toContain('PLATFORM_NAME');
    expect(plugin).toContain('iphonesimulator');
    expect(plugin).toContain('--generate-entitlement-der');
    expect(resigner).toContain('--generate-entitlement-der');
  });

  it('keeps header spacing on pushed screens without offsetting root shells', () => {
    const layout = read('src/app/_layout.tsx');

    expect(layout).toMatch(
      /screenOptions=\{\{[\s\S]*?contentStyle:\s*\{[\s\S]*?paddingTop:\s*spacing\.md/,
    );
    for (const route of ['(tabs)', 'onboarding']) {
      expect(layout).toMatch(
        new RegExp(
          `name=["']${route.replace(/[()]/g, '\\$&')}["'][\\s\\S]*?headerShown:\\s*false[\\s\\S]*?contentStyle:\\s*\\{\\s*backgroundColor:\\s*["']transparent["']\\s*\\}`,
        ),
      );
    }
  });

  it('keeps the web invite root full-height and flex-based in Safari', () => {
    const html = read('src/app/+html.tsx');

    expect(html).toContain('html, body, #root { height: 100%; min-height: 100%');
    expect(html).toContain('#root { display: flex; }');
    expect(html).toContain('min-height: 100dvh');
  });
});
