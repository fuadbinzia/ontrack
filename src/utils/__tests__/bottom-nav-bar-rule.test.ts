import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('bottom nav bar background invariant', () => {
  it('keeps the navigator chrome transparent behind the bottom nav', () => {
    const tabsLayout = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/_layout.tsx'),
      'utf8',
    );

    expect(tabsLayout).toContain("backgroundColor: 'transparent'");
    expect(tabsLayout).toContain('BOTTOM_NAV_Z_INDEX');
    expect(tabsLayout).toMatch(/zIndex:\s*BOTTOM_NAV_Z_INDEX/);
    expect(tabsLayout).toMatch(/elevation:\s*BOTTOM_NAV_Z_INDEX/);
    expect(tabsLayout).toContain('BottomNavBarBridge');
    expect(tabsLayout).toContain('BottomNavDockHost');
    expect(tabsLayout).toMatch(/shadowOpacity:\s*0/);
    expect(tabsLayout).toMatch(/shadowColor:\s*'transparent'/);
    expect(tabsLayout).toMatch(/tabBarBackground:\s*\(\)\s*=>\s*null/);
  });

  it('stacks the dock above pager scenes so Today cannot cover the nav bar', () => {
    const navBar = readFileSync(
      join(process.cwd(), 'src/components/navigation/bottom-nav-bar.tsx'),
      'utf8',
    );
    const scene = readFileSync(
      join(process.cwd(), 'src/components/navigation/swipe-back-scene.tsx'),
      'utf8',
    );

    expect(navBar).toContain('BOTTOM_NAV_Z_INDEX');
    expect(navBar).toMatch(/zIndex:\s*BOTTOM_NAV_Z_INDEX/);
    expect(navBar).toMatch(/elevation:\s*BOTTOM_NAV_Z_INDEX/);
    expect(navBar).toContain('opacity: modalSheetOpen ? 0 : 1');
    expect(scene).toContain('tabSwipeTranslateX(');
    expect(scene).toContain('tabSwipeLanes.value');
  });

  it('suspends inactive tabs so hidden sections do not consume battery', () => {
    const tabsLayout = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/_layout.tsx'),
      'utf8',
    );

    expect(tabsLayout).toContain('detachInactiveScreens');
    expect(tabsLayout).not.toContain('eagerBottomNavRouteNames');
    expect(tabsLayout).toContain('lazy: true');
    expect(tabsLayout).toContain('detachInactiveScreens={false}');
    // Zero-duration spec keeps the navigator's tab animation inert (no per-
    // switch animation work) while parked lanes stay painted for the pager.
    expect(tabsLayout).toContain('transitionSpec: TAB_SCENE_KEEP_PAINTED_SPEC');
    expect(tabsLayout).toContain('sceneStyleInterpolator: tabSceneKeepPainted');
    expect(tabsLayout).not.toContain("animation: 'none'");
    expect(tabsLayout).toContain('freezeOnBlur: route.name !== MORE_TAB_ROUTE');
    expect(tabsLayout).not.toContain('name="profile" options={{ lazy: false }}');
    expect(tabsLayout).not.toContain('preload(');

    const navBar = readFileSync(
      join(process.cwd(), 'src/components/navigation/bottom-nav-bar.tsx'),
      'utf8',
    );
    expect(navBar).not.toContain('navigation.preload');
    expect(navBar).toContain('startTabOpen');
    expect(navBar).toContain('tabTapSide');
  });

  it('frosts the dock over page atmosphere and clears Android system nav', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/navigation/bottom-nav-bar.tsx'),
      'utf8',
    );
    const inset = readFileSync(
      join(process.cwd(), 'src/components/navigation/bottom-nav-inset.ts'),
      'utf8',
    );

    expect(source).toContain('usePageSurfaceBackgroundColor');
    expect(source).toContain('barBackground');
    expect(source).toContain('glassMaterials.nav');
    expect(source).toContain('bottomNavBottomPad');
    expect(source).toContain('<BlurView');
    expect(source).toMatch(/barBackground[\s\S]*'transparent'/);
    expect(inset).toContain("platform === 'android' && insetsBottom > 0");
    // Cool frosted bar tint must not return — it seams against warm page fills.
    expect(source).not.toMatch(/rgba\(8,\s*12,\s*22/);
  });

  it('does not leave a Screen bottom-inset plate on checklist detail', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/todos/todo-list-screen.tsx'),
      'utf8',
    );

    expect(source).toMatch(
      /<Screen[\s\S]*?bottomInset=\{false\}[\s\S]*?contentStyle=\{styles\.screenContent\}/,
    );
  });

  it('nests full-page feature stacks under tabs so the dock persists', () => {
    const rootLayout = readFileSync(
      join(process.cwd(), 'src/app/_layout.tsx'),
      'utf8',
    );
    const travelLayout = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/travel/_layout.tsx'),
      'utf8',
    );
    const todayLayout = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/(today)/_layout.tsx'),
      'utf8',
    );
    const profileLayout = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/profile/_layout.tsx'),
      'utf8',
    );

    expect(travelLayout).toContain("anchor: 'index'");
    expect(todayLayout).toContain("anchor: 'index'");
    expect(profileLayout).toContain("anchor: 'index'");
    // Full pages live under (tabs); root keeps sheets/modals + legacy redirects.
    expect(rootLayout).not.toMatch(/name="travel"/);
    expect(rootLayout).not.toContain('name="plants/');
    expect(rootLayout).not.toContain('name="vehicles/');
    expect(rootLayout).not.toContain('name="detail/food/');
    expect(rootLayout).toContain("presentation: 'modal'");
    expect(rootLayout).toContain('detail/gym-active/[id]');
  });
});
