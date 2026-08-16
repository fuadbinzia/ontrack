import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  TAB_SCENE_KEEP_PAINTED_SPEC,
  tabSceneKeepPainted,
} from '../tab-scene-visibility';

const read = (relative: string) =>
  readFileSync(join(process.cwd(), relative), 'utf8');

describe('tab swipe reveals painted neighbors, not a blank page', () => {
  it('keeps the navigator animation inert — the pager owns all motion', () => {
    expect(TAB_SCENE_KEEP_PAINTED_SPEC.animation).toBe('timing');
    expect(TAB_SCENE_KEEP_PAINTED_SPEC.config.duration).toBe(0);
  });

  it('never fades, shifts, or hides scenes from the interpolator', () => {
    const { sceneStyle } = tabSceneKeepPainted();
    expect(Object.keys(sceneStyle)).toHaveLength(0);
  });

  it('wires the keep-painted spec into the tabs layout without animation: none', () => {
    const tabs = read('src/app/(tabs)/_layout.tsx');
    expect(tabs).toContain('transitionSpec: TAB_SCENE_KEEP_PAINTED_SPEC');
    expect(tabs).toContain('sceneStyleInterpolator: tabSceneKeepPainted');
    // An explicit 'none' short-circuits hasAnimation → parked lanes go
    // display: none and every swipe drags a blank page.
    expect(tabs).not.toContain("animation: 'none'");
    expect(tabs).toContain('detachInactiveScreens={false}');
  });
});

describe('vendor contract the keep-painted trick depends on', () => {
  it('bottom-tabs still enables animation from a bare transitionSpec', () => {
    const view = read(
      'node_modules/expo-router/build/react-navigation/bottom-tabs/views/BottomTabView.js',
    );
    expect(view).toContain("return animation !== 'none';");
    expect(view).toContain('return Boolean(transitionSpec);');
    // Animated activityState (not STATE_INACTIVE) is what keeps parked
    // scenes out of the display: none branch below.
    expect(view).toContain('STATE_INACTIVE');
  });

  it('screens fallback still keys display on activityState', () => {
    const screen = read(
      'node_modules/react-native-screens/src/components/Screen.tsx',
    );
    expect(screen).toContain(
      "display: activityState !== 0 ? 'flex' : 'none'",
    );
  });
});
