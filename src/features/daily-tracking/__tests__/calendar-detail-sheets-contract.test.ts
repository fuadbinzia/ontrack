import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

const detailRoutes = [
  'food',
  'gym',
  'movie',
  'plant',
  'sleep',
  'work',
] as const;

describe('calendar event-card bottom sheets', () => {
  it('presents every specialized Today detail route as a transparent modal', () => {
    const layout = read('src/app/(tabs)/(today)/_layout.tsx');

    for (const kind of [...detailRoutes, 'generic']) {
      expect(layout).toContain(`'detail/${kind}/[id]'`);
    }
    expect(layout).toContain("presentation: 'transparentModal'");
    expect(layout).toContain("animation: 'none'");
    expect(layout).toContain('gestureEnabled: false');
  });

  it.each(detailRoutes)('renders the %s calendar detail inside the shared sheet shell', (kind) => {
    const route = read(`src/app/(tabs)/(today)/detail/${kind}/[id].tsx`);

    expect(route).toContain('<CalendarDetailSheet');
    expect(route).toContain(`kind="${kind}"`);
    expect(route).not.toContain('<Screen');
  });

  it('routes plant calendar cards to the calendar sheet while preserving the full Plants page', () => {
    const dayView = read('src/features/daily-tracking/day-view.tsx');
    const detailRoute = read(
      'src/features/daily-tracking/activity-detail-route.ts',
    );
    const plantSheet = read('src/app/(tabs)/(today)/detail/plant/[id].tsx');
    const plantPage = read('src/app/(tabs)/plants/[id].tsx');

    expect(dayView).toContain('activityDetailPath(activity, category)');
    expect(detailRoute).toContain("return activity.plantId ? '/detail/plant/[id]'");
    expect(detailRoute).not.toMatch(
      /case 'plant':[\s\S]*?pathname: '\/plants\/\[id\]'[\s\S]*?break;/,
    );
    expect(plantSheet).toContain('AgentUiIds.plants.calendarSheet.openDetails');
    expect(plantSheet).toContain("pathname: '/plants/[id]'");
    expect(plantPage).toContain('<Screen contentStyle={styles.content}>');
  });

  it('stamps a grabber and backdrop target on every shared calendar sheet', () => {
    const shell = read(
      'src/features/daily-tracking/calendar-detail-sheet.tsx',
    );

    expect(shell).toContain('closeTestID={AgentUiIds.today.detailClose(kind)}');
    expect(shell).toContain(
      'backdropTestID={AgentUiIds.today.detailBackdrop(kind)}',
    );
    expect(shell).toContain('maxHeight={Math.round(windowHeight * 0.9)}');
    expect(shell).toContain('host="route"');
  });

  it('does not nest a native Modal inside the transparent-modal detail route', () => {
    const shell = read(
      'src/features/daily-tracking/calendar-detail-sheet.tsx',
    );
    const generic = read(
      'src/app/(tabs)/(today)/detail/generic/[id].tsx',
    );

    expect(shell).toContain('host="route"');
    expect(generic.match(/host="route"/g)).toHaveLength(2);
  });

  it('aligns the generic event status and edit action as one responsive control rail', () => {
    const generic = read(
      'src/app/(tabs)/(today)/detail/generic/[id].tsx',
    );

    expect(generic).toContain('const { layout, spacing: responsiveSpacing } = useResponsive()');
    expect(generic).toContain('minHeight: layout.minTapTarget');
    expect(generic).toContain('styles.statusSlot');
    expect(generic).toContain('variant="secondary"');
    expect(generic).toContain('size="sm"');
    expect(generic).toContain('shape="pill"');
    expect(generic).not.toContain('style={styles.editButton}');
  });
});
