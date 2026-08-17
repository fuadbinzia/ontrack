import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('store permission copy', () => {
  it('lists real camera and photo uses and drops Android fine location', () => {
    const appJson = readFileSync(join(__dirname, '../../../app.json'), 'utf8');
    expect(appJson).toContain('E-ZPass');
    expect(appJson).toContain('travel confirmations');
    expect(appJson).toContain('tax documents');
    expect(appJson).toContain('avatars');
    expect(appJson).toContain('motion sensors');
    expect(appJson).not.toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(appJson).toContain('android.permission.ACCESS_COARSE_LOCATION');
    expect(appJson).toMatch(/photosPermission[\s\S]*E-ZPass/);
    expect(appJson).toMatch(/cameraPermission[\s\S]*E-ZPass/);
  });
});
