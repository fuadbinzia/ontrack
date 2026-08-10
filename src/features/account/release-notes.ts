/**
 * Versioned ship notes. `npm run ship:push` patch-bumps `expo.version` and
 * prepends matching RELEASE_NOTES (user-facing) + CHANGELOG (technical) entries.
 * Newest first. Prefer editing via the push message; manual prepends are fine too.
 * Catalog `date` stays YYYY-MM-DD; UI shows MM/DD/YYYY via formatVersionNotesDate.
 */

export type { VersionNotesEntry } from './release-notes-types';
export { RELEASE_NOTES } from './release-notes-user';
export { CHANGELOG } from './release-notes-changelog';

import { CHANGELOG } from './release-notes-changelog';
import type { VersionNotesEntry } from './release-notes-types';
import { RELEASE_NOTES } from './release-notes-user';

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
