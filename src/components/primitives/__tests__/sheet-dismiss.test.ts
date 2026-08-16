import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    SHEET_EXIT_MIN_DISTANCE,
    isModalSheetPresented,
    sheetExitDistance,
    shouldHoldSheet,
    shouldSkipSheetExit,
} from '@/components/primitives/sheet-dismiss';

describe('sheet dismiss hold', () => {
  it('keeps a closing sheet mounted until the exit can finish', () => {
    expect(shouldHoldSheet(true, false)).toBe(true);
    expect(shouldHoldSheet(false, true)).toBe(true);
    expect(shouldHoldSheet(false, false)).toBe(false);
  });

  it('uses a minimum travel so short plates still leave the viewport', () => {
    expect(sheetExitDistance(120)).toBe(SHEET_EXIT_MIN_DISTANCE);
    expect(sheetExitDistance(640)).toBe(640);
    expect(sheetExitDistance(Number.NaN)).toBe(SHEET_EXIT_MIN_DISTANCE);
  });

  it('skips a second exit when a swipe already parked the card off-screen', () => {
    expect(shouldSkipSheetExit(0, 480)).toBe(false);
    expect(shouldSkipSheetExit(200, 480)).toBe(false);
    expect(shouldSkipSheetExit(480, 480)).toBe(true);
    expect(shouldSkipSheetExit(SHEET_EXIT_MIN_DISTANCE, 80)).toBe(true);
  });
});

describe('isModalSheetPresented', () => {
  it('hides the tab dock for an in-tree modal that is open', () => {
    expect(isModalSheetPresented(true, 'modal', false)).toBe(true);
    expect(isModalSheetPresented(true, 'modal', true)).toBe(true);
  });

  it('does not hide the dock for a closed in-tree modal', () => {
    expect(isModalSheetPresented(false, 'modal', true)).toBe(false);
    expect(isModalSheetPresented(false, 'modal', false)).toBe(false);
  });

  it('hides the dock for a focused route sheet', () => {
    expect(isModalSheetPresented(true, 'route', true)).toBe(true);
  });

  it('does not hide the dock for a prefetched route sheet that is not focused', () => {
    expect(isModalSheetPresented(true, 'route', false)).toBe(false);
  });

  it('does not hide the dock for a focused route whose sheet is not visible', () => {
    expect(isModalSheetPresented(false, 'route', true)).toBe(false);
  });
});

describe('UI-runtime helpers stay worklets', () => {
  const read = (relative: string) =>
    readFileSync(join(process.cwd(), relative), 'utf8');

  it('marks sheet exit math as worklets so flinging a sheet down cannot throw a Remote Function error', () => {
    const source = read('src/components/primitives/sheet-dismiss.ts');
    expect(source).toMatch(/export function sheetExitDistance\([^)]*\)[^{]*\{\s*'worklet';/);
    expect(source).toMatch(/export function shouldSkipSheetExit\([^)]*\)[^{]*\{\s*'worklet';/);
  });

  it('keeps every helper called from pager gesture worklets workletized', () => {
    const swipeBack = read('src/components/navigation/swipe-back.ts');
    for (const name of [
      'clampSwipeTranslation',
      'swipeTrackedTranslation',
      'shouldCommitSwipeBack',
      'shouldCommitSwipeForward',
    ]) {
      expect(swipeBack).toMatch(
        new RegExp(`export function ${name}\\([^]*?\\{\\s*'worklet';`),
      );
    }
    const tabSwipe = read('src/components/navigation/tab-swipe.ts');
    expect(tabSwipe).toMatch(/export function tabSwipeLane\([^]*?\{\s*'worklet';/);
    expect(tabSwipe).toMatch(/export function tabSwipeTranslateX\([^]*?\{\s*'worklet';/);
  });
});
