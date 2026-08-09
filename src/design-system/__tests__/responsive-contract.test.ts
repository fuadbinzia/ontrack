import { contentGutter, widthClass } from '@/design-system/responsive';

/**
 * Food package (09_QA) contract: the 320dp compact class must behave
 * correctly, so the class boundaries themselves are pinned here.
 * compact <= 359 < regular < 480 <= large.
 */
describe('widthClass boundaries', () => {
  it.each([
    [319, 'compact'],
    [320, 'compact'],
    [359, 'compact'],
    [360, 'regular'],
    [479, 'regular'],
    [480, 'large'],
    [599, 'large'],
  ] as const)('%ddp → %s', (width, expected) => {
    expect(widthClass(width)).toBe(expected);
  });

  it('falls back to regular for non-finite / non-positive widths', () => {
    expect(widthClass(0)).toBe('regular');
    expect(widthClass(-10)).toBe('regular');
    expect(widthClass(Number.NaN)).toBe('regular');
    expect(widthClass(Number.POSITIVE_INFINITY)).toBe('regular');
  });
});

describe('contentGutter per width class', () => {
  it.each([
    [319, 14],
    [320, 14],
    [359, 14],
    [360, 16],
    [479, 16],
    [480, 20],
    [599, 20],
  ] as const)('%ddp → %ddp gutter', (width, expected) => {
    expect(contentGutter(width)).toBe(expected);
  });
});
