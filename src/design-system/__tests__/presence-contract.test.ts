import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');

describe('shared presence contract', () => {
  it('routes hub lists through Presence or listEntering', () => {
    expect(read('src/components/primitives/presence.tsx')).toContain(
      'useSettledListLayout',
    );
    expect(read('src/features/overview/overview-screen.tsx')).toContain(
      'enter={false}',
    );
    expect(read('src/features/todos/todo-lists-overview.tsx')).toContain(
      '<View style={styles.listItem}>',
    );
    expect(read('src/features/todos/todo-lists-overview.tsx')).not.toContain(
      '<Presence',
    );
    expect(read('src/features/todos/todo-list-screen.tsx')).toContain(
      'useListEnterIds',
    );
    expect(read('src/features/todos/todo-list-screen.tsx')).toContain(
      'useSettledListLayout',
    );
    expect(read('src/features/todos/todo-list-screen.tsx')).toContain('listEntering');
    expect(read('src/features/todos/todo-list-screen.tsx')).toContain('listExiting');
    expect(read('src/features/travel/travel-timeline-node.tsx')).toContain(
      'useSettledListLayout',
    );
    expect(read('src/components/shared/activity-card.tsx')).toContain(
      'enter ? listEntering(index)',
    );
    expect(read('src/features/travel/travel-home-trip-card.tsx')).toContain(
      'listEntering',
    );
  });

  it('keeps remounting hubs from replaying page-open entrance', () => {
    for (const relative of [
      'src/features/overview/overview-screen.tsx',
      'src/features/travel/travel-home-your-trips.tsx',
      'src/features/travel/travel-home-empty.tsx',
      'src/features/journal/journal-landing-empty.tsx',
      'src/features/journal/journal-landing-pages.tsx',
      'src/features/daily-tracking/day-view.tsx',
      'src/features/todos/todo-list-screen.tsx',
      'src/features/account/profile-identity-hero.tsx',
      'src/app/(tabs)/profile/index.tsx',
      'src/features/trackers/trackers-screen.tsx',
      'src/features/workouts/muscle-summary-panel.tsx',
      'src/features/workouts/workout-session-builder.tsx',
    ]) {
      const source = read(relative);
      expect(source).not.toContain('entranceKey');
      expect(source).not.toContain('focusEntranceStyle');
    }
  });

  it('keeps workouts page chrome at rest and toasts on shared fade presets', () => {
    expect(read('src/features/workouts/muscle-summary-panel.tsx')).not.toContain(
      'FadeInDown',
    );
    expect(read('src/features/workouts/workout-session-builder.tsx')).not.toContain(
      'FadeInUp',
    );
    expect(read('src/features/workouts/workout-today-plan.tsx')).toContain(
      'fadeEntering()',
    );
    expect(read('src/features/workouts/workout-calendar.tsx')).toContain(
      'fadeEntering()',
    );
  });

  it('routes popovers through the shared enter/exit presets', () => {
    for (const relative of [
      'src/components/primitives/dropdown.tsx',
      'src/features/todos/checklist-popover-menu.tsx',
      'src/features/account/city-autofind-suggestion-menu.tsx',
      'src/features/travel/address-autofind-field.tsx',
    ]) {
      const source = read(relative);
      expect(source).toContain('popoverEntering');
      expect(source).toContain('popoverExiting');
    }
  });
});
