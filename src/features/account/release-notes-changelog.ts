import type { VersionNotesEntry } from './release-notes-types';

/** Technical; modules, migrations, OTA/runtime, agent-ui, known constraints. */
export const CHANGELOG: VersionNotesEntry[] = [
  {
    version: '1.0.55',
    date: '2026-08-12',
    notes: [
      'Add Finance add-on and StraiAway partner stay import.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.54',
    date: '2026-08-12',
    notes: [
      'Support multi-assignee checklist items.',
      'Touched: features/food, features/todos.',
    ],
  },
  {
    version: '1.0.53',
    date: '2026-08-12',
    notes: [
      'Keep checklist new-category input above the iOS keyboard.',
      'Ship via ship:push (TestFlight + device OTA).',
    ],
  },
  {
    version: '1.0.52',
    date: '2026-08-12',
    notes: [
      'Ship current main to TestFlight.',
      'Ship via ship:push (TestFlight + device OTA).',
    ],
  },
  {
    version: '1.0.51',
    date: '2026-08-12',
    notes: [
      'Add Google Calendar sync and checklist categories.',
      'Touched: app routes, features/account.',
    ],
  },
  {
    version: '1.0.50',
    date: '2026-08-12',
    notes: [
      'Improve dark timeline contrast.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.49',
    date: '2026-08-12',
    notes: [
      'Improve travel map performance and country accuracy.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.48',
    date: '2026-08-12',
    notes: [
      'Fix OTA crash and profile location navigation.',
      'Touched: app routes, features/account.',
    ],
  },
  {
    version: '1.0.47',
    date: '2026-08-12',
    notes: [
      'Improve app performance and date formatting.',
      'Touched: app routes, features/todos, features/travel.',
    ],
  },
  {
    version: '1.0.46',
    date: '2026-08-11',
    notes: [
      'Fix tracker navigation, todo selection, and Google account chooser.',
      'Touched: app routes, features/todos, features/trackers.',
    ],
  },
  {
    version: '1.0.45',
    date: '2026-08-11',
    notes: [
      'Add collaborative travel map and performance monitoring.',
      'Touched: app routes, features/account.',
    ],
  },
  {
    version: '1.0.44',
    date: '2026-08-10',
    notes: [
      'Polish travel itinerary: moment photos strip/lightbox, reveal new stops, plan-detail skeleton, Pre/Post-trip buckets, and sheet/DateField chrome fixes.',
      'Touched: app routes, features/travel.',
    ],
  },
  {
    version: '1.0.43',
    date: '2026-08-10',
    notes: [
      'Clarify Sections reorder copy (navigation bar, drop More footnote).',
      'Touched: features/trackers.',
    ],
  },
  {
    version: '1.0.42',
    date: '2026-08-10',
    notes: [
      'Swipe-dismiss sheets, fix photo picker Modal race, and clear travel chat menus above the tab dock.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.41',
    date: '2026-08-10',
    notes: [
      'Make bottom-nav tab hops instant by keeping scenes attached and eager-mounting bar pins.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.40',
    date: '2026-08-10',
    notes: [
      'Peel oversized travel, sync, agent-ui, and todos modules under LOC limits.',
      'Touched: app routes, features/account, features/auth.',
    ],
  },
  {
    version: '1.0.39',
    date: '2026-08-10',
    notes: [
      'Fix Android Expo Dev Menu blocker, tab-dock content bleed, and see-through sheet glass.',
      'Touched: features/todos.',
    ],
  },
  {
    version: '1.0.38',
    date: '2026-08-10',
    notes: [
      'Fix Android Google sign-in callback race and triple-slash scheme matching.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.37',
    date: '2026-08-10',
    notes: [
      'Collapse Today weather to one full-width banner when home and current match.',
      'Touched: features/daily-tracking.',
    ],
  },
  {
    version: '1.0.36',
    date: '2026-08-10',
    notes: [
      'Lift Android tab dock above system nav; pin device OTA channel headers.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.35',
    date: '2026-08-10',
    notes: [
      'Ship sheet grabber dismiss, profile identity editor, calendar shine, traveler +N stack, and weather place labels.',
      'Touched: design, app routes.',
    ],
  },
  {
    version: '1.0.34',
    date: '2026-08-10',
    notes: [
      'Add use-sync-external-store so EAS OTA export resolves zustand.',
      'Ship via ship:push (TestFlight + device OTA).',
    ],
  },
  {
    version: '1.0.33',
    date: '2026-08-10',
    notes: [
      'Ship travel group chat glass shell with docked composer, profile city autofind/home weather, and multi-cover trip heroes.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.32',
    date: '2026-08-09',
    notes: [
      'Ship pinned tab bar with Trackers hub, denser itinerary glass under expanded flights, and stronger stay/flight confirmation imports.',
      'Touched: app routes, features/travel.',
    ],
  },
  {
    version: '1.0.31',
    date: '2026-08-09',
    notes: [
      'Widen auth orbit and planet so welcome copy fits on the disc with clear icon gaps.',
      'Touched: features/auth.',
    ],
  },
  {
    version: '1.0.30',
    date: '2026-08-09',
    notes: [
      'Restore centered full-circle auth constellation orbit around the copy.',
      'Touched: features/auth.',
    ],
  },
  {
    version: '1.0.29',
    date: '2026-08-09',
    notes: [
      'Simplify auth constellation placement and quiet the brand mark.',
      'Touched: features/auth.',
    ],
  },
  {
    version: '1.0.28',
    date: '2026-08-09',
    notes: [
      'Refresh auth Dusty Blue shell, orbit constellation, and glass PeoplePicker.',
      'Touched: features/auth.',
    ],
  },
  {
    version: '1.0.27',
    date: '2026-08-09',
    notes: [
      'Fix food-stack back navigation and enlarge labeled header back hit targets.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.26',
    date: '2026-08-09',
    notes: [
      'Remove itinerary share gate; trip-wide visibility for all stops.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.25',
    date: '2026-08-09',
    notes: [
      'Edit moments and activities from the itinerary timeline.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.24',
    date: '2026-08-09',
    notes: [
      'Collapse all Developer Tools sections by default.',
      'Touched: features/account.',
    ],
  },
  {
    version: '1.0.23',
    date: '2026-08-09',
    notes: [
      'Polish auth boot loader, constellation clearance, active SSO provider label, and post-sign-out welcome shell.',
      'Touched: app routes, features/account, features/auth.',
    ],
  },
  {
    version: '1.0.22',
    date: '2026-08-09',
    notes: [
      'Ship Food tab (recipes, plan, pantry, scan, community) with guest auth polish and agent account login.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.21',
    date: '2026-08-08',
    notes: [
      'Tune itinerary star glisten for clearer but restrained sparkle.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.20',
    date: '2026-08-08',
    notes: [
      'Blend itinerary mountain frost into soft melt gradients; keep live headed Galaxy safe during pool verify.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.19',
    date: '2026-08-08',
    notes: [
      'Add frost caps on itinerary sky mountain peaks.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.18',
    date: '2026-08-08',
    notes: [
      'Paint itinerary night stars cool blue-white like real stellar light.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.17',
    date: '2026-08-08',
    notes: [
      'Tint itinerary glass from destination artwork and add GlassPlate tintColor for frosted dynamic fills.',
      'Touched: app routes, features/design-system, features/travel.',
    ],
  },
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
