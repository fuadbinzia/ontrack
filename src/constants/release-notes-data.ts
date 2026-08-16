import type { VersionNotesEntry } from '@/features/account/release-notes-types';

import changelogData from './release-notes-changelog.json';
import releaseNotesData from './release-notes-user.json';

/**
 * Versioned ship-note catalogs (newest first). `npm run ship:push` prepends
 * entries into the JSON files, so these typed readers never grow.
 * RELEASE_NOTES is user-facing plain language; CHANGELOG is technical.
 */
export const RELEASE_NOTES: VersionNotesEntry[] = releaseNotesData;
export const CHANGELOG: VersionNotesEntry[] = changelogData;
