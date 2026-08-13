import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Expo iOS runtime replacement lifecycle', () => {
  const patch = readFileSync(
    join(process.cwd(), 'patches/expo-modules-core+57.0.8.patch'),
    'utf8',
  );
  const appContext = readFileSync(
    join(
      process.cwd(),
      'node_modules/expo-modules-core/ios/Core/AppContext.swift',
    ),
    'utf8',
  );

  it('prevents an old runtime from destroying the replacement AppContext', () => {
    expect(patch).toContain('runtimeId: runtime.id');
    expect(patch).toContain(
      'guard nativeState.appContext._runtime?.id == nativeState.runtimeId else',
    );
    expect(
      appContext.indexOf('._runtime?.id == nativeState.runtimeId'),
    ).toBeLessThan(appContext.indexOf('nativeState.appContext.destroy()'));
  });

  it('keeps normal current-runtime teardown responsible for cleanup', () => {
    expect(patch).toContain('internal let runtimeId: JavaScriptRuntime.ID');
    expect(appContext).toContain('nativeState.appContext.destroy()');
  });

  it('does not give subordinate runtimes ownership of AppContext teardown', () => {
    expect(appContext).toContain('nativeState.ownsLifecycle');
    expect(patch).toContain('ownsLifecycle: ownsLifecycle');
  });
});
