import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'src/components/shared/activity-card.tsx'),
  'utf8',
);

it('uses the all-day-aware timing label for visible and accessible card copy', () => {
  expect(source.match(/activityTimingLabel\(activity\)/g)).toHaveLength(2);
  expect(source).not.toContain('formatMinutes(activity.startMinutes)');
});
