import { createStraiawayConnect } from '@/services/partner/straiaway-server';
import { partnerApiOptions, withPartnerUserAuth } from '@/services/partner/straiaway-api-route';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) {
  return partnerApiOptions(request, METHODS);
}

export async function POST(request: Request) {
  return withPartnerUserAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to onTrack before connecting StraiAway.',
    errorFallback: 'StraiAway connection could not start.',
  }, async (incoming, userId) => {
    const body = await incoming.json().catch(() => ({})) as { codeChallenge?: string };
    return createStraiawayConnect(userId, body.codeChallenge ?? '');
  });
}
