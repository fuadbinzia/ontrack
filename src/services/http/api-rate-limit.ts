/**
 * In-process sliding-window rate limits for paid Expo API routes.
 * Bounds OpenAI/TMDB/Amadeus spend per authenticated subject on each instance.
 */

export type PaidApiBucket =
  | 'nutrition'
  | 'recipe'
  | 'food'
  | 'plant'
  | 'movies'
  | 'events'
  | 'flights'
  | 'health'
  | 'finance'
  | 'travel'
  | 'journal';

export const PAID_API_BUCKETS: readonly PaidApiBucket[] = [
  'nutrition',
  'recipe',
  'food',
  'plant',
  'movies',
  'events',
  'flights',
  'health',
  'finance',
  'travel',
  'journal',
] as const;

export const PAID_API_LIMITS: Record<PaidApiBucket, { max: number; windowMs: number }> = {
  nutrition: { max: 40, windowMs: 60 * 60 * 1000 },
  recipe: { max: 25, windowMs: 60 * 60 * 1000 },
  food: { max: 30, windowMs: 60 * 60 * 1000 },
  plant: { max: 40, windowMs: 60 * 60 * 1000 },
  movies: { max: 120, windowMs: 60 * 60 * 1000 },
  events: { max: 120, windowMs: 60 * 60 * 1000 },
  flights: { max: 40, windowMs: 60 * 60 * 1000 },
  health: { max: 20, windowMs: 60 * 60 * 1000 },
  finance: { max: 30, windowMs: 60 * 60 * 1000 },
  travel: { max: 80, windowMs: 60 * 60 * 1000 },
  journal: { max: 30, windowMs: 60 * 60 * 1000 },
};

export type ApiRateLimitPeek = {
  bucket: PaidApiBucket;
  used: number;
  max: number;
  remaining: number;
  windowMs: number;
};

const hitsByKey = new Map<string, number[]>();

function recentHits(bucket: PaidApiBucket, subject: string, now: number): number[] {
  const { windowMs } = PAID_API_LIMITS[bucket];
  const key = `${bucket}:${subject}`;
  const windowStart = now - windowMs;
  const recent = (hitsByKey.get(key) ?? []).filter((stamp) => stamp > windowStart);
  hitsByKey.set(key, recent);
  return recent;
}

export function checkApiRateLimit(
  bucket: PaidApiBucket,
  subject: string,
  now = Date.now(),
): 'ok' | 'limited' {
  const { max } = PAID_API_LIMITS[bucket];
  const recent = recentHits(bucket, subject, now);
  if (recent.length >= max) return 'limited';
  recent.push(now);
  hitsByKey.set(`${bucket}:${subject}`, recent);
  return 'ok';
}

/** Read current window usage without recording a hit. */
export function peekApiRateLimit(
  bucket: PaidApiBucket,
  subject: string,
  now = Date.now(),
): ApiRateLimitPeek {
  const { max, windowMs } = PAID_API_LIMITS[bucket];
  const used = recentHits(bucket, subject, now).length;
  return {
    bucket,
    used,
    max,
    remaining: Math.max(0, max - used),
    windowMs,
  };
}

export function peekAllApiRateLimits(
  subject: string,
  now = Date.now(),
): Record<PaidApiBucket, ApiRateLimitPeek> {
  return Object.fromEntries(
    PAID_API_BUCKETS.map((bucket) => [bucket, peekApiRateLimit(bucket, subject, now)]),
  ) as Record<PaidApiBucket, ApiRateLimitPeek>;
}

export function resetApiRateLimitsForTests() {
  hitsByKey.clear();
}

/** Clear all buckets for one subject (Developer Tools). */
export function resetApiRateLimitsForSubject(subject: string) {
  for (const bucket of PAID_API_BUCKETS) {
    hitsByKey.delete(`${bucket}:${subject}`);
  }
}
