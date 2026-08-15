import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { travelTimeOfDay } from '@/features/travel/travel-atmosphere-model';
import { destinationShowsAurora } from '@/features/travel/travel-sky-aurora-destinations';
import { auroraVeilOpacity } from '@/features/travel/travel-sky-aurora';

function source(name: string): string {
  return readFileSync(join(process.cwd(), 'src/features/travel', name), 'utf8');
}

describe('itinerary sky luminance', () => {
  it('holds aurora veil at one night brightness (muted vs clear)', () => {
    expect(auroraVeilOpacity()).toBe(0.55);
    expect(auroraVeilOpacity(false)).toBe(0.55);
    expect(auroraVeilOpacity(true)).toBe(0.28);
    expect(auroraVeilOpacity(true)).toBeLessThan(auroraVeilOpacity(false));
  });

  it('does not loop plate brightness on aurora, day layers, sun, or moon', () => {
    const aurora = source('travel-sky-aurora.tsx');
    const motion = source('travel-sky-motion-layer.tsx');
    const dayFx = source('travel-sky-day-fx.tsx');
    const moon = source('travel-phase-moon.tsx');

    expect(aurora).toContain('auroraVeilOpacity');
    expect(aurora).toContain('opacity: veil');
    expect(aurora).not.toContain('const pulse');
    expect(aurora).not.toMatch(/interpolate\(pulse/);
    expect(aurora).not.toContain('duration: 3200');
    expect(aurora).not.toContain('duration: 3800');

    expect(motion).not.toContain("'breathe'");
    expect(motion).not.toContain('duration: 2200');
    expect(motion).not.toContain('duration: 2400');

    const daySun = dayFx.slice(
      dayFx.indexOf('export function DaySun'),
      dayFx.indexOf('export function HeatShimmer'),
    );
    expect(daySun).not.toContain('withRepeat');
    expect(daySun).not.toContain('duration: 2400');
    expect(daySun).not.toContain('duration: 2600');

    expect(moon).not.toContain('withRepeat');
    expect(moon).not.toContain('duration: 2800');
    expect(moon).not.toContain('duration: 3000');
  });

  it('still picks dawn / day / dusk / night from the destination clock', () => {
    const at = (hour: number) =>
      travelTimeOfDay(new Date(Date.UTC(2026, 7, 15, hour, 0, 0)), 'UTC');
    expect(at(5)).toBe('dawn');
    expect(at(8)).toBe('dawn');
    expect(at(9)).toBe('day');
    expect(at(16)).toBe('day');
    expect(at(17)).toBe('dusk');
    expect(at(20)).toBe('dusk');
    expect(at(21)).toBe('night');
    expect(at(2)).toBe('night');
  });

  it('still paints aurora for Iceland night headers', () => {
    expect(destinationShowsAurora('Reykjavík, Iceland')).toBe(true);
    expect(destinationShowsAurora('Lisbon, Portugal')).toBe(false);
  });
});
