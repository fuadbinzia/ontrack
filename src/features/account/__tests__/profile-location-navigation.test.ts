import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Today weather profile navigation', () => {
  const dayHeader = readFileSync(
    join(process.cwd(), 'src/features/daily-tracking/day-header.tsx'),
    'utf8',
  );
  const profile = readFileSync(
    join(process.cwd(), 'src/app/(tabs)/profile/index.tsx'),
    'utf8',
  );

  it('routes both weather cards to their location preference', () => {
    expect(dayHeader).toContain('reveal=homeLocation');
    expect(dayHeader).toContain('reveal=currentLocation');
  });

  it('waits for the Preferences section layout before consuming the link', () => {
    expect(profile).toContain('setLocationSectionY(event.nativeEvent.layout.y)');
    expect(profile).toContain('if (locationSectionY === undefined) return');
    expect(profile).toContain('deferAfterPageLoad');
    expect(profile).toContain('locationSectionY - REVEAL_EDGE_PAD');
    expect(profile.indexOf('scrollRef.current?.scrollTo')).toBeLessThan(
      profile.indexOf('router.setParams'),
    );
  });
});
