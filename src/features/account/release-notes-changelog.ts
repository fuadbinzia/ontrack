import type { VersionNotesEntry } from './release-notes-types';
import { CHANGELOG_ARCHIVE } from './release-notes-changelog-archive';

/** Technical; modules, migrations, OTA/runtime, agent-ui, known constraints. */
export const CHANGELOG: VersionNotesEntry[] = [
  {
    version: '1.0.95',
    date: '2026-08-15',
    notes: [
      'Hide idle add-ons in More until they have data, and let Today add Event, Meal, Checklist, or Journal.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.94',
    date: '2026-08-15',
    notes: [
      'Add Journal add-on with dated private pages, dictate, and local voice notes.',
      'Touched: app routes, features/account, features/trackers.',
    ],
  },
  {
    version: '1.0.93',
    date: '2026-08-15',
    notes: [
      'Keep Build Care Plan working when the plant model fails.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.92',
    date: '2026-08-15',
    notes: [
      'Remove prefilling calendar data for new and existing users.',
      'Ship via ship:push (TestFlight + device OTA).',
    ],
  },
  {
    version: '1.0.91',
    date: '2026-08-15',
    notes: [
      'Chore: sync changes.',
      'Touched: app routes, features/daily-tracking, features/finance.',
    ],
  },
  {
    version: '1.0.90',
    date: '2026-08-15',
    notes: [
      'Fix plant modal dark-mode contrast.',
      'Ship queued updates.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.89',
    date: '2026-08-15',
    notes: [
      'Keep push releases OTA-only.',
      'Ship via ship:push (TestFlight + device OTA).',
    ],
  },
  {
    version: '1.0.88',
    date: '2026-08-15',
    notes: [
      'Improve calendar sync and daily activity experiences.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.87',
    date: '2026-08-15',
    notes: [
      'Polish friend invite handoff.',
      'Touched: app routes, features/auth.',
    ],
  },
  {
    version: '1.0.86',
    date: '2026-08-14',
    notes: [
      'Improve adaptive themes and travel collaboration.',
      'Touched: app routes, features/design-system, features/travel.',
    ],
  },
  {
    version: '1.0.85',
    date: '2026-08-14',
    notes: [
      'Add customizable app appearance themes.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.84',
    date: '2026-08-14',
    notes: [
      'Fix travel roster invite reconciliation.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.83',
    date: '2026-08-14',
    notes: [
      'Improve themes, calendar, collaboration, and daily workflows.',
      'Touched: app routes, features/analytics, features/daily-tracking.',
    ],
  },
  {
    version: '1.0.82',
    date: '2026-08-14',
    notes: [
      'Add finance rewards, subscriptions, and smarter transaction tracking.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.81',
    date: '2026-08-14',
    notes: [
      'Expand privacy and terms disclosures.',
      'Touched: features/account.',
    ],
  },
  {
    version: '1.0.80',
    date: '2026-08-14',
    notes: [
      'Add E-ZPass imports and improve collaboration.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.79',
    date: '2026-08-14',
    notes: [
      'Polish fighter portraits and overview navigation.',
      'Touched: app routes, features/events, features/overview.',
    ],
  },
  {
    version: '1.0.78',
    date: '2026-08-14',
    notes: [
      'Reset Today timeline date from Overview.',
      'Touched: features/overview.',
    ],
  },
  {
    version: '1.0.77',
    date: '2026-08-14',
    notes: [
      'Polish UFC fight details and hide unavailable stats.',
      'Touched: app routes, features/events.',
    ],
  },
  {
    version: '1.0.76',
    date: '2026-08-14',
    notes: [
      'Add event tracking, Teller sync, and activity details.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.75',
    date: '2026-08-13',
    notes: [
      'Improve app reliability and development tooling.',
      'Ship via ship:push (TestFlight + device OTA).',
    ],
  },
  {
    version: '1.0.74',
    date: '2026-08-13',
    notes: [
      'Add anonymous device flow attribution.',
      'Touched: features/account, supabase.',
    ],
  },
  {
    version: '1.0.73',
    date: '2026-08-13',
    notes: [
      'Fix analytics release environment tagging.',
      'Ship via ship:push (TestFlight + device OTA).',
    ],
  },
  {
    version: '1.0.72',
    date: '2026-08-13',
    notes: [
      'Ship live flow analytics and latency map.',
      'Touched: features/account, features/analytics, features/auth.',
    ],
  },
  {
    version: '1.0.71',
    date: '2026-08-13',
    notes: [
      'Open app on Overview by default.',
      'Touched: app routes, features/auth.',
    ],
  },
  {
    version: '1.0.70',
    date: '2026-08-13',
    notes: [
      'Add app-wide overview and direct crash reporting.',
      'Touched: app routes, features/trackers.',
    ],
  },
  {
    version: '1.0.69',
    date: '2026-08-13',
    notes: [
      'Hide checklist count in bottom navigation.',
      'Ship via ship:push (TestFlight + device OTA).',
    ],
  },
  {
    version: '1.0.68',
    date: '2026-08-13',
    notes: [
      'Guard OTA runtime compatibility.',
      'Ship via ship:push (TestFlight + device OTA).',
    ],
  },
  {
    version: '1.0.67',
    date: '2026-08-13',
    notes: [
      'Improve calendar sync and activity reliability.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.66',
    date: '2026-08-13',
    notes: [
      'Fix recurring and all-day calendar events.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.65',
    date: '2026-08-13',
    notes: [
      'Improve travel map browsing and city selection.',
      'Touched: features/travel.',
    ],
  },
  {
    version: '1.0.64',
    date: '2026-08-12',
    notes: [
      'Polish travel trip tools and globe map.',
      'Touched: app routes, features/travel.',
    ],
  },
  {
    version: '1.0.63',
    date: '2026-08-12',
    notes: [
      'Expand collaborative lists, trip tools, and native travel support.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.62',
    date: '2026-08-12',
    notes: [
      'Move checklist progress into the title header.',
      'Touched: features/todos.',
    ],
  },
  {
    version: '1.0.61',
    date: '2026-08-12',
    notes: [
      'Harden integrations, account reset, and sync reliability.',
      'Touched: app routes.',
    ],
  },
  {
    version: '1.0.60',
    date: '2026-08-12',
    notes: [
      'Use static Siri phrases so App Intents can export.',
      'Ship via ship:push (TestFlight + device OTA).',
    ],
  },
  {
    version: '1.0.59',
    date: '2026-08-12',
    notes: [
      'Fix Siri voice Swift linking in the iOS prebuild.',
      'Ship via ship:push (TestFlight + device OTA).',
    ],
  },
  {
    version: '1.0.58',
    date: '2026-08-12',
    notes: [
      'Let TestFlight native installs skip optional sharp.',
      'Ship via ship:push (TestFlight + device OTA).',
    ],
  },
  {
    version: '1.0.57',
    date: '2026-08-12',
    notes: [
      'Share one voice store with Siri and Assistant, and peel the checklists overview.',
      'Touched: features/todos.',
    ],
  },
  {
    version: '1.0.56',
    date: '2026-08-12',
    notes: [
      'Let Siri and Assistant add and read checklists, and keep lists ordered by recent edits.',
      'Touched: features/daily-tracking, features/todos.',
    ],
  },
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
  ...CHANGELOG_ARCHIVE,
];
