import { activityDetailPath } from '@/features/daily-tracking/activity-detail-route';
import type { ActivityCategory } from '@/types/models';

const category = (detailKind: ActivityCategory['detailKind']) => ({ detailKind });

describe('activityDetailPath', () => {
  it.each([
    ['food', '/detail/food/[id]'],
    ['gym', '/detail/gym/[id]'],
    ['work', '/detail/work/[id]'],
    ['movie', '/detail/movie/[id]'],
    ['sleep', '/detail/sleep/[id]'],
  ] as const)('opens %s activities in their specialized detail sheet', (kind, expected) => {
    expect(activityDetailPath({}, category(kind))).toBe(expected);
  });

  it('opens linked plant care in the plant sheet and orphan plant entries generically', () => {
    expect(activityDetailPath({ plantId: 'plant-1' }, category('plant'))).toBe(
      '/detail/plant/[id]',
    );
    expect(activityDetailPath({}, category('plant'))).toBe('/detail/generic/[id]');
  });

  it.each(['event', 'generic'] as const)('opens %s activities in the generic detail sheet', (kind) => {
    expect(activityDetailPath({}, category(kind))).toBe('/detail/generic/[id]');
  });
});
