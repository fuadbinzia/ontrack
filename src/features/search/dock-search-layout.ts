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

/** iOS page frost while the search pill is open. Intensity 0 when blur is gated. */
export const DOCK_SEARCH_BACKDROP_BLUR_INTENSITY = 80;

/**
 * iOS may frost the page behind an empty search pill. Type-ahead and
 * conversation plates sit on that veil — nested BlurView samples the
 * atmosphere orbs and paints a chroma gradient that Android never shows
 * (Android is fill-only). Keep BlurView mounted; drop intensity instead.
 */
export function dockSearchOverlayFrosted(args: {
  ios: boolean;
  allowsBlur: boolean;
  fillScreen: boolean;
}): boolean {
  return args.ios && args.allowsBlur && !args.fillScreen;
}

/**
 * Light black veil over the frosted page. Stronger toward the dock so the
 * expanded pill sits on a grounded wash. Without blur (Android / gated),
 * alphas step up so the current screen still recedes.
 */
export function dockSearchBackdropGradientColors(args: {
  dark: boolean;
  blurred: boolean;
}): readonly [string, string, string] {
  if (args.blurred) {
    return args.dark
      ? ['rgba(0, 0, 0, 0.22)', 'rgba(0, 0, 0, 0.34)', 'rgba(0, 0, 0, 0.48)']
      : ['rgba(0, 0, 0, 0.16)', 'rgba(0, 0, 0, 0.26)', 'rgba(0, 0, 0, 0.38)'];
  }
  return args.dark
    ? ['rgba(0, 0, 0, 0.42)', 'rgba(0, 0, 0, 0.54)', 'rgba(0, 0, 0, 0.66)']
    : ['rgba(0, 0, 0, 0.24)', 'rgba(0, 0, 0, 0.36)', 'rgba(0, 0, 0, 0.50)'];
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

/** Dock More is always horizontal `…` (SF ellipsis / Material more_horiz). */
export function dockSearchMoreIcon(_pinCount?: number): 'more' {
  return 'more';
}

/**
 * Split nav pins around the center search slot; More stays last in the bar.
 * 3 pins → 2 left / 1 right; 5 pins → 3 left / 2 right.
 * 0–2 (and other leftovers) keep a ceil-half fallback during migration.
 */
export function splitDockSearchPins<T>(pins: T[]): { left: T[]; right: T[] } {
  const leftCount =
    pins.length === 5 ? 3 : pins.length === 3 ? 2 : Math.ceil(pins.length / 2);
  return { left: pins.slice(0, leftCount), right: pins.slice(leftCount) };
}

/**
 * Collapsed search occupies one dock slot horizontally, but its height is
 * the circular plate — not the slot width. 3-pin slots are wider than
 * 5-pin slots; using width as height lifts the search glyph.
 */
export function dockSearchCollapsedShellSize(args: {
  slotWidth: number;
  wellButtonSize: number;
}): { width: number; height: number } {
  return {
    width: Math.max(0, args.slotWidth),
    height: args.wellButtonSize,
  };
}

/** Fraction of the circular well that peeks above the dock chrome. */
export const DOCK_SEARCH_COLLAPSED_WELL_HANG_RATIO = 0.15;

export function dockSearchCollapsedWellHang(wellButtonSize: number): number {
  return Math.max(0, Math.round(wellButtonSize * DOCK_SEARCH_COLLAPSED_WELL_HANG_RATIO));
}

/**
 * Translate the collapsed well up so 15% of the circle clears the dock
 * chrome. Uses the circular plate size only — slot width (3-pin vs 5-pin)
 * must not change this lift.
 */
export function dockSearchCollapsedWellLift(args: {
  barBaseHeight: number;
  barPaddingTop: number;
  wellButtonSize: number;
}): number {
  const hang = dockSearchCollapsedWellHang(args.wellButtonSize);
  const rowHeight = Math.max(0, args.barBaseHeight - args.barPaddingTop);
  const wellTopBelowChrome =
    args.barPaddingTop + Math.max(0, rowHeight - args.wellButtonSize);
  return wellTopBelowChrome + hang;
}

/** Gap between the circular well and the circulating halo ring. */
export const DOCK_SEARCH_HALO_PAD = 5;
/** Soft core stroke — light, not a loader bar. */
export const DOCK_SEARCH_HALO_STROKE = 1.75;
/**
 * Extra canvas around the ring so glow can feather out instead of
 * clipping to a hard SVG edge.
 */
export const DOCK_SEARCH_HALO_GLOW_BLEED = 10;
/** One slow lap around the mark — living, not a spinner. */
export const DOCK_SEARCH_HALO_ORBIT_MS = 3600;

export type DockSearchHaloLayer = {
  ratio: number;
  strokeScale: number;
  alphaLight: number;
  alphaDark: number;
};

/**
 * Soft comet: long faint wash → short brighter head.
 * Every alpha stays translucent so the ends never read as cut strokes.
 */
export const DOCK_SEARCH_HALO_LAYERS: readonly DockSearchHaloLayer[] = [
  { ratio: 0.58, strokeScale: 4.4, alphaLight: 0.08, alphaDark: 0.12 },
  { ratio: 0.38, strokeScale: 2.6, alphaLight: 0.14, alphaDark: 0.2 },
  { ratio: 0.22, strokeScale: 1.4, alphaLight: 0.22, alphaDark: 0.3 },
  { ratio: 0.1, strokeScale: 0.85, alphaLight: 0.36, alphaDark: 0.46 },
];

/** Brightest comet head as a fraction of the ring. */
export const DOCK_SEARCH_HALO_ARC_RATIO =
  DOCK_SEARCH_HALO_LAYERS[DOCK_SEARCH_HALO_LAYERS.length - 1].ratio;
/** Longest trailing wash behind the head. */
export const DOCK_SEARCH_HALO_TRAIL_RATIO = DOCK_SEARCH_HALO_LAYERS[0].ratio;

export const DOCK_SEARCH_HALO_AMBIENT_ALPHA_LIGHT = 0.14;
export const DOCK_SEARCH_HALO_AMBIENT_ALPHA_DARK = 0.2;

export function dockSearchHaloSize(
  wellButtonSize: number,
  pad: number = DOCK_SEARCH_HALO_PAD,
): number {
  return wellButtonSize + Math.max(0, pad) * 2;
}

export function dockSearchHaloRadius(
  wellButtonSize: number,
  pad: number = DOCK_SEARCH_HALO_PAD,
): number {
  return wellButtonSize / 2 + Math.max(0, pad);
}

export function dockSearchHaloInset(
  pad: number = DOCK_SEARCH_HALO_PAD,
  bleed: number = DOCK_SEARCH_HALO_GLOW_BLEED,
): number {
  return Math.max(0, pad) + Math.max(0, bleed);
}

export function dockSearchHaloCanvasSize(
  wellButtonSize: number,
  pad: number = DOCK_SEARCH_HALO_PAD,
  bleed: number = DOCK_SEARCH_HALO_GLOW_BLEED,
): number {
  return dockSearchHaloSize(wellButtonSize, pad) + Math.max(0, bleed) * 2;
}

export function dockSearchHaloWidestStroke(): number {
  const scale = Math.max(
    ...DOCK_SEARCH_HALO_LAYERS.map((layer) => layer.strokeScale),
  );
  return DOCK_SEARCH_HALO_STROKE * scale;
}

/** Outer edge of the widest comet stroke — must stay inside the canvas. */
export function dockSearchHaloOuterExtent(wellButtonSize: number): number {
  return dockSearchHaloRadius(wellButtonSize) + dockSearchHaloWidestStroke() / 2;
}

export function dockSearchHaloAmbientAlpha(dark: boolean): number {
  return dark
    ? DOCK_SEARCH_HALO_AMBIENT_ALPHA_DARK
    : DOCK_SEARCH_HALO_AMBIENT_ALPHA_LIGHT;
}

/** Radial-gradient ring: transparent well, peak on the orbit, fade to none. */
export function dockSearchHaloGlowStops(wellButtonSize: number): {
  innerPct: number;
  peakPct: number;
} {
  const half = dockSearchHaloCanvasSize(wellButtonSize) / 2;
  const pct = (radius: number) =>
    Math.round((Math.max(0, radius) / Math.max(1, half)) * 1000) / 10;
  return {
    innerPct: pct(wellButtonSize / 2),
    peakPct: pct(dockSearchHaloRadius(wellButtonSize)),
  };
}

export function dockSearchHaloArcLength(
  circumference: number,
  ratio: number = DOCK_SEARCH_HALO_ARC_RATIO,
): number {
  return Math.round(circumference * Math.min(1, Math.max(0, ratio)) * 1000) / 1000;
}

/**
 * Walk the dashed comet around the ring.
 *
 * Android Svg ignores a parent View rotate — ProgressRing already animates
 * `strokeDashoffset` on the Circle itself, which both platforms honor.
 */
export function dockSearchHaloDashOffset(
  orbit: number,
  circumference: number,
): number {
  'worklet';
  const lap = ((orbit % 1) + 1) % 1;
  return 0 - lap * circumference;
}
