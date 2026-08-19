import {
  clampDockSearchInputHeight,
  dockSearchBackdropGradientColors,
  dockSearchBarHeight,
  dockSearchFieldHeightForLineCount,
  dockSearchFieldHeightFromContentSize,
  dockSearchInputMaxHeight,
  dockSearchInputShouldScroll,
  dockSearchOverlayBottom,
  dockSearchOverlayFrosted,
  dockSearchResultsGap,
  dockSearchResultsPadding,
  dockSearchWrappedLineCount,
  dockSearchCollapsedShellSize,
  dockSearchCollapsedWellHang,
  dockSearchCollapsedWellLift,
  dockSearchHaloAmbientAlpha,
  dockSearchHaloArcLength,
  dockSearchHaloCanvasSize,
  dockSearchHaloDashOffset,
  dockSearchHaloGlowStops,
  dockSearchHaloInset,
  dockSearchHaloOuterExtent,
  dockSearchHaloRadius,
  dockSearchHaloSize,
  dockSearchHaloWidestStroke,
  DOCK_SEARCH_BACKDROP_BLUR_INTENSITY,
  DOCK_SEARCH_COLLAPSED_WELL_HANG_RATIO,
  DOCK_SEARCH_HALO_AMBIENT_ALPHA_DARK,
  DOCK_SEARCH_HALO_AMBIENT_ALPHA_LIGHT,
  DOCK_SEARCH_HALO_ARC_RATIO,
  DOCK_SEARCH_HALO_GLOW_BLEED,
  DOCK_SEARCH_HALO_LAYERS,
  DOCK_SEARCH_HALO_ORBIT_MS,
  DOCK_SEARCH_HALO_PAD,
  DOCK_SEARCH_HALO_STROKE,
  DOCK_SEARCH_HALO_TRAIL_RATIO,
  dockSearchMoreIcon,
  splitDockSearchPins,
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

  it('splits 3 pins as 2 left of Search and 1 right', () => {
    expect(splitDockSearchPins(['today', 'checklists', 'calendar'])).toEqual({
      left: ['today', 'checklists'],
      right: ['calendar'],
    });
  });

  it('splits 5 pins as 3 left of Search and 2 right', () => {
    expect(
      splitDockSearchPins([
        'today',
        'checklists',
        'calendar',
        'overview',
        'profile',
      ]),
    ).toEqual({
      left: ['today', 'checklists', 'calendar'],
      right: ['overview', 'profile'],
    });
  });

  it('keeps a safe split for leftover short arrays during migration', () => {
    expect(splitDockSearchPins([])).toEqual({ left: [], right: [] });
    expect(splitDockSearchPins(['today'])).toEqual({
      left: ['today'],
      right: [],
    });
    expect(splitDockSearchPins(['today', 'checklists'])).toEqual({
      left: ['today'],
      right: ['checklists'],
    });
    expect(
      splitDockSearchPins(['today', 'checklists', 'calendar', 'travel']),
    ).toEqual({
      left: ['today', 'checklists'],
      right: ['calendar', 'travel'],
    });
  });

  it('uses horizontal More dots for every pin count', () => {
    expect(dockSearchMoreIcon(1)).toBe('more');
    expect(dockSearchMoreIcon(2)).toBe('more');
    expect(dockSearchMoreIcon(3)).toBe('more');
    expect(dockSearchMoreIcon(4)).toBe('more');
    expect(dockSearchMoreIcon(5)).toBe('more');
  });

  it('hangs 15% of the search well above the dock for 3-pin and 5-pin slots', () => {
    const wellButtonSize = 48;
    const barBaseHeight = 58;
    const barPaddingTop = 4;
    const three = dockSearchCollapsedShellSize({
      slotWidth: 72,
      wellButtonSize,
    });
    const five = dockSearchCollapsedShellSize({
      slotWidth: 51,
      wellButtonSize,
    });
    const lift = dockSearchCollapsedWellLift({
      barBaseHeight,
      barPaddingTop,
      wellButtonSize,
    });
    expect(DOCK_SEARCH_COLLAPSED_WELL_HANG_RATIO).toBe(0.15);
    expect(three.height).toBe(five.height);
    expect(three.height).toBe(wellButtonSize);
    expect(dockSearchCollapsedWellHang(wellButtonSize)).toBe(7);
    expect(lift).toBe(4 + (58 - 4 - 48) + 7);
    expect(lift).toBe(17);
  });

  it('still hangs 15% of the well when the plate fills the dock row', () => {
    expect(
      dockSearchCollapsedWellLift({
        barBaseHeight: 48,
        barPaddingTop: 4,
        wellButtonSize: 48,
      }),
    ).toBe(4 + 7);
    expect(
      dockSearchCollapsedWellLift({
        barBaseHeight: 48,
        barPaddingTop: 0,
        wellButtonSize: 48,
      }),
    ).toBe(7);
    expect(dockSearchCollapsedWellHang(0)).toBe(0);
    expect(dockSearchCollapsedWellHang(44)).toBe(7);
    expect(dockSearchCollapsedWellHang(48)).toBe(7);
    expect(dockSearchCollapsedWellHang(54)).toBe(8);
  });

  it('does not frost iOS type-ahead or conversation plates over nested overlay blur', () => {
    expect(dockSearchOverlayFrosted({
      ios: true,
      allowsBlur: true,
      fillScreen: false,
    })).toBe(true);
    expect(dockSearchOverlayFrosted({
      ios: true,
      allowsBlur: true,
      fillScreen: true,
    })).toBe(false);
  });

  it('never frosts the overlay on Android or when blur is gated', () => {
    expect(dockSearchOverlayFrosted({
      ios: false,
      allowsBlur: true,
      fillScreen: false,
    })).toBe(false);
    expect(dockSearchOverlayFrosted({
      ios: true,
      allowsBlur: false,
      fillScreen: false,
    })).toBe(false);
    expect(dockSearchOverlayFrosted({
      ios: false,
      allowsBlur: false,
      fillScreen: true,
    })).toBe(false);
  });

  it('uses a light black veil that is stronger toward the dock than the top', () => {
    const lightBlur = dockSearchBackdropGradientColors({
      dark: false,
      blurred: true,
    });
    const darkBlur = dockSearchBackdropGradientColors({
      dark: true,
      blurred: true,
    });
    const lightSolid = dockSearchBackdropGradientColors({
      dark: false,
      blurred: false,
    });
    const darkSolid = dockSearchBackdropGradientColors({
      dark: true,
      blurred: false,
    });

    expect(DOCK_SEARCH_BACKDROP_BLUR_INTENSITY).toBe(80);
    for (const colors of [lightBlur, darkBlur, lightSolid, darkSolid]) {
      expect(colors).toHaveLength(3);
      for (const color of colors) {
        expect(color.startsWith('rgba(0, 0, 0, ')).toBe(true);
      }
      const alphas = colors.map((color) => Number(color.slice('rgba(0, 0, 0, '.length, -1)));
      expect(alphas[0]).toBeLessThan(alphas[1]!);
      expect(alphas[1]).toBeLessThan(alphas[2]!);
      expect(alphas[2]).toBeLessThanOrEqual(0.66);
    }

    const lightBlurBottom = Number(lightBlur[2].slice('rgba(0, 0, 0, '.length, -1));
    const lightSolidBottom = Number(lightSolid[2].slice('rgba(0, 0, 0, '.length, -1));
    const darkBlurBottom = Number(darkBlur[2].slice('rgba(0, 0, 0, '.length, -1));
    const darkSolidBottom = Number(darkSolid[2].slice('rgba(0, 0, 0, '.length, -1));
    expect(lightBlurBottom).toBeLessThan(lightSolidBottom);
    expect(darkBlurBottom).toBeLessThan(darkSolidBottom);
    expect(lightBlurBottom).toBeLessThan(darkBlurBottom);
  });

  it('keeps the unblurred wash lighter than a full overlay scrim', () => {
    const light = dockSearchBackdropGradientColors({ dark: false, blurred: false });
    const dark = dockSearchBackdropGradientColors({ dark: true, blurred: false });
    const lightTop = Number(light[0].slice('rgba(0, 0, 0, '.length, -1));
    const darkTop = Number(dark[0].slice('rgba(0, 0, 0, '.length, -1));
    expect(lightTop).toBeLessThan(0.45);
    expect(darkTop).toBeLessThan(0.6);
    expect(lightTop).toBeGreaterThan(0);
    expect(darkTop).toBeGreaterThan(lightTop);
  });

  it('keeps collapsed search width on the dock slot for 3 and 5 pins', () => {
    expect(
      dockSearchCollapsedShellSize({ slotWidth: 0, wellButtonSize: 48 }),
    ).toEqual({ width: 0, height: 48 });
    expect(
      dockSearchCollapsedShellSize({ slotWidth: 54, wellButtonSize: 44 }),
    ).toEqual({ width: 54, height: 44 });
    expect(
      dockSearchCollapsedShellSize({ slotWidth: 80, wellButtonSize: 48 }).height,
    ).toBe(
      dockSearchCollapsedShellSize({ slotWidth: 48, wellButtonSize: 48 }).height,
    );
  });

  it('sizes the circulating halo just outside the search well', () => {
    expect(DOCK_SEARCH_HALO_PAD).toBe(5);
    expect(DOCK_SEARCH_HALO_STROKE).toBe(1.75);
    expect(DOCK_SEARCH_HALO_GLOW_BLEED).toBe(10);
    expect(DOCK_SEARCH_HALO_ORBIT_MS).toBe(3600);
    expect(DOCK_SEARCH_HALO_ARC_RATIO).toBe(0.1);
    expect(DOCK_SEARCH_HALO_TRAIL_RATIO).toBe(0.58);
    expect(DOCK_SEARCH_HALO_TRAIL_RATIO).toBeGreaterThan(DOCK_SEARCH_HALO_ARC_RATIO);
    expect(dockSearchHaloSize(48)).toBe(58);
    expect(dockSearchHaloSize(44, 0)).toBe(44);
    expect(dockSearchHaloSize(48, -3)).toBe(48);
    expect(dockSearchHaloRadius(48)).toBe(29);
    expect(dockSearchHaloInset()).toBe(15);
    expect(dockSearchHaloCanvasSize(48)).toBe(78);
    expect(dockSearchHaloCanvasSize(44, 0)).toBe(64);
    expect(dockSearchHaloCanvasSize(48, 5, -3)).toBe(58);
    expect(dockSearchHaloArcLength(100)).toBe(10);
    expect(dockSearchHaloArcLength(100, DOCK_SEARCH_HALO_TRAIL_RATIO)).toBe(58);
    expect(dockSearchHaloArcLength(100, 2)).toBe(100);
    expect(dockSearchHaloArcLength(100, -1)).toBe(0);
  });

  it('feathers the circulating halo off the canvas so glow is not clipped to a hard edge', () => {
    for (const well of [44, 48, 56]) {
      const half = dockSearchHaloCanvasSize(well) / 2;
      expect(dockSearchHaloOuterExtent(well)).toBeLessThanOrEqual(half);
      expect(DOCK_SEARCH_HALO_GLOW_BLEED).toBeGreaterThan(dockSearchHaloWidestStroke() / 2);
    }
  });

  it('keeps the halo comet translucent with a fading tail instead of a cut loader bar', () => {
    expect(DOCK_SEARCH_HALO_LAYERS.length).toBeGreaterThanOrEqual(3);
    for (const [index, layer] of DOCK_SEARCH_HALO_LAYERS.entries()) {
      expect(layer.alphaLight).toBeGreaterThan(0);
      expect(layer.alphaLight).toBeLessThan(1);
      expect(layer.alphaDark).toBeGreaterThan(layer.alphaLight);
      expect(layer.alphaDark).toBeLessThan(1);
      expect(layer.ratio).toBeGreaterThan(0);
      expect(layer.ratio).toBeLessThan(1);
      if (index > 0) {
        const previous = DOCK_SEARCH_HALO_LAYERS[index - 1];
        expect(layer.ratio).toBeLessThan(previous.ratio);
        expect(layer.strokeScale).toBeLessThan(previous.strokeScale);
        expect(layer.alphaLight).toBeGreaterThan(previous.alphaLight);
      }
    }
    expect(dockSearchHaloAmbientAlpha(false)).toBe(DOCK_SEARCH_HALO_AMBIENT_ALPHA_LIGHT);
    expect(dockSearchHaloAmbientAlpha(true)).toBe(DOCK_SEARCH_HALO_AMBIENT_ALPHA_DARK);
    expect(DOCK_SEARCH_HALO_AMBIENT_ALPHA_LIGHT).toBeLessThan(1);
    expect(DOCK_SEARCH_HALO_AMBIENT_ALPHA_DARK).toBeLessThan(1);
  });

  it('keeps the ambient glow as a ring that fades inside the well and outside the orbit', () => {
    const stops = dockSearchHaloGlowStops(48);
    expect(stops.innerPct).toBeGreaterThan(50);
    expect(stops.innerPct).toBeLessThan(stops.peakPct);
    expect(stops.peakPct).toBeLessThan(100);
    expect(stops.innerPct).toBe(Math.round((24 / 39) * 1000) / 10);
    expect(stops.peakPct).toBe(Math.round((29 / 39) * 1000) / 10);
    const tight = dockSearchHaloGlowStops(44);
    expect(tight.innerPct).toBeLessThan(tight.peakPct);
    expect(dockSearchHaloGlowStops(0).innerPct).toBe(0);
  });

  it('walks the halo comet with dash offset so Android Svg can orbit without a parent rotate', () => {
    expect(dockSearchHaloDashOffset(0, 100)).toBe(0);
    expect(dockSearchHaloDashOffset(0.25, 100)).toBe(-25);
    expect(dockSearchHaloDashOffset(0.5, 100)).toBe(-50);
    expect(dockSearchHaloDashOffset(1, 100)).toBe(0);
    expect(dockSearchHaloDashOffset(1.25, 200)).toBe(-50);
    expect(dockSearchHaloDashOffset(-0.25, 100)).toBe(-75);
    expect(dockSearchHaloDashOffset(0.5, 0)).toBe(0);
  });
});
