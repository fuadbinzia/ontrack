import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  tabSwipeLane,
  tabSwipeTranslateX,
  tabTapLane,
  tabTapSide,
  tabTapStartX,
} from '../tab-swipe';

describe('tab tap pager', () => {
  it('sends a later dock slot in from the right and an earlier slot from the left', () => {
    expect(tabTapSide(0, 3)).toBe('right');
    expect(tabTapSide(3, 0)).toBe('left');
    expect(tabTapSide(1, 1)).toBeNull();
    expect(tabTapSide(2, -1)).toBeNull();
  });

  it('treats a section outside the dock as arriving from the left', () => {
    expect(tabTapSide(-1, 0)).toBe('left');
    expect(tabTapLane('right')).toBe('back');
    expect(tabTapLane('left')).toBe('forward');
  });

  it('offsets the incoming page by a full width so the leaving page stays on screen', () => {
    expect(tabTapStartX('right', 390)).toBe(390);
    expect(tabTapStartX('left', 390)).toBe(-390);
    expect(tabTapStartX('right', 0)).toBe(0);
  });

  it('keeps the leaving tab in the opposite lane while a tap settle runs', () => {
    expect(
      tabSwipeLane('(today)', 'calendar', '(today)', null, '(today)', 'back'),
    ).toBe('back');
    expect(
      tabSwipeLane('calendar', 'calendar', '(today)', null, '(today)', 'back'),
    ).toBe('current');
    expect(
      tabSwipeLane('plants', 'calendar', '(today)', null, '(today)', 'back'),
    ).toBe('idle');
  });

  it('parks idle tabs off-screen instead of fading them to 0', () => {
    expect(tabSwipeTranslateX('idle', 0, 390)).toBe(390);
    expect(tabSwipeTranslateX('current', 390, 390)).toBe(390);
  });

  describe('tab in both the back and forward stacks (A → B → back-swipe)', () => {
    // Repro: today → tap overview → tap Today row → back-swipe to overview.
    // history=[(today)] and forward=[(today)] — the same scene is both
    // neighbors of overview.
    const lane = (swipeX: number) =>
      tabSwipeLane('(today)', 'overview', '(today)', '(today)', null, null, swipeX);

    it('parks on the right while a forward drag (right-to-left) is live', () => {
      expect(lane(-1)).toBe('forward');
      expect(lane(-390)).toBe('forward');
    });

    it('parks on the left while a back drag (left-to-right) is live', () => {
      expect(lane(1)).toBe('back');
      expect(lane(390)).toBe('back');
    });

    it('rests in the back lane at swipeX 0 (off-screen either way)', () => {
      expect(lane(0)).toBe('back');
    });

    it('slides real pixels in from the right on a forward drag', () => {
      // Mid-drag: scene sits just inside the right edge, not absent.
      expect(tabSwipeTranslateX(lane(-100), -100, 390)).toBe(290);
      // Fully dragged: scene lands at rest.
      expect(tabSwipeTranslateX(lane(-390), -390, 390)).toBe(0);
    });

    it('does not disturb single-lane neighbors regardless of drag direction', () => {
      expect(
        tabSwipeLane('(today)', 'overview', '(today)', null, null, null, -100),
      ).toBe('back');
      expect(
        tabSwipeLane('(today)', 'overview', null, '(today)', null, null, 100),
      ).toBe('forward');
    });

    it('lets an active tap settle keep precedence over drag disambiguation', () => {
      expect(
        tabSwipeLane(
          '(today)',
          'overview',
          '(today)',
          '(today)',
          '(today)',
          'forward',
          100,
        ),
      ).toBe('forward');
    });

    it('feeds the live drag offset into the lane resolver on the UI thread', () => {
      const scene = readFileSync(
        join(process.cwd(), 'src/components/navigation/swipe-back-scene.tsx'),
        'utf8',
      );
      expect(scene).toContain('const swipeX = tabSwipeX.value');
      expect(scene).toMatch(
        /lanes\.tapLane,\s*\n\s*swipeX,\s*\n\s*\),\s*\n\s*swipeX,/,
      );
    });
  });

  it('always runs the tap settle rest so a cancelled spring cannot leave dest off-screen', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/navigation/tab-swipe.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/if \(finished && done\)/);
    expect(source).toContain('if (done) runOnJS(done)()');
  });
});
