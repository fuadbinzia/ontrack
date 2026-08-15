import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { planWrappedSegmentGrid } from '../segmented-control-layout';

function rowWidth(widths: readonly number[], gap: number) {
  return widths.reduce((total, width) => total + width, 0) + gap * (widths.length - 1);
}

describe('planWrappedSegmentGrid', () => {
  it('reserves gutters before sizing the three workout-type cells', () => {
    const grid = planWrappedSegmentGrid(4, 630, 8, 104);

    expect(grid.columns).toBe(3);
    expect(rowWidth(grid.widths.slice(0, 3), 8)).toBeCloseTo(630);
    expect(grid.widths[0]).toBeLessThan(630 / 3);
    expect(grid.widths[3]).toBe(630);
  });

  it('keeps three columns at the exact minimum-width boundary', () => {
    const grid = planWrappedSegmentGrid(3, 328, 8, 104);

    expect(grid.columns).toBe(3);
    expect(grid.widths).toEqual([104, 104, 104]);
    expect(rowWidth(grid.widths, 8)).toBe(328);
  });

  it('drops to two columns below the boundary and fills both rows without overlap', () => {
    const grid = planWrappedSegmentGrid(4, 327, 8, 104);

    expect(grid.columns).toBe(2);
    expect(rowWidth(grid.widths.slice(0, 2), 8)).toBeCloseTo(327);
    expect(rowWidth(grid.widths.slice(2, 4), 8)).toBeCloseTo(327);
    expect(grid.widths.every((width) => width >= 104)).toBe(true);
  });

  it('distributes a two-item final row instead of leaving unused space', () => {
    const grid = planWrappedSegmentGrid(5, 630, 8, 104);

    expect(grid.columns).toBe(3);
    expect(rowWidth(grid.widths.slice(3), 8)).toBeCloseTo(630);
  });
});

describe('SegmentedControl wrapped-layout contract', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/primitives/segmented-control.tsx'),
    'utf8',
  );

  it('uses gutter-aware measured widths instead of flex-growing cells into each other', () => {
    expect(source).toContain('planWrappedSegmentGrid');
    expect(source).toContain('wrappedWidth={wrap ? wrappedGrid.widths[index] : undefined}');
    expect(source).not.toMatch(/segmentWrapped:\s*\{[^}]*flexGrow:\s*1/s);
    expect(source).not.toContain("flexBasis: '30%'");
  });
});
