const reanimated = require('react-native-reanimated') as Record<string, unknown>;
const transition = {
  damping: jest.fn(() => transition),
  reduceMotion: jest.fn(() => transition),
};
reanimated.runOnUI = (worklet: (...args: unknown[]) => unknown) => worklet;
reanimated.SharedTransition = { springify: () => transition };

const routeModules = [
  'src/app/(tabs)/(today)/detail/food/[id].tsx',
  'src/app/(tabs)/(today)/detail/generic/[id].tsx',
  'src/app/(tabs)/(today)/detail/gym/[id].tsx',
  'src/app/(tabs)/(today)/detail/movie/[id].tsx',
  'src/app/(tabs)/(today)/detail/sleep/[id].tsx',
  'src/app/(tabs)/(today)/detail/work/[id].tsx',
  'src/app/(tabs)/(today)/index.tsx',
  'src/app/(tabs)/finance/_layout.tsx',
  'src/app/(tabs)/food/_layout.tsx',
  'src/app/(tabs)/food/ai-ideas.tsx',
  'src/app/(tabs)/food/community.tsx',
  'src/app/(tabs)/food/index.tsx',
  'src/app/(tabs)/food/ingredients/[id].tsx',
  'src/app/(tabs)/food/ingredients/index.tsx',
  'src/app/(tabs)/food/plan.tsx',
  'src/app/(tabs)/food/preferences.tsx',
  'src/app/(tabs)/food/recipes/[id].tsx',
  'src/app/(tabs)/food/recipes/index.tsx',
  'src/app/(tabs)/food/scan.tsx',
  'src/app/(tabs)/food/tracker.tsx',
  'src/app/(tabs)/games.tsx',
  'src/app/(tabs)/insights.tsx',
  'src/app/(tabs)/plants/[id].tsx',
  'src/app/(tabs)/plants/[id]/check-in.tsx',
  'src/app/(tabs)/plants/[id]/edit.tsx',
  'src/app/(tabs)/plants/index.tsx',
  'src/app/(tabs)/plants/new.tsx',
  'src/app/(tabs)/profile/agents.tsx',
  'src/app/(tabs)/profile/calendar-sync.tsx',
  'src/app/(tabs)/profile/performance.tsx',
  'src/app/(tabs)/profile/straiaway.tsx',
  'src/app/(tabs)/social.tsx',
  'src/app/(tabs)/to-do/[id].tsx',
  'src/app/(tabs)/to-do/[id]/recipe-import.tsx',
  'src/app/(tabs)/to-do/[id]/settings.tsx',
  'src/app/(tabs)/travel/[id].tsx',
  'src/app/(tabs)/travel/[id]/chat.tsx',
  'src/app/(tabs)/travel/[id]/flights.tsx',
  'src/app/(tabs)/travel/[id]/hub.tsx',
  'src/app/(tabs)/travel/[id]/stays.tsx',
  'src/app/(tabs)/vehicles/[id].tsx',
  'src/app/(tabs)/vehicles/[id]/settings.tsx',
  'src/app/(tabs)/vehicles/index.tsx',
  'src/app/(tabs)/vehicles/new.tsx',
  'src/app/(tabs)/vision-board/[id].tsx',
  'src/app/(tabs)/vision-board/all.tsx',
  'src/app/(tabs)/vision-board/categories.tsx',
  'src/app/(tabs)/vision-board/index.tsx',
  'src/app/(tabs)/workouts.tsx',
  'src/app/agent/ui.tsx',
  'src/app/agents.tsx',
  'src/app/api-usage.tsx',
  'src/app/auth/callback.tsx',
  'src/app/c/[code].tsx',
  'src/app/design-system.tsx',
  'src/app/detail/gym-active/[id].tsx',
  'src/app/developer.tsx',
  'src/app/f/[code].tsx',
  'src/app/games/balloon-pop.tsx',
  'src/app/i/[code].tsx',
  'src/app/integrations.tsx',
  'src/app/invite/travel.tsx',
  'src/app/j/[code].tsx',
  'src/app/l/[code].tsx',
  'src/app/nutrition-profile.tsx',
  'src/app/onboarding.tsx',
  'src/app/privacy.tsx',
  'src/app/share-event.tsx',
  'src/app/share-import.tsx',
  'src/app/terms.tsx',
  'src/app/todos/[id].tsx',
  'src/app/todos/[id]/recipe-import.tsx',
  'src/app/todos/[id]/settings.tsx',
  'src/app/travel-map.tsx',
  'src/app/v/[code].tsx',
  'src/app/vision-board/category-editor.tsx',
  'src/app/vision-board/item-editor.tsx',
] as const;

const apiModules = [
  'src/app/api/calendar/google/connect+api.ts',
  'src/app/api/calendar/google/direction+api.ts',
  'src/app/api/calendar/google/disconnect+api.ts',
  'src/app/api/calendar/google/status+api.ts',
  'src/app/api/destination-cover+api.ts',
  'src/app/api/movies/[id]+api.ts',
  'src/app/api/movies/search+api.ts',
  'src/app/api/partner/straiaway/callback+api.ts',
  'src/app/api/partner/straiaway/connect+api.ts',
  'src/app/api/partner/straiaway/disconnect+api.ts',
  'src/app/api/partner/straiaway/exchange+api.ts',
  'src/app/api/partner/straiaway/status+api.ts',
  'src/app/api/partner/straiaway/stays+api.ts',
  'src/app/api/stay-brand+api.ts',
  'src/app/api/usage+api.ts',
  'src/app/api/vehicles/parts/search+api.ts',
  'src/app/api/vehicles/vin-decode+api.ts',
  'src/app/food/ingredient-scan+api.ts',
  'src/app/food/recipe-ideas+api.ts',
  'src/app/health/action-suggestions+api.ts',
  'src/app/meal-analysis/confirm+api.ts',
  'src/app/meal-analysis/link+api.ts',
  'src/app/meal-analysis/photo+api.ts',
  'src/app/meal-images/enhance+api.ts',
  'src/app/meal-links/resolve+api.ts',
  'src/app/nutrition-insights+api.ts',
  'src/app/nutrition-profile+api.ts',
  'src/app/nutrition-targets/[id]/approve+api.ts',
  'src/app/nutrition-targets/calculate+api.ts',
  'src/app/plant-analysis/care+api.ts',
  'src/app/plant-analysis/check-in+api.ts',
  'src/app/plant-analysis/identify+api.ts',
  'src/app/plant-analysis/search+api.ts',
  'src/app/recipe-imports/analyze+api.ts',
  'src/app/travel-confirmations/parse+api.ts',
  'src/app/travel/flights/search+api.ts',
  'src/app/travel/flights/status+api.ts',
] as const;

describe('Expo Router module smoke coverage', () => {
  it.each(routeModules)('%s loads and exposes a route component', (relative) => {
    const loaded = require(`../../../${relative}`) as Record<string, unknown>;
    expect(typeof loaded.default).toBe('function');
  });

  it.each(apiModules)('%s loads and exposes an HTTP handler', (relative) => {
    const loaded = require(`../../../${relative}`) as Record<string, unknown>;
    expect(['GET', 'POST', 'OPTIONS'].some((method) => typeof loaded[method] === 'function')).toBe(true);
  });

  it('src/app/+native-intent.ts loads and exposes the system-path redirect hook', () => {
    const loaded = require('../../../src/app/+native-intent.ts') as Record<string, unknown>;
    expect(typeof loaded.redirectSystemPath).toBe('function');
  });
});
