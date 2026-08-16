import fs from 'fs';
import path from 'path';

import {
  catalogTopVersionDiffers,
  CHANGELOG,
  formatAppVersionLabel,
  formatCurrentAppVersionLabel,
  formatVersionNotesDate,
  formatVersionNotesHeading,
  getChangelog,
  getReleaseNotes,
  groupVersionNotesByDate,
  RELEASE_NOTES,
} from '../release-notes';

const CONSTANTS_DIR = path.resolve(__dirname, '../../../constants');

describe('release-notes catalogs', () => {
  it('keeps Release Notes and Changelog newest-first with aligned top versions', () => {
    expect(RELEASE_NOTES.length).toBeGreaterThan(1);
    expect(CHANGELOG.length).toBeGreaterThan(1);
    expect(RELEASE_NOTES[0]?.version).toBe(CHANGELOG[0]?.version);
    expect(RELEASE_NOTES.map((entry) => entry.version)).toEqual(
      CHANGELOG.map((entry) => entry.version),
    );
    expect(getReleaseNotes()).toBe(RELEASE_NOTES);
    expect(getChangelog()).toBe(CHANGELOG);
  });

  it('keeps catalog data in JSON so ship prepends never regrow the code readers', () => {
    // Regression: release-notes-user.ts hit 737 lines and tripped the token
    // budget because ship:push prepended entries into TypeScript source.
    const reader = fs.readFileSync(
      path.join(CONSTANTS_DIR, 'release-notes-data.ts'),
      'utf8',
    );
    expect(reader.split('\n').length).toBeLessThan(30);
    expect(reader).not.toMatch(/version:\s*'/);
    for (const data of [
      'release-notes-user.json',
      'release-notes-changelog.json',
    ]) {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(CONSTANTS_DIR, data), 'utf8'),
      ) as unknown;
      expect(Array.isArray(parsed)).toBe(true);
    }
  });

  it('keeps catalog entries well-formed and strictly version-descending', () => {
    const semverKey = (version: string) =>
      version.split('.').map((part) => Number(part).toString().padStart(6, '0')).join('.');
    for (const catalog of [RELEASE_NOTES, CHANGELOG]) {
      for (const entry of catalog) {
        expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entry.notes.length).toBeGreaterThan(0);
        for (const note of entry.notes) expect(note.trim().length).toBeGreaterThan(0);
      }
      for (let i = 1; i < catalog.length; i += 1) {
        expect(
          semverKey(catalog[i - 1]!.version) > semverKey(catalog[i]!.version),
        ).toBe(true);
      }
    }
  });

  it('formats the Profile version label with and without build', () => {
    expect(formatAppVersionLabel('1.0.2', undefined)).toBe('Version 1.0.2');
    expect(formatAppVersionLabel('1.0.2', '42')).toBe('Version 1.0.2 (42)');
    expect(formatAppVersionLabel('—')).toBe('Version —');
  });

  it('formats the App Updates current-version label', () => {
    expect(formatCurrentAppVersionLabel('1.0.2', undefined)).toBe(
      'Current Version: 1.0.2',
    );
    expect(formatCurrentAppVersionLabel('1.0.2', '42')).toBe(
      'Current Version: 1.0.2 (42)',
    );
  });

  it('detects catalog vs runtime version mismatch', () => {
    expect(catalogTopVersionDiffers(RELEASE_NOTES, RELEASE_NOTES[0]!.version)).toBe(
      false,
    );
    expect(catalogTopVersionDiffers(RELEASE_NOTES, '9.9.9')).toBe(true);
    expect(catalogTopVersionDiffers([], '1.0.2')).toBe(false);
  });

  it('formats catalog dates as MM/DD/YYYY', () => {
    expect(formatVersionNotesDate('2026-08-07')).toBe('08/07/2026');
    expect(formatVersionNotesHeading({ version: '1.0.2', date: '2026-08-07' })).toBe(
      '1.0.2 · 08/07/2026',
    );
  });

  it('groups notes by day with latest day and version on top', () => {
    const grouped = groupVersionNotesByDate([
      {
        version: '1.0.3',
        date: '2026-08-07',
        notes: ['c'],
      },
      {
        version: '1.0.2',
        date: '2026-08-07',
        notes: ['b'],
      },
      {
        version: '1.0.1',
        date: '2026-07-15',
        notes: ['a'],
      },
    ]);
    expect(grouped.map((day) => day.date)).toEqual(['2026-08-07', '2026-07-15']);
    expect(grouped[0]?.entries.map((entry) => entry.version)).toEqual([
      '1.0.3',
      '1.0.2',
    ]);
  });
});
