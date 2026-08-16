import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    HIDDEN_SCROLL_EDGE_EFFECTS,
    resolveScrollEdgeEffects,
} from '../scroll-edge-effects';

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), 'utf8');

describe('iOS 26 overscroll cannot blank a glass page', () => {
  it('hides every scroll edge unless a screen opts into an effect', () => {
    expect(resolveScrollEdgeEffects(undefined)).toEqual(
      HIDDEN_SCROLL_EDGE_EFFECTS,
    );
    expect(
      resolveScrollEdgeEffects({
        top: 'soft',
        bottom: 'hidden',
        left: 'hidden',
        right: 'hidden',
      }),
    ).toEqual({
      top: 'soft',
      bottom: 'hidden',
      left: 'hidden',
      right: 'hidden',
    });
  });

  it('defaults tab Screen hosts to hidden (Calendar is not a native stack)', () => {
    const safe = read('src/components/primitives/app-safe-area.tsx');
    const effects = read('src/components/navigation/scroll-edge-effects.tsx');
    expect(effects).toContain('ScreenContext');
    expect(effects).toContain('HideIosScrollEdgeScreen');
    expect(effects).toContain("top: 'hidden'");
    expect(effects).toContain("bottom: 'hidden'");
    expect(safe).toContain('ScreenContext.Provider');
    expect(safe).toContain('hideIosScrollEdgeScreenContext');
  });

  it('pins native-stack screens to hidden so Expo Router cannot forward automatic', () => {
    const stack = read('src/components/navigation/app-stack.tsx');
    expect(stack).toContain('HIDDEN_SCROLL_EDGE_EFFECTS');
    expect(stack).toContain('scrollEdgeEffects: HIDDEN_SCROLL_EDGE_EFFECTS');
  });

  it('keeps Screen scroll as the first child so the native finder hits UIScrollView', () => {
    const screen = read('src/components/primitives/screen.tsx');
    const atmosphere = read('src/components/primitives/screen-atmosphere.tsx');
    const fillIndex = screen.indexOf('{useAtmosphere ? <ScreenAtmosphereSceneFill');
    const shellIndex = screen.indexOf('{shell}');
    expect(shellIndex).toBeGreaterThan(0);
    expect(fillIndex).toBeGreaterThan(shellIndex);
    expect(screen).toContain('alwaysBounceVertical={false}');
    expect(screen).toContain('zIndex: 1');
    expect(atmosphere).toContain('behindScroll');
    expect(atmosphere).toContain('zIndex: 0');
  });
});
