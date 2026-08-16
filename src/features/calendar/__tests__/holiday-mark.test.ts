import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { starPath } from '@/features/calendar/holiday-mark';

const markSource = readFileSync(
  join(process.cwd(), 'src/features/calendar/holiday-mark.tsx'),
  'utf8',
);

describe('holiday marks look like the observance', () => {
  it('draws Christmas as a star on stacked tiers with a stand', () => {
    expect(markSource).toContain("case 'christmas-tree'");
    expect(markSource).toContain('starPath(12, 3.15, 5, 2.2, 0.88)');
    expect(markSource).toContain('M12 6.2 L16.35 11.15');
    expect(markSource).toContain('M8.85 19.05 H15.15 V20.55');
    expect(markSource).not.toContain('tree.fill');
    expect(markSource).not.toContain("'park'");
    expect(markSource).toContain('iconSizes.lg');
    expect(markSource).not.toContain('iconSizes.sm');
  });

  it('uses the SF fireworks glyph for Independence Day, not a sunburst', () => {
    expect(markSource).toContain('name="fireworks"');
    expect(markSource).toContain("mark === 'fireworks'");
    expect(markSource).not.toContain('strokeWidth={1.7}');
  });

  it('builds a pointed star instead of a rounded canopy', () => {
    const path = starPath(12, 3.15, 5, 2.2, 0.88);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(path).toContain('12.00 0.95');
    expect((path.match(/L/g) ?? []).length).toBe(9);
  });
});
