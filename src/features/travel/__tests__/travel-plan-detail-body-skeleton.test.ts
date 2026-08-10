import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('travel plan detail body skeleton', () => {
  const body = readFileSync(
    join(process.cwd(), 'src/features/travel/travel-plan-detail-body.tsx'),
    'utf8',
  );
  const skeleton = readFileSync(
    join(
      process.cwd(),
      'src/features/travel/travel-plan-detail-body-skeleton.tsx',
    ),
    'utf8',
  );
  const timeline = readFileSync(
    join(process.cwd(), 'src/features/travel/travel-itinerary-timeline.tsx'),
    'utf8',
  );

  it('shows glass skeleton shells while bodyReady is false (not a blank gap)', () => {
    expect(body).toContain('TravelPlanDetailBodySkeleton');
    expect(body).toMatch(/bodyReady\s*\?[\s\S]*TravelPlanDetailBodySkeleton/);
    expect(body).not.toMatch(/bodyReady\s*\?[\s\S]*:\s*null/);
  });

  it('keeps skeleton chrome on glass mist / shell plates', () => {
    expect(skeleton).toContain('TravelHomeGlass');
    expect(skeleton).toContain('useTravelItineraryMistProps');
    expect(skeleton).toContain('useTravelItineraryShellProps');
    expect(skeleton).toContain('bodyLoading');
    expect(skeleton).not.toContain('backgroundElevated');
    expect(skeleton).not.toContain('surface="solid"');
  });

  it('progressively mounts timeline days with day skeletons for the rest', () => {
    expect(timeline).toContain('TIMELINE_DAY_BATCH');
    expect(timeline).toContain('TravelTimelineDaySkeleton');
    expect(timeline).toContain('mountedDayCount');
    expect(timeline).toContain('visibleDays');
  });
});
