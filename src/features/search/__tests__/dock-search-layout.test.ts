import {
  clampDockSearchInputHeight,
  dockSearchBarHeight,
  dockSearchFieldHeightForLineCount,
  dockSearchFieldHeightFromContentSize,
  dockSearchInputMaxHeight,
  dockSearchInputShouldScroll,
  dockSearchOverlayBottom,
  dockSearchResultsGap,
  dockSearchResultsPadding,
  dockSearchWrappedLineCount,
  DOCK_SEARCH_COMPACT_MAX_HEIGHT,
  DOCK_SEARCH_INPUT_MAX_LINES,
  DOCK_SEARCH_LAYOUT,
} from '../dock-search-layout';

describe('dock search layout helpers', () => {
  it('does not change field height as one-line contentSize jitters letter by letter', () => {
    const minHeight = 44;
    const oneLineHeight = 22;
    const maxHeight = dockSearchInputMaxHeight(minHeight, oneLineHeight);

    for (const contentHeight of [0, 18, 22, 24, 26, 28, 30, 32, 36, 40, 42]) {
      expect(dockSearchWrappedLineCount(contentHeight, oneLineHeight)).toBe(1);
      expect(
        dockSearchFieldHeightFromContentSize(
          contentHeight,
          minHeight,
          oneLineHeight,
          maxHeight,
        ),
      ).toBe(44);
    }
  });

  it('grows only when text wraps onto a new line and caps at three lines', () => {
    const minHeight = 44;
    const oneLineHeight = 22;
    const maxHeight = dockSearchInputMaxHeight(minHeight, oneLineHeight);

    expect(DOCK_SEARCH_INPUT_MAX_LINES).toBe(3);
    expect(maxHeight).toBe(88);

    expect(dockSearchWrappedLineCount(33, oneLineHeight)).toBe(1);
    expect(dockSearchWrappedLineCount(42, oneLineHeight)).toBe(1);
    expect(dockSearchWrappedLineCount(43, oneLineHeight)).toBe(2);
    expect(dockSearchWrappedLineCount(44, oneLineHeight)).toBe(2);
    expect(dockSearchWrappedLineCount(45, oneLineHeight)).toBe(2);
    expect(dockSearchWrappedLineCount(66, oneLineHeight)).toBe(3);
    expect(dockSearchWrappedLineCount(88, oneLineHeight)).toBe(4);
    expect(
      dockSearchWrappedLineCount(88, oneLineHeight, DOCK_SEARCH_INPUT_MAX_LINES),
    ).toBe(3);

    expect(dockSearchFieldHeightForLineCount(minHeight, oneLineHeight, 1)).toBe(44);
    expect(dockSearchFieldHeightForLineCount(minHeight, oneLineHeight, 2)).toBe(66);
    expect(dockSearchFieldHeightForLineCount(minHeight, oneLineHeight, 3)).toBe(88);

    expect(
      dockSearchFieldHeightFromContentSize(44, minHeight, oneLineHeight, maxHeight),
    ).toBe(66);
    expect(
      dockSearchFieldHeightFromContentSize(66, minHeight, oneLineHeight, maxHeight),
    ).toBe(88);
    expect(
      dockSearchFieldHeightFromContentSize(90, minHeight, oneLineHeight, maxHeight),
    ).toBe(88);
  });

  it('scrolls only after content exceeds three wrapped lines', () => {
    const oneLineHeight = 22;
    expect(dockSearchInputShouldScroll(1)).toBe(false);
    expect(dockSearchInputShouldScroll(3)).toBe(false);
    expect(dockSearchInputShouldScroll(4)).toBe(true);
    expect(
      dockSearchInputShouldScroll(dockSearchWrappedLineCount(66, oneLineHeight)),
    ).toBe(false);
    expect(
      dockSearchInputShouldScroll(dockSearchWrappedLineCount(88, oneLineHeight)),
    ).toBe(true);
  });

  it('caps the search field at three wrapped lines then scrolls', () => {
    const minHeight = 44;
    const oneLineHeight = 22;
    const maxHeight = dockSearchInputMaxHeight(minHeight, oneLineHeight);

    expect(clampDockSearchInputHeight(22, minHeight, maxHeight)).toBe(44);
    expect(clampDockSearchInputHeight(66, minHeight, maxHeight)).toBe(66);
    expect(clampDockSearchInputHeight(120, minHeight, maxHeight)).toBe(88);
  });

  it('grows the tab bar with the field while search is expanded', () => {
    expect(
      dockSearchBarHeight({
        collapsedBarHeight: 80,
        fieldHeight: 44,
        paddingTop: 2,
        paddingBottom: 34,
        expanded: false,
      }),
    ).toBe(80);

    expect(
      dockSearchBarHeight({
        collapsedBarHeight: 80,
        fieldHeight: 44,
        paddingTop: 2,
        paddingBottom: 34,
        expanded: true,
      }),
    ).toBe(80);

    expect(
      dockSearchBarHeight({
        collapsedBarHeight: 80,
        fieldHeight: 88,
        paddingTop: 2,
        paddingBottom: 34,
        expanded: true,
      }),
    ).toBe(124);

    expect(
      dockSearchBarHeight({
        collapsedBarHeight: 80,
        fieldHeight: 88,
        paddingTop: 2,
        paddingBottom: 34,
        expanded: true,
        layoutMode: 'compact',
      }),
    ).toBe(80);
  });

  it('keeps results above the field with uniform inner padding and a compact fallback cap', () => {
    expect(dockSearchResultsPadding(16)).toBe(16);
    expect(dockSearchResultsGap(8)).toBe(8);
    expect(dockSearchOverlayBottom(92, 80, 8)).toBe(100);
    expect(dockSearchOverlayBottom(0, 80, 8)).toBe(88);
    expect(DOCK_SEARCH_COMPACT_MAX_HEIGHT).toBe(320);
    expect(DOCK_SEARCH_LAYOUT === 'expand' || DOCK_SEARCH_LAYOUT === 'compact').toBe(
      true,
    );
  });
});
