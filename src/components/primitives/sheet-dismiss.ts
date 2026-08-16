export const SHEET_EXIT_MIN_DISTANCE = 320;
export const SHEET_EXIT_SKIP_RATIO = 0.85;
export const SHEET_EXIT_FALLBACK_MS = 340;

// Called from the sheet pan's onEnd on the UI runtime — must be worklets or
// the drag-to-dismiss commit throws "Tried to synchronously call a Remote
// Function" the moment a sheet is flung.
export function sheetExitDistance(height: number): number {
  'worklet';
  const safe = Number.isFinite(height) ? height : 0;
  return Math.max(safe, SHEET_EXIT_MIN_DISTANCE);
}

/** Swipe already parked the card off-screen — skip a second exit. */
export function shouldSkipSheetExit(dragY: number, height: number): boolean {
  'worklet';
  const travel = Number.isFinite(dragY) ? dragY : 0;
  return travel >= sheetExitDistance(height) * SHEET_EXIT_SKIP_RATIO;
}

export function shouldHoldSheet(visible: boolean, held: boolean): boolean {
  return visible || held;
}
