import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('web delete-account page', () => {
  it('documents in-app deletion and the support email fallback', () => {
    const source = readFileSync(
      join(__dirname, '../delete-account.tsx'),
      'utf8',
    );
    expect(source).toContain('Delete Your onTrack Account');
    expect(source).toContain('Delete Account');
    expect(source).toContain('ONTRACK_SUPPORT_EMAIL');
    expect(source).toMatch(/cannot open the app/i);
  });
});
