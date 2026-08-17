import { guardedFetch } from './dependency-guard';

export type ApiAuthResult =
  | { status: 'ok'; userId: string }
  | { status: 'unauthenticated' }
  | { status: 'unconfigured' };

/** @deprecated Prefer ApiAuthResult.status — kept for narrow status comparisons in tests. */
export type ApiAuthStatus = ApiAuthResult['status'];

/**
 * Server auth prefers SUPABASE_*; local Metro often only has EXPO_PUBLIC_* set
 * (same project / publishable key). Fall back so signed-in clients are not
 * rejected as if they were guests.
 */
export function resolveSupabaseAuthConfig():
  | { url: string; apikey: string }
  | undefined {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const apikey =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !apikey) return undefined;
  return { url, apikey };
}

/**
 * Verifies the caller's Supabase access token against the Auth API. These
 * server routes perform paid work (OpenAI/TMDB) and act as outbound fetchers,
 * so they must never run for anonymous internet clients on a live deployment.
 */
export async function authenticateApiRequest(request: Request): Promise<ApiAuthResult> {
  const config = resolveSupabaseAuthConfig();
  // Without backend Supabase configuration the token cannot be verified.
  // Callers must opt in via ALLOW_UNAUTHENTICATED_API for local-only use.
  if (!config) return { status: 'unconfigured' };

  const authorization = request.headers.get('authorization');
  if (!authorization) return { status: 'unauthenticated' };

  try {
    const response = await guardedFetch(
      'supabase-auth',
      `${config.url}/auth/v1/user`,
      { headers: { Authorization: authorization, apikey: config.apikey } },
      { timeoutMs: 8_000, maxConcurrency: 8 },
    );
    if (!response.ok) return { status: 'unauthenticated' };
    const user = (await response.json()) as { id?: string };
    return user?.id ? { status: 'ok', userId: user.id } : { status: 'unauthenticated' };
  } catch {
    return { status: 'unauthenticated' };
  }
}

/**
 * Blocks when there is no verified user. Unconfigured Supabase is allowed only
 * when ALLOW_UNAUTHENTICATED_API=true so local hosts can opt in explicitly
 * instead of failing open whenever NODE_ENV is not production.
 */
/** Local Metro only. Production / preview / TestFlight must never fail open. */
export function isUnauthenticatedApiAllowed(): boolean {
  if (process.env.ALLOW_UNAUTHENTICATED_API !== 'true') return false;
  const appEnv = (
    process.env.EXPO_PUBLIC_APP_ENV ||
    process.env.EAS_BUILD_PROFILE ||
    process.env.NODE_ENV ||
    ''
  ).toLowerCase();
  if (
    appEnv === 'production' ||
    appEnv === 'preview' ||
    appEnv === 'testflight' ||
    appEnv === 'device'
  ) {
    return false;
  }
  return true;
}

export function isApiRequestBlocked(result: ApiAuthResult): boolean {
  if (result.status === 'ok') return false;
  if (result.status === 'unauthenticated') return true;
  return !isUnauthenticatedApiAllowed();
}

/** Stable subject key for per-user rate limits (falls back for local opt-in). */
export function apiRateLimitSubject(request: Request, result: ApiAuthResult): string {
  if (result.status === 'ok') return result.userId;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `anon:${forwarded || 'local'}`;
}
