import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    screenAtmosphereFollowsScroll,
    screenAtmosphereSceneOffset,
} from '@/components/primitives/screen-atmosphere';

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

    expect(screen).toContain('screenAtmosphereFollowsScroll(Platform.OS)');
    expect(screen).toContain('{sceneFill}');
    expect(screen).toContain('{shell}');
    expect(screen).toContain('styles.aboveAtmosphere');
    expect(screen).toContain('useScreenAtmosphereChrome(');
    expect(atmosphere).toContain('screenAtmosphereSceneOffset(insets.top)');
    expect(atmosphere).toContain('height');
    expect(stack).toContain("contentStyle: { backgroundColor: 'transparent' }");
  });
});

describe('Android scrolling tabs are not a blank atmosphere wash', () => {
  it('paints the wash first on Android so Calendar and Profile chrome stay visible', () => {
    expect(screenAtmosphereFollowsScroll('android')).toBe(false);
    expect(screenAtmosphereFollowsScroll('ios')).toBe(true);
  });

  it('keeps iOS and web on the first-child scroll path', () => {
    expect(screenAtmosphereFollowsScroll('ios')).toBe(true);
    expect(screenAtmosphereFollowsScroll('web')).toBe(true);
    expect(screenAtmosphereFollowsScroll('windows')).toBe(true);
    expect(screenAtmosphereFollowsScroll('macos')).toBe(true);
  });

  it('wires Screen to flip child order from the helper, not a hard-coded Android branch', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/components/primitives/screen.tsx'),
      'utf8',
    );
    expect(screen).toContain('screenAtmosphereFollowsScroll(Platform.OS)');
    expect(screen).toMatch(
      /screenAtmosphereFollowsScroll\(Platform\.OS\) \? \([\s\S]*\{shell\}[\s\S]*\{sceneFill\}[\s\S]*\) : \([\s\S]*\{sceneFill\}[\s\S]*\{shell\}/,
    );
  });

  it('Calendar and Profile use the default scrolling Screen that Android used to blank', () => {
    const calendar = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/calendar.tsx'),
      'utf8',
    );
    const profile = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/profile/index.tsx'),
      'utf8',
    );
    expect(calendar).toContain('<Screen>');
    expect(calendar).not.toContain('scroll={false}');
    expect(profile).toContain('<Screen');
    expect(profile).not.toContain('scroll={false}');
  });
});
