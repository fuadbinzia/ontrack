import {
  ADDONS,
  ALL_ADDONS_ON,
  DEFAULT_ADDON_STATE,
} from '@/addons/registry';
import {
  DEFAULT_PINNED_COUNT,
  DEFAULT_TRACKER_ORDER,
} from '@/components/navigation/tab-pins';

import { moreListRoutes, visibleMoreRoutes } from '../tracker-presence';

function listedRoutes(
  enabledAddons: Record<string, boolean>,
): string[] {
  const { inNav, others } = moreListRoutes(
    DEFAULT_TRACKER_ORDER,
    enabledAddons,
    DEFAULT_PINNED_COUNT,
  );
  return [...inNav, ...others];
}

describe('tracker presence', () => {
  it('keeps Journal in More when the add-on is on and the page is empty', () => {
    expect(visibleMoreRoutes(['profile', 'journal'])).toEqual([
      'profile',
      'journal',
    ]);
  });

  it('lists every turned-on add-on in More', () => {
    const previous = process.env.EXPO_OS;
    process.env.EXPO_OS = 'ios';
    try {
      for (const addon of ADDONS) {
        if (!addon.tabRoute) continue;
        expect(DEFAULT_TRACKER_ORDER).toContain(addon.tabRoute);
        expect(
          listedRoutes({ ...DEFAULT_ADDON_STATE, [addon.id]: true }),
        ).toContain(addon.tabRoute);
      }
    } finally {
      process.env.EXPO_OS = previous;
    }
  });

  it('omits every turned-off add-on from More', () => {
    const listed = new Set(listedRoutes(DEFAULT_ADDON_STATE));
    for (const addon of ADDONS) {
      if (!addon.tabRoute) continue;
      expect(listed.has(addon.tabRoute)).toBe(false);
    }
  });

  it('lists the full enabled catalog together', () => {
    const previous = process.env.EXPO_OS;
    process.env.EXPO_OS = 'ios';
    try {
      const listed = listedRoutes(ALL_ADDONS_ON);
      for (const addon of ADDONS) {
        if (!addon.tabRoute) continue;
        expect(listed).toContain(addon.tabRoute);
      }
    } finally {
      process.env.EXPO_OS = previous;
    }
  });

  it('does not invent More rows that are not already enabled', () => {
    expect(visibleMoreRoutes(['profile'])).toEqual(['profile']);
    expect(visibleMoreRoutes([])).toEqual([]);
  });
});
