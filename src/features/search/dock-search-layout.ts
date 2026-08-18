/**
 * Dock search overlay + field layout.
 *
 * Flip `DOCK_SEARCH_LAYOUT` to `'compact'` to restore the pre-expand
 * floating results card and single-line field without reverting the branch.
 */
export type DockSearchLayoutMode = 'expand' | 'compact';

export const DOCK_SEARCH_LAYOUT: DockSearchLayoutMode = 'expand';

export const DOCK_SEARCH_INPUT_MAX_LINES = 3;

/** Compact-mode results plate cap (pre-expand floating card). */
export const DOCK_SEARCH_COMPACT_MAX_HEIGHT = 320;

/**
 * Grow a 1-line well by extra wrapped lines, then cap.
 * 1 line stays `minHeight`; 3 lines = minHeight + 2 × lineHeight.
 */
export function dockSearchInputMaxHeight(
  minHeight: number,
  oneLineHeight: number,
  maxLines: number = DOCK_SEARCH_INPUT_MAX_LINES,
): number {
  const extraLines = Math.max(0, maxLines - 1);
  return Math.max(minHeight, minHeight + Math.ceil(oneLineHeight) * extraLines);
}

export function clampDockSearchInputHeight(
  measured: number,
  minHeight: number,
  maxHeight: number,
): number {
  return Math.min(maxHeight, Math.max(minHeight, Math.ceil(measured)));
}

/**
 * Whole wrapped lines implied by TextInput contentSize.
 *
 * Stay on one line until content is clearly a second line (~2× lineHeight).
 * Sub-line glyph jitter and a 44pt chrome frame must not count as wrap.
 */
export function dockSearchWrappedLineCount(
  contentHeight: number,
  oneLineHeight: number,
  maxLines?: number,
): number {
  const line = Math.max(1, oneLineHeight);
  if (contentHeight <= 0) return 1;
  // floor((h + 1) / line): 22–42px stay 1 line; 44px (2 × 22) becomes 2.
  const lines = Math.max(1, Math.floor((contentHeight + 1) / line));
  return maxLines == null ? lines : Math.min(maxLines, lines);
}

export function dockSearchFieldHeightForLineCount(
  minHeight: number,
  oneLineHeight: number,
  lines: number,
): number {
  const extra = Math.max(0, Math.ceil(lines) - 1);
  return minHeight + Math.ceil(oneLineHeight) * extra;
}

export function dockSearchInputShouldScroll(
  lineCount: number,
  maxLines: number = DOCK_SEARCH_INPUT_MAX_LINES,
): boolean {
  return lineCount > maxLines;
}

export function dockSearchFieldHeightFromContentSize(
  contentHeight: number,
  minHeight: number,
  oneLineHeight: number,
  maxHeight: number,
): number {
  return clampDockSearchInputHeight(
    dockSearchFieldHeightForLineCount(
      minHeight,
      oneLineHeight,
      dockSearchWrappedLineCount(
        contentHeight,
        oneLineHeight,
        DOCK_SEARCH_INPUT_MAX_LINES,
      ),
    ),
    minHeight,
    maxHeight,
  );
}

/** Inner inset of the results plate — matches the current visual bottom pad. */
export function dockSearchResultsPadding(spacingLg: number): number {
  return spacingLg;
}

/** Gap between the results plate and the search field. */
export function dockSearchResultsGap(spacingSm: number): number {
  return spacingSm;
}

export function dockSearchOverlayBottom(
  tabBarHeight: number,
  fallbackBarHeight: number,
  gap: number,
): number {
  return Math.max(tabBarHeight, fallbackBarHeight) + gap;
}

export function dockSearchBarHeight(args: {
  collapsedBarHeight: number;
  fieldHeight: number;
  paddingTop: number;
  paddingBottom: number;
  expanded: boolean;
  layoutMode?: DockSearchLayoutMode;
}): number {
  const mode = args.layoutMode ?? DOCK_SEARCH_LAYOUT;
  if (!args.expanded || mode !== 'expand' || args.fieldHeight <= 0) {
    return args.collapsedBarHeight;
  }
  return Math.max(
    args.collapsedBarHeight,
    args.fieldHeight + args.paddingTop + args.paddingBottom,
  );
}
