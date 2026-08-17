import {
    apiRateLimitSubject,
    isApiRequestBlocked,
    resolveSupabaseAuthConfig,
    type ApiAuthResult,
} from '../api-auth';
import { checkApiRateLimit, resetApiRateLimitsForTests } from '../api-rate-limit';

describe('resolveSupabaseAuthConfig', () => {
  const keys = [
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ] as const;
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('prefers server SUPABASE_* over EXPO_PUBLIC_*', () => {
    process.env.SUPABASE_URL = 'https://server.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'server-key';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://public.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-key';
    expect(resolveSupabaseAuthConfig()).toEqual({
      url: 'https://server.supabase.co',
      apikey: 'server-key',
    });
  });

  it('falls back to EXPO_PUBLIC_* when server vars are unset', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://public.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-key';
    expect(resolveSupabaseAuthConfig()).toEqual({
      url: 'https://public.supabase.co',
      apikey: 'public-key',
    });
  });

  it('returns undefined when neither pair is complete', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    expect(resolveSupabaseAuthConfig()).toBeUndefined();
  });
});

describe('isApiRequestBlocked', () => {
  const original = process.env.ALLOW_UNAUTHENTICATED_API;
  const originalAppEnv = process.env.EXPO_PUBLIC_APP_ENV;

  afterEach(() => {
    if (original === undefined) delete process.env.ALLOW_UNAUTHENTICATED_API;
    else process.env.ALLOW_UNAUTHENTICATED_API = original;
    if (originalAppEnv === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
    else process.env.EXPO_PUBLIC_APP_ENV = originalAppEnv;
  });

  it('allows verified users', () => {
    expect(isApiRequestBlocked({ status: 'ok', userId: 'user-1' })).toBe(false);
  });

  it('blocks missing credentials', () => {
    expect(isApiRequestBlocked({ status: 'unauthenticated' })).toBe(true);
  });

  it('blocks unconfigured Supabase unless explicitly opted in', () => {
    delete process.env.ALLOW_UNAUTHENTICATED_API;
    expect(isApiRequestBlocked({ status: 'unconfigured' })).toBe(true);
    process.env.ALLOW_UNAUTHENTICATED_API = 'true';
    delete process.env.EXPO_PUBLIC_APP_ENV;
    process.env.NODE_ENV = 'test';
    expect(isApiRequestBlocked({ status: 'unconfigured' })).toBe(false);
  });

  it('ignores ALLOW_UNAUTHENTICATED_API in production-like app env', () => {
    process.env.ALLOW_UNAUTHENTICATED_API = 'true';
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    expect(isApiRequestBlocked({ status: 'unconfigured' })).toBe(true);
  });
});

describe('apiRateLimitSubject', () => {
  it('uses the authenticated user id when present', () => {
    const auth: ApiAuthResult = { status: 'ok', userId: 'abc' };
    expect(apiRateLimitSubject(new Request('https://example.test'), auth)).toBe('abc');
  });

  it('falls back to forwarded IP for local opt-in subjects', () => {
    const auth: ApiAuthResult = { status: 'unconfigured' };
    const request = new Request('https://example.test', {
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    });
    expect(apiRateLimitSubject(request, auth)).toBe('anon:203.0.113.9');
  });
});

describe('checkApiRateLimit', () => {
  afterEach(() => {
    resetApiRateLimitsForTests();
  });

  it('allows traffic under the window limit and blocks after', () => {
    const start = 1_000_000;
    for (let i = 0; i < 40; i += 1) {
      expect(checkApiRateLimit('nutrition', 'user-a', start + i)).toBe('ok');
    }
    expect(checkApiRateLimit('nutrition', 'user-a', start + 40)).toBe('limited');
    expect(checkApiRateLimit('nutrition', 'user-b', start + 40)).toBe('ok');
  });
});
