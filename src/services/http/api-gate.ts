import {
    apiRateLimitSubject,
    authenticateApiRequest,
    isApiRequestBlocked,
} from './api-auth';
import { checkApiRateLimit, type PaidApiBucket } from './api-rate-limit';

export type PaidApiGate = 'ok' | 'unauthenticated' | 'rate_limited';

/** Paid buckets guests may call. Nutrition, flights, and other paid routes stay signed-in. */
export type GuestPaidApiBucket = Extract<PaidApiBucket, 'agents' | 'journal'>;

/**
 * Verifies JWT (or explicit local opt-in) then applies a per-subject rate limit
 * for the paid API bucket. Prefer this over checking auth alone on paid routes.
 */
export async function gatePaidApiRequest(
  request: Request,
  bucket: PaidApiBucket,
): Promise<PaidApiGate> {
  const auth = await authenticateApiRequest(request);
  if (isApiRequestBlocked(auth)) return 'unauthenticated';
  if (checkApiRateLimit(bucket, apiRateLimitSubject(request, auth)) === 'limited') {
    return 'rate_limited';
  }
  return 'ok';
}

/**
 * Companion chat and journal/search dictate: authenticate when a token is present,
 * allow unsigned-in callers, and always rate-limit by user id or anon IP.
 */
export async function gateGuestPaidApiRequest(
  request: Request,
  bucket: GuestPaidApiBucket,
): Promise<PaidApiGate> {
  const auth = await authenticateApiRequest(request);
  if (checkApiRateLimit(bucket, apiRateLimitSubject(request, auth)) === 'limited') {
    return 'rate_limited';
  }
  return 'ok';
}

/** IP-scoped limit for unauthenticated lookup routes (covers, VIN, brands). */
export async function gatePublicApiRequest(request: Request): Promise<PaidApiGate> {
  const auth = await authenticateApiRequest(request);
  if (checkApiRateLimit('public', apiRateLimitSubject(request, auth)) === 'limited') {
    return 'rate_limited';
  }
  return 'ok';
}
