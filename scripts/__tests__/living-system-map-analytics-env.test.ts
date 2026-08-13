import fs from 'node:fs';
import path from 'node:path';

const { ensureLocalAnalyticsHashSecret, loadLocalEnvFile, parseLocalEnv } = require('../lib/local-env.cjs');

describe('Living System Map server-only analytics environment', () => {
  it('parses EAS pull comments as dotenv metadata instead of JavaScript', () => {
    expect(parseLocalEnv([
      '# Environment: production',
      '',
      '# SECRET=***** (secret)',
      'SUPABASE_SERVICE_ROLE_KEY="synthetic-service-role"',
    ].join('\n'))).toEqual({ SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role' });
  });

  it('loads into a server-owned object without replacing existing values', () => {
    const fixture = path.resolve('.living-system-map/runtime-analytics.test.local');
    fs.writeFileSync(fixture, 'SUPABASE_URL=https://example.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=pulled-value\n');
    try {
      const environment = { SUPABASE_SERVICE_ROLE_KEY: 'existing-value' };
      loadLocalEnvFile(fixture, environment);
      expect(environment).toEqual({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'existing-value',
      });
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  });

  it('keeps the analytics credential outside Expo root dotenv patterns', () => {
    const source = fs.readFileSync(path.resolve('scripts/living-system-map-analytics.mjs'), 'utf8');
    expect(source).toContain(".living-system-map/runtime-analytics.local");
    expect(source).not.toContain('.env.analytics.local');
    expect(fs.existsSync(path.resolve('.env.analytics.local'))).toBe(false);
    expect(fs.readFileSync(path.resolve('.gitignore'), 'utf8')).toContain('.living-system-map/runtime-analytics.local');
    expect(fs.readFileSync(path.resolve('.easignore'), 'utf8')).toContain('.living-system-map/runtime-analytics.local');
  });

  it('creates one stable local HMAC secret without exposing it to Expo dotenv', () => {
    const fixture = path.resolve('.living-system-map/runtime-analytics-secret.test.local');
    fs.writeFileSync(fixture, '# Environment: development\nSUPABASE_SERVICE_ROLE_KEY=synthetic-role\n');
    try {
      expect(ensureLocalAnalyticsHashSecret(fixture)).toBe(true);
      const first = parseLocalEnv(fs.readFileSync(fixture, 'utf8')).ANALYTICS_INSTALL_HASH_SECRET;
      expect(first).toMatch(/^[a-f0-9]{64}$/);
      expect(ensureLocalAnalyticsHashSecret(fixture)).toBe(false);
      expect(parseLocalEnv(fs.readFileSync(fixture, 'utf8')).ANALYTICS_INSTALL_HASH_SECRET).toBe(first);
      expect(fs.statSync(fixture).mode & 0o777).toBe(0o600);
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  });
});
