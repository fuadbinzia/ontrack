import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');

describe('hub route warm-up', () => {
  it('warms likely next screens after each hub settles', () => {
    for (const relative of [
      'src/features/overview/overview-screen.tsx',
      'src/features/todos/todo-lists-overview.tsx',
      'src/features/finance/finance-screen.tsx',
      'src/app/(tabs)/food/index.tsx',
      'src/features/vision-board/vision-board-dashboard.tsx',
      'src/app/(tabs)/plants/index.tsx',
      'src/app/(tabs)/vehicles/index.tsx',
      'src/features/health/health-screen.tsx',
      'src/features/journal/journal-hub.tsx',
      'src/app/(tabs)/calendar.tsx',
    ]) {
      expect(read(relative)).toContain('useWarmHrefs');
    }
  });

  it('does not prefetch the event sheet from an off-screen Calendar tab', () => {
    expect(read('src/app/(tabs)/calendar.tsx')).toContain(
      "useWarmHrefs(isFocused ? ['/activity-form'] : [])",
    );
  });

  it('defers focus-time work so landing frames stay free', () => {
    expect(read('src/features/health/health-screen.tsx')).toContain(
      'deferAfterPageTransition(() => { void refreshHealth(); })',
    );
    expect(read('src/features/finance/use-finance-coach.ts')).toContain(
      'deferAfterPageTransition',
    );
    expect(read('src/features/travel/travel-home-hero-carousel.tsx')).toContain(
      'deferAfterPageTransition',
    );
    expect(read('src/app/(tabs)/plants/index.tsx')).toContain(
      'deferAfterPageTransition',
    );
  });
});
