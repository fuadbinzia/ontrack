import { straiawayStatus } from '@/services/partner/straiaway-server';
import { partnerApiOptions, withPartnerUserAuth } from '@/services/partner/straiaway-api-route';

const METHODS = 'GET, OPTIONS';

export function OPTIONS(request: Request) {
  return partnerApiOptions(request, METHODS);
}

export async function GET(request: Request) {
  return withPartnerUserAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to view StraiAway connection.',
    errorFallback: 'StraiAway status is unavailable.',
  }, async (_incoming, userId) => straiawayStatus(userId));
}
