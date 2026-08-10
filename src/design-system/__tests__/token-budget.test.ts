// Token budget: enforce <700 LOC and no hard-coded `Npx` in app source.
// Grade bar: empty large-file whitelist — split instead of allowing debt.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..'); // project root

function* walk(dir: string): IterableIterator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (['node_modules', '.git', 'android', 'ios', '.expo', 'dist', 'build'].includes(entry.name)) {
      continue;
    }
    if (entry.isDirectory()) {
      yield* walk(res);
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/i.test(entry.name)) {
      yield res;
    }
  }
}

describe('Token budget enforcement', () => {
  const files = Array.from(walk(ROOT)).filter((f) => !f.includes('.expo'));

  // CSS/box-shadow strings and intentional reference-canvas docs may use `Npx`.
  // Prefer scaled tokens (`s()`, layout) for layout chrome — do not grow this list casually.
  const pixelWhitelist = [
    '/src/components/navigation/bottom-nav-bar.tsx',
    '/src/components/primitives/app-prompt.tsx',
    '/src/components/primitives/glass-switch.tsx',
    '/src/design-system/__tests__/token-budget.test.ts',
    '/src/design-system/glass.ts',
    '/src/design-system/shadows.ts',
    '/src/features/auth/auth-screen.tsx',
    '/src/features/todos/empty-checklists.tsx',
    '/src/features/todos/todo-list-header.tsx',
    '/src/features/travel/__tests__/destination-cover.test.ts',
    '/src/features/travel/__tests__/travel-home-atmosphere.test.ts',
    '/src/features/travel/flights/flight-search-screen.tsx',
    '/src/features/travel/stays/stay-provider-screen.tsx',
    '/src/features/travel/travel-chat-chrome.tsx',
    '/src/features/travel/travel-chat-screen.tsx',
    '/src/features/travel/travel-collapsible-section.tsx',
    '/src/features/travel/travel-currency-sheet.tsx',
    '/src/features/travel/travel-home-atmosphere-ink.ts',
    '/src/features/travel/travel-home-tokens.ts',
    '/src/features/travel/travel-itinerary-sheet-fields.tsx',
    '/src/features/travel/travel-list-actions.tsx',
    '/src/features/travel/travel-sheet.tsx',
    '/src/features/travel/travel-surface.tsx',
    '/src/features/travel/travel-timeline-add-modal.tsx',
    '/src/features/travel/travel-timeline-node.tsx',
    '/src/features/travel/travel-trip-dates-row.tsx',
    '/src/features/travel/travel-trip-notes-card.tsx',
    '/src/features/travel/weather/travel-weather-card.tsx',
    '/src/features/travel/weather/travel-weather-sheet.tsx',
    '/src/features/vision-board/consolidated-card.tsx',
    '/src/features/vision-board/vision-board-canvas-item.tsx',
    '/src/features/vision-board/vision-board-category-screen.tsx',
    '/src/features/vision-board/vision-board-consolidated.tsx',
    '/src/features/vision-board/vision-board-dashboard.tsx',
    '/src/features/vision-board/vision-board-dashboard-hero.tsx',
    '/src/features/vision-board/vision-board-gallery.tsx',
    '/src/features/workouts/exercise-anatomy-demo.tsx',
    '/src/features/workouts/muscle-explorer.tsx',
    '/src/features/workouts/muscle-focus-exercises.tsx',
    '/src/features/workouts/muscle-summary-panel.tsx',
    '/src/features/workouts/workouts-screen-header.tsx',
    '/src/utils/__tests__/bottom-nav-bar-rule.test.ts',
    '/src/utils/agent-ui/AgentUiOverlayToggle.tsx',
    '/src/utils/dev-theme-toggle/ThemeToggleFab.tsx',
  ];

  test('no source file exceeds 700 lines', () => {
    const offenders = files
      .filter((f) => fs.readFileSync(f, 'utf8').split('\n').length > 700)
      .map((f) => path.relative(ROOT, f))
      .sort();
    expect(offenders).toEqual([]);
  });

  test('no hard-coded pixel values (e.g., 12px) in source files', () => {
    const pixelRegex = /\d+px/;
    const offenders: string[] = [];
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      if (pixelRegex.test(content) && !pixelWhitelist.some((w) => f.endsWith(w))) {
        offenders.push(path.relative(ROOT, f));
      }
    }
    expect(offenders.sort()).toEqual([]);
  });
});
