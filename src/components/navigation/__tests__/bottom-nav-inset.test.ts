import { layout, spacing } from '@/design-system';

import {
  BOTTOM_NAV_Z_INDEX,
  bottomNavBottomPad,
  bottomNavContentInset,
  pagerSceneCoversDock,
} from '../bottom-nav-inset';

describe('pager scene stacking vs the dock', () => {
  it('covers the dock when a pager scene has transform and the dock has no zIndex', () => {
    expect(pagerSceneCoversDock(true, 0)).toBe(true);
  });

  it('keeps the dock visible when it stacks above the transformed pager', () => {
    expect(pagerSceneCoversDock(true, BOTTOM_NAV_Z_INDEX)).toBe(false);
    expect(pagerSceneCoversDock(false, 0)).toBe(false);
    expect(pagerSceneCoversDock(true, -1)).toBe(true);
  });
});

describe('bottomNavBottomPad', () => {
  it('lifts the dock by the full Android system nav inset', () => {
    expect(bottomNavBottomPad(48, 8, 'android')).toBe(48);
  });

  it('uses compact spacing when Android reports no bottom inset', () => {
    expect(bottomNavBottomPad(0, 8, 'android')).toBe(8);
  });

  it('keeps the iOS home-indicator pad small', () => {
    expect(bottomNavBottomPad(34, 8, 'ios')).toBe(6);
  });

  it('uses compact spacing when iOS reports no bottom inset', () => {
    expect(bottomNavBottomPad(0, 8, 'ios')).toBe(8);
  });
});

describe('bottomNavContentInset', () => {
  it('clears the full Android dock (bar + system nav) with content air', () => {
    expect(bottomNavContentInset(48, 8, 'android')).toBe(
      layout.bottomNavBarBaseHeight + 48 + spacing.md,
    );
  });

  it('clears the iOS dock with the small home-indicator pad and content air', () => {
    expect(bottomNavContentInset(34, 8, 'ios')).toBe(
      layout.bottomNavBarBaseHeight + 6 + spacing.md,
    );
  });

  it('is taller than the legacy tabBarInset + insets shortcut', () => {
    // Screen used to pad insets.bottom + tabBarInset(44), which undershot the
    // 58pt bar and let Profile "Features" frost through the glass dock.
    const legacy = 48 + layout.tabBarInset;
    const next = bottomNavContentInset(48, 8, 'android');
    expect(next).toBeGreaterThan(legacy);
  });

  it('allows callers to override the content gap', () => {
    expect(bottomNavContentInset(34, 8, 'ios', layout.bottomNavBarBaseHeight, 0)).toBe(
      layout.bottomNavBarBaseHeight + 6,
    );
  });
});
