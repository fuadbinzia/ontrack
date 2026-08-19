import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('startup performance contract', () => {
  it('keeps React Compiler off for the distributed native runtime', () => {
    const appJson = read('app.json');
    expect(appJson).toContain('"reactCompiler": false');
    expect(appJson).not.toContain('"reactCompiler": true');
  });

  it('uses expo-image for the dock-search assistant mark', () => {
    const overlay = read('src/features/search/dock-search-overlay.tsx');
    expect(overlay).toContain("import { Image } from 'expo-image'");
    expect(overlay).toContain('contentFit="cover"');
    expect(overlay).not.toMatch(
      /import \{[^}]*\bImage\b[^}]*\} from 'react-native'/,
    );
  });

  it('does not pull nutrition or collaboration services into the root module graph', () => {
    const layout = read('src/app/_layout.tsx');
    const mealPhoto = read('src/hooks/use-meal-photo-migration.ts');

    expect(layout).not.toContain("from '@/hooks/use-todo-collaboration'");
    expect(layout).not.toContain("from '@/hooks/use-vehicle-collaboration'");
    expect(layout).toContain("import('@/hooks/use-todo-collaboration')");
    expect(layout).toContain("import('@/hooks/use-vehicle-collaboration')");
    expect(layout).toContain('ChecklistCollaborationMount');
    expect(layout).toContain('VehicleCollaborationMount');
    expect(mealPhoto).toContain("import('@/services/nutrition/client')");
    expect(mealPhoto).not.toContain("from '@/services/nutrition'");
  });

  it('keeps the checklist hub on FlatList so every card paints on first layout', () => {
    const overview = read('src/features/todos/todo-lists-overview.tsx');
    expect(overview).toContain('<FlatList');
    expect(overview).toContain('<DraggableFlatList');
    expect(overview).toContain('checklistHubWindowing(lists.length)');
    expect(overview).not.toContain('FlashList');
  });

  it('stabilizes FlashList renderers on plants, vehicles, and travel chat', () => {
    const plants = read('src/app/(tabs)/plants/index.tsx');
    const vehicles = read('src/app/(tabs)/vehicles/index.tsx');
    const chat = read('src/features/travel/travel-chat-screen.tsx');

    expect(plants).toContain('renderItem={renderPlantItem}');
    expect(vehicles).toContain('renderItem={renderVehicleItem}');
    expect(chat).toContain('renderItem={renderChatItem}');
    expect(plants).not.toContain('renderItem={({ item })');
    expect(vehicles).not.toContain('renderItem={({ item })');
    expect(chat).not.toContain('renderItem={({ item })');
  });

  it('imports boot chrome from leaf modules instead of wide barrels', () => {
    const boot = read('src/features/auth/app-boot-loader.tsx');
    const stack = read('src/components/navigation/app-stack.tsx');
    const dock = read('src/components/navigation/bottom-nav-dock.tsx');

    expect(boot).toContain("from '@/components/primitives/app-text'");
    expect(boot).toContain("from '@/design-system/glass'");
    expect(boot).not.toMatch(/from '@\/components\/primitives['"]/);
    expect(boot).not.toMatch(/from '@\/design-system['"]/);
    expect(stack).toContain("from '@/design-system/motion'");
    expect(stack).not.toMatch(/from '@\/design-system['"]/);
    expect(dock).toContain("from '@/design-system/motion'");
    expect(dock).not.toMatch(/from '@\/design-system['"]/);
  });

  it('reuses cached Intl instances on hot format paths', () => {
    expect(read('src/utils/date.ts')).toContain('getIntlLocale(');
    expect(read('src/features/calendar/holidays.ts')).toContain('getIntlLocale(');
    expect(read('src/features/workouts/weight-unit.ts')).toContain(
      'getIntlLocale(',
    );
    expect(read('src/features/travel/translator/travel-translator-language.ts')).toContain(
      'getDisplayNamesFormatter(',
    );
    expect(read('src/features/events/event-discovery-editor.tsx')).toContain(
      'getDateTimeFormatter(',
    );
    expect(read('src/services/calendar/google-mapping.ts')).toContain(
      'getDateTimeFormatter(',
    );
  });
});
