import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function listTsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...listTsx(path));
    else if (name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

describe('Food stack back navigation', () => {
  it('uses FoodHeaderBackButton (dismisses to Food home) on stack screens', () => {
    const foodRoutes = join(process.cwd(), 'src/app/(tabs)/food');
    const sources = listTsx(foodRoutes).map((path) => ({
      path,
      source: readFileSync(path, 'utf8'),
    }));

    const withBack = sources.filter(
      ({ source }) =>
        source.includes('FoodHeaderBackButton') ||
        /HeaderBackButton/.test(source),
    );

    expect(withBack.length).toBeGreaterThan(0);
    for (const { path, source } of withBack) {
      // Bare HeaderBackButton defaults fallback to `/` — broken inside the food tab stack.
      expect(`${path}\n${source}`).not.toMatch(
        /leading=\{<\s*HeaderBackButton\b/,
      );
      if (source.includes('leading=')) {
        expect(source).toContain('FoodHeaderBackButton');
      }
    }

    const helper = readFileSync(
      join(process.cwd(), 'src/features/food/food-header-back-button.tsx'),
      'utf8',
    );
    expect(helper).toContain("fallback = '/(tabs)/food'");
  });
});
