import { CHANGELOG } from '@/constants/release-notes-data';
import changelogData from '@/constants/release-notes-changelog.json';

describe('release-notes-changelog reader ↔ JSON catalog boundary', () => {
  it('exposes exactly the JSON catalog, newest first', () => {
    expect(CHANGELOG).toBe(changelogData);
    expect(CHANGELOG.length).toBeGreaterThan(50);
    for (const entry of CHANGELOG.slice(0, 3)) {
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.notes.length).toBeGreaterThan(0);
    }
  });

  it('keeps the shipped app version on top so ship:push prepends line up', () => {
    const appJson = require('../../../../app.json') as {
      expo: { version: string };
    };
    expect(CHANGELOG[0]?.version).toBe(appJson.expo.version);
  });
});
