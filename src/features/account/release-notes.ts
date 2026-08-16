/**
 * Versioned ship notes. `npm run ship:push` patch-bumps `expo.version` and
 * prepends matching entries into src/constants/release-notes-user.json
 * (user-facing) + release-notes-changelog.json (technical). Newest first.
 * Prefer editing via the push message; manual JSON prepends are fine too.
 * Catalog `date` stays YYYY-MM-DD; UI shows MM/DD/YYYY via formatVersionNotesDate.
 */

import { CHANGELOG, RELEASE_NOTES } from '@/constants/release-notes-data';

import type { VersionNotesEntry } from './release-notes-types';

export type { VersionNotesEntry } from './release-notes-types';
export { CHANGELOG, RELEASE_NOTES } from '@/constants/release-notes-data';

export function getReleaseNotes(): VersionNotesEntry[] {
  return RELEASE_NOTES;
}

export function getChangelog(): VersionNotesEntry[] {
  return CHANGELOG;
}

export {
  catalogTopVersionDiffers,
  formatAppVersionLabel,
  formatCurrentAppVersionLabel,
  formatVersionNotesDate,
  formatVersionNotesHeading,
  getAppBuild,
  getAppVersion,
  groupVersionNotesByDate,
  type VersionNotesDayGroup,
} from './release-notes-format';
