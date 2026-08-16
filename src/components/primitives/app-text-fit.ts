/**
 * `fit` / `adjustsFontSizeToFit` is single-line chrome only.
 * Multiline sentences wrap at the token size — shrinking them is how
 * body copy becomes unreadable inside a tight frame.
 */
export function appTextShouldFit(options: {
  fit?: boolean;
  adjustsFontSizeToFit?: boolean;
  numberOfLines?: number;
}): boolean {
  const wantsFit = options.fit === true || options.adjustsFontSizeToFit === true;
  if (!wantsFit) return false;
  const lines = options.numberOfLines ?? 1;
  return lines === 1;
}
