import {
  DEFAULT_CATEGORIES,
  gymCategoryIds,
  mergeDefaultCategories,
} from '@/constants/categories';
import type { ActivityCategory } from '@/types/models';

const customCategory: ActivityCategory = {
  id: 'reading',
  name: 'Reading',
  icon: 'learning',
  colorKey: 'learning',
  supportsPhotos: false,
  supportsTimer: true,
  detailKind: 'generic',
  isCustom: true,
};

describe('schedule category upgrades', () => {
  it('restores Event when persisted categories predate event discovery', () => {
    const legacyCategories = DEFAULT_CATEGORIES.filter((category) => category.id !== 'event');

    expect(mergeDefaultCategories(legacyCategories)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'event', detailKind: 'event' }),
      ]),
    );
  });

  it('preserves custom categories after restoring built-in categories', () => {
    const merged = mergeDefaultCategories([customCategory]);

    expect(merged.at(-1)).toEqual(customCategory);
    expect(merged).toHaveLength(DEFAULT_CATEGORIES.length + 1);
  });

  it('replaces stale built-in definitions without creating duplicates', () => {
    const merged = mergeDefaultCategories([
      {
        ...DEFAULT_CATEGORIES.find((category) => category.id === 'event')!,
        name: 'Old event',
        detailKind: 'generic',
      },
    ]);

    expect(merged.filter((category) => category.id === 'event')).toEqual([
      expect.objectContaining({ name: 'Event', detailKind: 'event' }),
    ]);
  });

  it('collects gym category ids for fitness presence and overview', () => {
    expect(gymCategoryIds(DEFAULT_CATEGORIES)).toEqual(new Set(['gym']));
    expect(
      gymCategoryIds([
        ...DEFAULT_CATEGORIES,
        { ...customCategory, id: 'home-gym', detailKind: 'gym' },
      ]),
    ).toEqual(new Set(['gym', 'home-gym']));
    expect(gymCategoryIds([])).toEqual(new Set());
  });
});
