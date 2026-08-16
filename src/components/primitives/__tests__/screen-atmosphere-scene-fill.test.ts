import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { screenAtmosphereSceneOffset } from '@/components/primitives/screen-atmosphere';

describe('screenAtmosphereSceneOffset', () => {
  it('shifts the card wash up by the status-bar inset so it matches the shell', () => {
    expect(screenAtmosphereSceneOffset(59)).toBe(-59);
    expect(screenAtmosphereSceneOffset(47.5)).toBe(-47.5);
  });

  it('stays put when there is no top inset', () => {
    expect(screenAtmosphereSceneOffset(0)).toBe(0);
    expect(screenAtmosphereSceneOffset(-12)).toBe(0);
    expect(screenAtmosphereSceneOffset(Number.NaN)).toBe(0);
  });
});

describe('Screen atmosphere scene fill', () => {
  it('occludes the previous stack page without restarting the wash at the safe-area edge', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/components/primitives/screen.tsx'),
      'utf8',
    );
    const atmosphere = readFileSync(
      join(process.cwd(), 'src/components/primitives/screen-atmosphere.tsx'),
      'utf8',
    );
    const stack = readFileSync(
      join(process.cwd(), 'src/components/navigation/app-stack.tsx'),
      'utf8',
    );

    expect(screen).toContain('{useAtmosphere ? <ScreenAtmosphereSceneFill');
    expect(screen).toContain('{shell}');
    expect(screen.indexOf('{shell}')).toBeLessThan(
      screen.indexOf('{useAtmosphere ? <ScreenAtmosphereSceneFill'),
    );
    expect(screen).toContain('useScreenAtmosphereChrome(');
    expect(atmosphere).toContain('screenAtmosphereSceneOffset(insets.top)');
    expect(atmosphere).toContain('height');
    expect(stack).toContain("contentStyle: { backgroundColor: 'transparent' }");
  });
});
