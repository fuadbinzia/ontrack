import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');

describe('collapsible motion contract', () => {
  it('exports shared disclosure primitives and motion settles', () => {
    expect(read('src/components/primitives/index.ts')).toContain('CollapsibleBody');
    expect(read('src/components/primitives/index.ts')).toContain('DisclosureChevron');
    expect(read('src/design-system/motion.ts')).toContain('disclosure');
    expect(read('src/design-system/motion.ts')).toContain('page');
    expect(read('src/design-system/index.ts')).toContain('motion');
  });

  it('routes shared section collapses through CollapsibleBody', () => {
    for (const relative of [
      'src/components/primitives/collapsible-section.tsx',
      'src/features/travel/travel-collapsible-section.tsx',
      'src/features/travel/travel-trip-notes-card.tsx',
      'src/features/todos/grocery-rows.tsx',
    ]) {
      const source = read(relative);
      expect(source).toContain('CollapsibleBody');
      expect(source).toContain('DisclosureChevron');
    }
  });

  it('keeps initially-expanded bodies in normal flow and never returns null', () => {
    const source = read('src/components/primitives/collapsible-body.tsx');
    expect(source).toContain('motionEnabled');
    expect(source).toContain('keepMounted');
    expect(source).toContain('collapsedShell');
    expect(source).not.toContain('return null');
    expect(source).not.toContain('height: undefined');
  });

  it('keeps itinerary body sections eager; detail gates heavy tree after push', () => {
    const body = read('src/features/travel/travel-plan-detail-body.tsx');
    const detail = read('src/features/travel/travel-plan-detail.tsx');
    expect(body).toContain('TravelTransportSections');
    expect(body).toContain('TravelItineraryTimeline');
    expect(body).not.toContain('belowFoldReady');
    expect(body).not.toContain('deferUntilIdle');
    // One tree + bodyReady — never Entrance→Loaded (Fabric AppContext remount).
    expect(detail).not.toContain('TravelPlanDetailEntrance');
    expect(detail).toContain('bodyReady');
    expect(detail).toContain('deferAfterPageTransition');
    expect(body).toContain('bodyReady');
  });

  it('keeps stack page transitions on a shared settle duration', () => {
    const appStack = read('src/components/navigation/app-stack.tsx');
    expect(appStack).toContain('motion.page');
    expect(appStack).toContain('animationDuration');
    for (const relative of [
      'src/app/_layout.tsx',
      'src/app/(tabs)/travel/_layout.tsx',
      'src/app/(tabs)/plants/_layout.tsx',
      'src/app/(tabs)/vehicles/_layout.tsx',
      'src/app/(tabs)/health/_layout.tsx',
      'src/app/(tabs)/to-do/_layout.tsx',
      'src/app/(tabs)/vision-board/_layout.tsx',
    ]) {
      expect(read(relative)).toContain('AppStack');
    }
  });
});
