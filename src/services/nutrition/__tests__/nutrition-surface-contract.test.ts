import fs from 'fs';
import path from 'path';

import { isPrivateIpAddress, normalizeIpAddress } from '@/services/nutrition/url-safety';

const ROOT = path.resolve(__dirname, '../../../..');

describe('nutrition surface contract', () => {
  it('exports a stable client/server barrel without paper chrome debt in feature entry', () => {
    const index = fs.readFileSync(path.join(ROOT, 'src/services/nutrition/index.ts'), 'utf8');
    expect(index).toMatch(/export/);
    expect(fs.existsSync(path.join(ROOT, 'src/services/nutrition/client.ts'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src/services/nutrition/server.ts'))).toBe(true);
  });

  it('blocks private IPs for meal/recipe link importers', () => {
    expect(isPrivateIpAddress('127.0.0.1')).toBe(true);
    expect(isPrivateIpAddress('10.0.0.1')).toBe(true);
    expect(isPrivateIpAddress(normalizeIpAddress('::ffff:192.168.1.1'))).toBe(true);
    expect(isPrivateIpAddress('8.8.8.8')).toBe(false);
  });
});
