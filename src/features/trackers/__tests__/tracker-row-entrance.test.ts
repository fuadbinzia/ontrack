import {
  ROW_ENTER_STAGGER_MAX,
  ROW_ENTER_STAGGER_MS,
  TRACKER_ROW_HIDDEN_POSE,
  TRACKER_ROW_REST_POSE,
  trackerRowDragPose,
  trackerRowEnterDelay,
  trackerRowMountPose,
} from '../tracker-row-entrance';

describe('tracker row entrance', () => {
  it('starts hidden so the settled list never flashes before the bounce', () => {
    expect(trackerRowMountPose(false)).toEqual(TRACKER_ROW_HIDDEN_POSE);
    expect(trackerRowMountPose(undefined)).toEqual(TRACKER_ROW_HIDDEN_POSE);
    expect(trackerRowMountPose(null)).toEqual(TRACKER_ROW_HIDDEN_POSE);
  });

  it('skips the hidden start when reduce motion is on', () => {
    expect(trackerRowMountPose(true)).toEqual(TRACKER_ROW_REST_POSE);
  });

  it('keeps rest after a drag so releasing a row does not replay the bounce', () => {
    expect(trackerRowDragPose()).toEqual(TRACKER_ROW_REST_POSE);
  });

  it('caps stagger so long catalogs still settle quickly', () => {
    expect(trackerRowEnterDelay(0)).toBe(0);
    expect(trackerRowEnterDelay(3)).toBe(3 * ROW_ENTER_STAGGER_MS);
    expect(trackerRowEnterDelay(ROW_ENTER_STAGGER_MAX + 8)).toBe(
      ROW_ENTER_STAGGER_MAX * ROW_ENTER_STAGGER_MS,
    );
    expect(trackerRowEnterDelay(-2)).toBe(0);
  });
});
