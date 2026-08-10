import Constants from 'expo-constants';

import { isDateKey } from '@/utils/date';

import type { VersionNotesEntry } from './release-notes-types';

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
