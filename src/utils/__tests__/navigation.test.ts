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
  it('dismisses to the fallback instead of a blind POP / GO_BACK', () => {
    const { router } = routerWith();

    goBackOrReplace(router, '/(tabs)/calendar');

    expect(router.dismissTo).toHaveBeenCalledWith('/(tabs)/calendar');
    expect(router.dismiss).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('feature route ownership', () => {
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

  it('avoids blind stack POP in goBackOrReplace', () => {
    const navigation = readFileSync(
      join(process.cwd(), 'src/utils/navigation.ts'),
      'utf8',
    );
    const body = navigation.replace(/\/\*\*[\s\S]*?\*\//, '');
    expect(body).toContain('dismissTo(fallback)');
    expect(body).not.toMatch(/\.dismiss\(/);
    expect(body).not.toContain('router.back()');
    expect(body).not.toContain('router.replace(');
  });
});
