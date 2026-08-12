import { confirmStraiawayCallback } from '@/services/partner/straiaway-server';
import { partnerApiOptions, withPartnerUserAuth } from '@/services/partner/straiaway-api-route';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) {
  return partnerApiOptions(request, METHODS);
}

export async function POST(request: Request) {
  return withPartnerUserAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to finish connecting StraiAway.',
    errorFallback: 'StraiAway connection could not finish.',
  }, async (incoming, userId) => {
    const body = await incoming.json().catch(() => ({})) as { code?: string; codeVerifier?: string };
    return confirmStraiawayCallback(userId, body.code ?? '', body.codeVerifier ?? '');
  });
}
