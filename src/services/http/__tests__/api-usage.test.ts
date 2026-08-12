import {
  checkApiRateLimit,
  PAID_API_BUCKETS,
  peekAllApiRateLimits,
  peekApiRateLimit,
  resetApiRateLimitsForTests,
} from '../api-rate-limit';
import { buildApiUsageSnapshot } from '../api-usage';
import { API_USAGE_CATALOG } from '../api-usage-catalog';

describe('peekApiRateLimit', () => {
  afterEach(() => {
    resetApiRateLimitsForTests();
  });

  it('reports used and remaining without recording a hit', () => {
    const start = 2_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect(checkApiRateLimit('movies', 'dev-user', start + i)).toBe('ok');
    }
    const peek = peekApiRateLimit('movies', 'dev-user', start + 10);
    expect(peek).toEqual({
      bucket: 'movies',
      used: 3,
      max: 120,
      remaining: 117,
      windowMs: 60 * 60 * 1000,
    });
    expect(peekApiRateLimit('movies', 'dev-user', start + 11).used).toBe(3);
  });

  it('returns peeks for every paid bucket', () => {
    const peeks = peekAllApiRateLimits('dev-user');
    expect(Object.keys(peeks).sort()).toEqual([...PAID_API_BUCKETS].sort());
  });
});

describe('API_USAGE_CATALOG', () => {
  it('lists services with used-by features and unique ids', () => {
    const ids = API_USAGE_CATALOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(API_USAGE_CATALOG.length).toBeGreaterThanOrEqual(15);
    for (const entry of API_USAGE_CATALOG) {
      expect(entry.name.trim().length).toBeGreaterThan(0);
      expect(entry.usedBy.length).toBeGreaterThan(0);
      if (entry.metering === 'app-rate-limit') {
        expect(entry.bucket).toBeTruthy();
      }
    }
  });
});

describe('buildApiUsageSnapshot', () => {
  afterEach(() => {
    resetApiRateLimitsForTests();
  });

  it('returns a service list with health for guests without requiring auth opt-in', async () => {
    const snapshot = await buildApiUsageSnapshot(new Request('http://localhost/api/usage'));
    expect(snapshot.services.length).toBe(API_USAGE_CATALOG.length);
    expect(snapshot.subject.startsWith('anon:')).toBe(true);
    expect(snapshot.healthSummary).toBeTruthy();
    const nutrition = snapshot.services.find((row) => row.id === 'openai-nutrition');
    expect(nutrition?.used).toBe(0);
    expect(nutrition?.remaining).toBe(40);
    expect(nutrition?.health).toBeTruthy();
    expect(nutrition?.healthLabel).toBeTruthy();
  });
});
