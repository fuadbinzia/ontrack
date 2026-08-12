export type DropdownAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DropdownMenuPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openDown: boolean;
};

export function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

/** Place an overlay menu relative to a trigger measured in window coordinates. */
export function placeDropdownMenu(input: {
  anchor: DropdownAnchor;
  windowWidth: number;
  windowHeight: number;
  insetTop: number;
  insetBottom: number;
  insetLeft: number;
  insetRight: number;
  contentHeight: number;
  menuMaxHeight: number;
  gutter: number;
  gap: number;
  minWidth?: number;
  matchTriggerWidth?: boolean;
  /**
   * Docked soft-keyboard height from the window bottom (RN Modal overlays).
   * Takes precedence over safe-area insetBottom when larger so footers /
   * create-inputs stay above the IME.
   */
  keyboardInset?: number;
}): DropdownMenuPlacement {
  const {
    anchor,
    windowWidth,
    windowHeight,
    insetTop,
    insetBottom,
    insetLeft,
    insetRight,
    contentHeight,
    menuMaxHeight,
    gutter,
    gap,
    minWidth = 160,
    matchTriggerWidth = true,
    keyboardInset = 0,
  } = input;

  const maxHeight = Math.min(menuMaxHeight, contentHeight);
  const availableWidth = Math.max(120, windowWidth - insetLeft - insetRight - gutter * 2);
  const width = Math.min(
    availableWidth,
    Math.max(matchTriggerWidth ? anchor.width : minWidth, minWidth),
  );
  const minimumLeft = insetLeft + gutter;
  const maximumLeft = Math.max(minimumLeft, windowWidth - insetRight - gutter - width);
  const left = clampNumber(anchor.x, minimumLeft, maximumLeft);

  // IME occlusion wins over home-indicator inset when the soft keyboard is up.
  const bottomClearance = Math.max(insetBottom, keyboardInset);
  const spaceBelow =
    windowHeight - bottomClearance - gutter - (anchor.y + anchor.height);
  const spaceAbove = anchor.y - insetTop - gutter;
  const openDown =
    spaceBelow >= Math.min(maxHeight, 160) + gap || spaceBelow >= spaceAbove;
  const resolvedMaxHeight = openDown
    ? Math.min(maxHeight, Math.max(88, spaceBelow - gap))
    : Math.min(maxHeight, Math.max(88, spaceAbove - gap));
  const top = openDown
    ? anchor.y + anchor.height + gap
    : Math.max(insetTop + gutter, anchor.y - resolvedMaxHeight - gap);

  return {
    top,
    left,
    width,
    maxHeight: resolvedMaxHeight,
    openDown,
  };
}
