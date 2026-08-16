import { RELEASE_NOTES } from '@/constants/release-notes-data';
import releaseNotesData from '@/constants/release-notes-user.json';

describe('release-notes-user reader ↔ JSON catalog boundary', () => {
  it('exposes exactly the JSON catalog, newest first', () => {
    expect(RELEASE_NOTES).toBe(releaseNotesData);
    expect(RELEASE_NOTES.length).toBeGreaterThan(50);
    for (const entry of RELEASE_NOTES.slice(0, 3)) {
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.notes.length).toBeGreaterThan(0);
    }
  });

  it('keeps the shipped app version on top so ship:push prepends line up', () => {
    const appJson = require('../../../../app.json') as {
      expo: { version: string };
    };
    expect(RELEASE_NOTES[0]?.version).toBe(appJson.expo.version);
  });
});
