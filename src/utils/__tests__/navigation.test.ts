import type { ImperativeRouter } from 'expo-router';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { goBackOrReplace } from '@/utils/navigation';

function routerWith() {
  return {
    router: {
      canDismiss: jest.fn(() => false),
      dismiss: jest.fn(),
      dismissTo: jest.fn(),
      canGoBack: jest.fn(() => false),
      back: jest.fn(),
      replace: jest.fn(),
    } as unknown as ImperativeRouter,
  };
}

describe('goBackOrReplace', () => {
  it('dismisses only the top sheet when another route is underneath it', () => {
    const { router } = routerWith();
    jest.mocked(router.canDismiss).mockReturnValue(true);

    goBackOrReplace(router, '/(tabs)/calendar');

    expect(router.dismiss).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('dismisses to the fallback when a direct route has no sheet underneath it', () => {
    const { router } = routerWith();

    goBackOrReplace(router, '/(tabs)/calendar');

    expect(router.dismissTo).toHaveBeenCalledWith('/(tabs)/calendar');
    expect(router.dismiss).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('feature route ownership', () => {
  it('makes Today the tab navigator landing destination', () => {
    const tabsLayout = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/_layout.tsx'),
      'utf8',
    );

    expect(tabsLayout).toContain('initialRouteName="(today)"');
  });

  it.each(['profile', 'workouts', 'plants', 'travel', 'vision-board', 'games', 'vehicles'])(
    'keeps /%s in the tab carousel without a duplicate root route',
    (feature) => {
      const appDirectory = join(process.cwd(), 'src/app');

      const rootRoute =
        feature === 'vision-board'
          ? join(appDirectory, feature, 'index.tsx')
          : join(appDirectory, `${feature}.tsx`);
      expect(existsSync(rootRoute)).toBe(false);
      const tabFlat = join(appDirectory, '(tabs)', `${feature}.tsx`);
      const tabNested = join(appDirectory, '(tabs)', feature, 'index.tsx');
      expect(existsSync(tabFlat) || existsSync(tabNested)).toBe(true);
    },
  );

  it('keeps More as the Trackers tab (not the legacy more.tsx route)', () => {
    expect(
      existsSync(join(process.cwd(), 'src/app', '(tabs)', 'more.tsx')),
    ).toBe(false);
    expect(
      existsSync(join(process.cwd(), 'src/app', '(tabs)', 'trackers.tsx')),
    ).toBe(true);
  });

  it('keeps day selection in the tab navigator instead of a root-stack route', () => {
    const appDirectory = join(process.cwd(), 'src/app');
    const calendarRoute = readFileSync(
      join(appDirectory, '(tabs)', 'calendar.tsx'),
      'utf8',
    );
    const tabsLayout = readFileSync(
      join(appDirectory, '(tabs)', '_layout.tsx'),
      'utf8',
    );

    expect(existsSync(join(appDirectory, 'day', '[date].tsx'))).toBe(false);
    expect(calendarRoute).toContain("router.navigate('/')");
    expect(calendarRoute).not.toContain("router.push({ pathname: '/day/[date]'");
    expect(tabsLayout).toContain(
      "listeners={{ tabPress: () => setSelectedDate(todayKey()) }}",
    );
  });
});

describe('root stack back button', () => {
  it('hides the iOS 26 Liquid Glass background around the custom back control', () => {
    const rootLayout = readFileSync(
      join(process.cwd(), 'src/app', '_layout.tsx'),
      'utf8',
    );

    expect(rootLayout).toContain("type: 'custom' as const");
    expect(rootLayout).toContain('hidesSharedBackground: true');
  });

  it('disables iOS edge-swipe GO_BACK on the tab root', () => {
    const rootLayout = readFileSync(
      join(process.cwd(), 'src/app', '_layout.tsx'),
      'utf8',
    );

    expect(rootLayout).toMatch(
      /name="\(tabs\)"[\s\S]*?gestureEnabled:\s*false/,
    );
  });

  it('consumes Android hardware back on empty tab root to avoid POP LogBox', () => {
    const tabsLayout = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/_layout.tsx'),
      'utf8',
    );
    expect(tabsLayout).toContain('BackHandler');
    expect(tabsLayout).toContain('hardwareBackPress');
    expect(tabsLayout).toContain('canDismiss()');
    expect(tabsLayout).toContain('canGoBack()');
  });

  it('guards stack dismissal and preserves a safe fallback', () => {
    const navigation = readFileSync(
      join(process.cwd(), 'src/utils/navigation.ts'),
      'utf8',
    );
    const body = navigation.replace(/\/\*\*[\s\S]*?\*\//, '');
    expect(body).toContain('if (router.canDismiss())');
    expect(body).toContain('router.dismiss()');
    expect(body).toContain('dismissTo(fallback)');
    expect(body).not.toContain('router.back()');
    expect(body).not.toContain('router.replace(');
  });
});

const NESTED_STACK_LAYOUTS = [
  'src/app/(tabs)/(today)/_layout.tsx',
  'src/app/(tabs)/to-do/_layout.tsx',
  'src/app/(tabs)/travel/_layout.tsx',
  'src/app/(tabs)/profile/_layout.tsx',
  'src/app/(tabs)/plants/_layout.tsx',
  'src/app/(tabs)/food/_layout.tsx',
  'src/app/(tabs)/vision-board/_layout.tsx',
  'src/app/(tabs)/vehicles/_layout.tsx',
  'src/app/(tabs)/finance/_layout.tsx',
  'src/app/(tabs)/health/_layout.tsx',
  'src/app/(tabs)/journal/_layout.tsx',
] as const;

describe('full-screen swipe-back stacks', () => {
  it('enables iOS full-screen pop via simple_push so iOS 26 does not use Apple content-pop', () => {
    const appStack = readFileSync(
      join(process.cwd(), 'src/components/navigation/app-stack.tsx'),
      'utf8',
    );
    expect(appStack).toContain('fullScreenGestureEnabled: true');
    expect(appStack).toContain('animationMatchesGesture: true');
    expect(appStack).toContain("IOS_SWIPE_BACK_ANIMATION = 'simple_push'");
    expect(appStack).toContain("ANDROID_SWIPE_BACK_ANIMATION = 'ios_from_right'");
    expect(appStack).toContain('composeSwipeBackScreenLayout');
  });

  it('pops Android swipe-back through goBackOrReplace', () => {
    const scene = readFileSync(
      join(process.cwd(), 'src/components/navigation/swipe-back-scene.tsx'),
      'utf8',
    );
    expect(scene).toContain('goBackOrReplace');
    expect(scene).not.toContain('router.back(');
  });

  it.each(NESTED_STACK_LAYOUTS)('uses AppStack in %s', (file) => {
    const layout = readFileSync(join(process.cwd(), file), 'utf8');
    expect(layout).toContain('AppStack');
    expect(layout).not.toContain('fade_from_bottom');
  });

  it('keeps the vision-board canvas and travel map off the swipe-back gesture', () => {
    const vision = readFileSync(
      join(process.cwd(), 'src/app/(tabs)/vision-board/_layout.tsx'),
      'utf8',
    );
    const root = readFileSync(join(process.cwd(), 'src/app/_layout.tsx'), 'utf8');
    expect(vision).toMatch(/name="\[id\]"[\s\S]*?gestureEnabled:\s*false/);
    expect(root).toMatch(/name="travel-map"[\s\S]*?gestureEnabled:\s*false/);
  });
});
