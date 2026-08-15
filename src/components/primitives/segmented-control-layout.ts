export interface WrappedSegmentGrid {
  columns: number;
  widths: number[];
}

/**
 * Resolve exact wrapped-cell widths after reserving gutters. Yoga can otherwise
 * flex-grow cells to 100% and add `gap` afterward, which makes borders overlap.
 */
export function planWrappedSegmentGrid(
  optionCount: number,
  availableWidth: number,
  gap: number,
  minimumItemWidth: number,
  maximumColumns = 3,
): WrappedSegmentGrid {
  if (optionCount <= 0 || availableWidth <= 0) {
    return { columns: 1, widths: [] };
  }

  let columns = Math.min(maximumColumns, optionCount);
  while (
    columns > 1
    && (availableWidth - gap * (columns - 1)) / columns < minimumItemWidth
  ) {
    columns -= 1;
  }

  const widths = Array.from({ length: optionCount }, (_, index) => {
    const rowStart = Math.floor(index / columns) * columns;
    const itemsInRow = Math.min(columns, optionCount - rowStart);
    return (availableWidth - gap * (itemsInRow - 1)) / itemsInRow;
  });

  return { columns, widths };
}

