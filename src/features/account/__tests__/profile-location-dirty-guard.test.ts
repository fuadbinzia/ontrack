import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Profile current-location dirty guard', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/features/account/profile-location-preferences.tsx'),
    'utf8',
  );

  it('updates the synchronous dirty ref before starting an async GPS lookup', () => {
    const locateCurrent = source.slice(source.indexOf('const locateCurrent = () =>'));
    const markDirty = locateCurrent.indexOf('writeCurrentDraft(currentDraftRef.current, true)');
    const lookup = locateCurrent.indexOf('getCurrentPlaceLabel()');

    expect(markDirty).toBeGreaterThanOrEqual(0);
    expect(markDirty).toBeLessThan(lookup);
    expect(source).not.toContain('setCurrentDirty');
  });
});
