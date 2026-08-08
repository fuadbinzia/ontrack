import Constants from 'expo-constants';

import { isDateKey } from '@/utils/date';

/**
 * Versioned ship notes. `npm run ship:push` patch-bumps `expo.version` and
 * prepends matching RELEASE_NOTES (user-facing) + CHANGELOG (technical) entries.
 * Newest first. Prefer editing via the push message; manual prepends are fine too.
 * Catalog `date` stays YYYY-MM-DD; UI shows MM/DD/YYYY via formatVersionNotesDate.
 */

export type VersionNotesEntry = {
  version: string;
  /** YYYY-MM-DD (display as MM/DD/YYYY). */
  date: string;
  notes: string[];
};

/** User-facing; plain language — what’s new for people using the app. */
export const RELEASE_NOTES: VersionNotesEntry[] = [
  {
    version: '1.0.16',
    date: '2026-08-08',
    notes: [
      'Fold ScreenHeader eyebrow into labeled HeaderBackButton so the whole overline row is the back hit target.',
    ],
  },
  {
    version: '1.0.15',
    date: '2026-08-08',
    notes: [
      'Put bottom-nav recents left of center for browse-through, and only open the weather location sheet on Today.',
    ],
  },
  {
    version: '1.0.14',
    date: '2026-08-08',
    notes: [
      'Ship app-wide glass chrome, travel itinerary frost polish, and agent-ui verify hang tooling.',
    ],
  },
  {
    version: '1.0.13',
    date: '2026-08-08',
    notes: [
      'Harden agent Android pool (GPU + fast kill), polish travel covers/hero, and split activity-form sections.',
    ],
  },
  {
    version: '1.0.12',
    date: '2026-08-08',
    notes: [
      'Ship vision board glass surfaces and clearer SheetScaffold frost with home-location glass CTAs.',
    ],
  },
  {
    version: '1.0.11',
    date: '2026-08-08',
    notes: [
      'Move Home location onto glass SheetScaffold with theme-accent primary CTA.',
    ],
  },
  {
    version: '1.0.10',
    date: '2026-08-08',
    notes: [
      'Ship app-wide glass UI and nest feature stacks under tabs so bottom nav stays on full pages.',
    ],
  },
  {
    version: '1.0.9',
    date: '2026-08-08',
    notes: [
      'Polish itinerary sky-to-dates and editorial type; restart quiet agent devices; reaffirm Dev Mode travel-home seeds.',
    ],
  },
  {
    version: '1.0.8',
    date: '2026-08-08',
    notes: [
      'Polish travel trip-card frost scoop valley swoop with mid-glow mist and clearer carousel ticks.',
    ],
  },
  {
    version: '1.0.7',
    date: '2026-08-08',
    notes: [
      'Soften travel trip-card frost scoop into a two-cubic swoop with a feathered milk lip.',
    ],
  },
  {
    version: '1.0.6',
    date: '2026-08-08',
    notes: [
      'Instant Dev Mode toggle (background snapshot backup) and denser single-line travel trip-card frost scoop.',
    ],
  },
  {
    version: '1.0.5',
    date: '2026-08-07',
    notes: [
      'Smooth bottom-nav tab settles, polish travel home/itinerary chrome, and fix static-tier sky wash on constrained Android.',
    ],
  },
  {
    version: '1.0.4',
    date: '2026-08-07',
    notes: [
      'Polish travel home Your Trips band (search chrome, frost scoop, curated atmosphere) and developer release notes hub.',
    ],
  },
  {
    version: '1.0.3',
    date: '2026-08-07',
    notes: [
      'Polish travel home trip cards and landmark covers; add static destination sky and developer release notes.',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-08-07',
    notes: [
      'Travel Home trip cards show clearer dates, location, and itinerary actions.',
      'Itinerary sky and destination covers feel more polished across devices.',
      'Profile now shows the app version at the bottom for support.',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-07-15',
    notes: [
      'Stability and polish across Travel, checklists, and account screens.',
      'Faster refresh when switching between tabs on day-to-day devices.',
    ],
  },
];

/** Technical; modules, migrations, OTA/runtime, agent-ui, known constraints. */
export const CHANGELOG: VersionNotesEntry[] = [
  {
    version: '1.0.16',
    date: '2026-08-08',
    notes: [
      'Fold ScreenHeader eyebrow into labeled HeaderBackButton so the whole overline row is the back hit target.',
      'Touched: features/design-system.',
    ],
  },
  {
    version: '1.0.15',
    date: '2026-08-08',
    notes: [
      'Put bottom-nav recents left of center for browse-through, and only open the weather location sheet on Today.',
      'Touched: features/daily-tracking.',
    ],
  },
  {
    version: '1.0.14',
    date: '2026-08-08',
    notes: [
      'Ship app-wide glass chrome, travel itinerary frost polish, and agent-ui verify hang tooling.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.13',
    date: '2026-08-08',
    notes: [
      'Harden agent Android pool (GPU + fast kill), polish travel covers/hero, and split activity-form sections.',
      'Touched: app routes, features/account.',
    ],
  },
  {
    version: '1.0.12',
    date: '2026-08-08',
    notes: [
      'Ship vision board glass surfaces and clearer SheetScaffold frost with home-location glass CTAs.',
      'Touched: features/daily-tracking, features/vision-board.',
    ],
  },
  {
    version: '1.0.11',
    date: '2026-08-08',
    notes: [
      'Move Home location onto glass SheetScaffold with theme-accent primary CTA.',
      'Touched: features/daily-tracking.',
    ],
  },
  {
    version: '1.0.10',
    date: '2026-08-08',
    notes: [
      'Ship app-wide glass UI and nest feature stacks under tabs so bottom nav stays on full pages.',
      'Touched: design, app routes.',
    ],
  },
  {
    version: '1.0.9',
    date: '2026-08-08',
    notes: [
      'Polish itinerary sky-to-dates and editorial type; restart quiet agent devices; reaffirm Dev Mode travel-home seeds.',
      'Touched: features/account, features/travel.',
    ],
  },
  {
    version: '1.0.8',
    date: '2026-08-08',
    notes: [
      'Polish travel trip-card frost scoop valley swoop with mid-glow mist and clearer carousel ticks.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.7',
    date: '2026-08-08',
    notes: [
      'Soften travel trip-card frost scoop into a two-cubic swoop with a feathered milk lip.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.6',
    date: '2026-08-08',
    notes: [
      'Instant Dev Mode toggle (background snapshot backup) and denser single-line travel trip-card frost scoop.',
      'Touched: features/account, features/travel.',
    ],
  },
  {
    version: '1.0.5',
    date: '2026-08-07',
    notes: [
      'Smooth bottom-nav tab settles, polish travel home/itinerary chrome, and fix static-tier sky wash on constrained Android.',
      'Touched: app routes, features/travel.',
    ],
  },
  {
    version: '1.0.4',
    date: '2026-08-07',
    notes: [
      'Polish travel home Your Trips band (search chrome, frost scoop, curated atmosphere) and developer release notes hub.',
      'Touched: app routes, features/account.',
    ],
  },
  {
    version: '1.0.3',
    date: '2026-08-07',
    notes: [
      'Polish travel home trip cards and landmark covers; add static destination sky and developer release notes.',
      'Touched: design, app routes, features/account.',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-08-07',
    notes: [
      'Travel sky quality tiers (full→static) + destination-cover landmark queries.',
      'Travel Home trip card frost scoop, date row, and agent-ui list asserts.',
      'Developer Tools: Release Notes / Changelog catalogs keyed to expo.version.',
      'Runtime version via expo-constants (nativeAppVersion ?? expoConfig.version).',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-07-15',
    notes: [
      'EAS OTA on device channel; runtimeVersion policy remains appVersion.',
      'Agent-ui verify-both headless pool + Dev Mode release on close-out.',
    ],
  },
];

function safeLabel(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

/**
 * Marketing version from the running JS config (OTA-aware), falling back to the
 * native binary version when config is unavailable.
 */
export function getAppVersion(): string {
  return (
    safeLabel(Constants.expoConfig?.version) ??
    safeLabel(Constants.nativeAppVersion) ??
    '—'
  );
}

/** Native build number / versionCode when available. */
export function getAppBuild(): string | undefined {
  return (
    safeLabel(Constants.nativeBuildVersion) ??
    safeLabel(Constants.expoConfig?.ios?.buildNumber) ??
    safeLabel(Constants.expoConfig?.android?.versionCode)
  );
}

/** Profile footer label, e.g. `Version 1.0.2` or `Version 1.0.2 (42)`. */
export function formatAppVersionLabel(
  version: string = getAppVersion(),
  build: string | undefined = getAppBuild(),
): string {
  if (!version || version === '—') return 'Version —';
  return build ? `Version ${version} (${build})` : `Version ${version}`;
}

/** App Updates header, e.g. `Current Version: 1.0.2` or `Current Version: 1.0.2 (42)`. */
export function formatCurrentAppVersionLabel(
  version: string = getAppVersion(),
  build: string | undefined = getAppBuild(),
): string {
  if (!version || version === '—') return 'Current Version: —';
  return build
    ? `Current Version: ${version} (${build})`
    : `Current Version: ${version}`;
}

export function getReleaseNotes(): VersionNotesEntry[] {
  return RELEASE_NOTES;
}

export function getChangelog(): VersionNotesEntry[] {
  return CHANGELOG;
}

/** True when the newest catalog entry doesn’t match the running app version. */
export function catalogTopVersionDiffers(
  catalog: readonly VersionNotesEntry[],
  runtimeVersion: string = getAppVersion(),
): boolean {
  const top = catalog[0]?.version;
  if (!top || !runtimeVersion || runtimeVersion === '—') return false;
  return top !== runtimeVersion;
}

/** Display catalog dates as MM/DD/YYYY (catalog stores YYYY-MM-DD). */
export function formatVersionNotesDate(dateKey: string): string {
  if (!isDateKey(dateKey)) return dateKey;
  const [year, month, day] = dateKey.split('-');
  return `${month}/${day}/${year}`;
}

/** Version header line, e.g. `1.0.2 · 08/07/2026`. */
export function formatVersionNotesHeading(entry: Pick<VersionNotesEntry, 'version' | 'date'>): string {
  return `${entry.version} · ${formatVersionNotesDate(entry.date)}`;
}

export type VersionNotesDayGroup = {
  date: string;
  /** Newest first within the day. */
  entries: VersionNotesEntry[];
};

/**
 * Group catalog rows by ship date. Days and versions within a day stay newest-first
 * (assumes `entries` is already newest-first).
 */
export function groupVersionNotesByDate(
  entries: readonly VersionNotesEntry[],
): VersionNotesDayGroup[] {
  const groups: VersionNotesDayGroup[] = [];
  const indexByDate = new Map<string, number>();

  for (const entry of entries) {
    const existing = indexByDate.get(entry.date);
    if (existing === undefined) {
      indexByDate.set(entry.date, groups.length);
      groups.push({ date: entry.date, entries: [entry] });
      continue;
    }
    groups[existing]!.entries.push(entry);
  }

  return groups;
}
