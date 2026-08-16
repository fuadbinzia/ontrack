import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('expo-screen-orientation iOS registry concurrency', () => {
  const patch = readFileSync(
    join(process.cwd(), 'patches/expo-screen-orientation+57.0.1.patch'),
    'utf8',
  );
  const registry = readFileSync(
    join(
      process.cwd(),
      'node_modules/expo-screen-orientation/ios/ScreenOrientationRegistry.swift',
    ),
    'utf8',
  );

  it('serializes controller list mutations instead of concurrent GCD appends', () => {
    expect(patch).toContain('private let stateLock = NSLock()');
    expect(registry).toContain('private let stateLock = NSLock()');
    expect(registry).not.toContain('attributes: .concurrent');
    expect(registry).not.toMatch(/queue\.sync\s*\{/);
  });

  it('does not append a controller that is already registered', () => {
    expect(registry).toContain(
      'if !orientationControllers.contains(where: { $0 === controller })',
    );
  });

  it('iterates a snapshot so orientation callbacks cannot mutate under the lock', () => {
    expect(registry).toContain('let controllers = orientationControllers');
    expect(registry.indexOf('stateLock.unlock()')).toBeLessThan(
      registry.indexOf('for controller in controllers'),
    );
  });
});
