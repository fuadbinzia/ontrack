import { disconnectStraiaway } from '@/services/partner/straiaway-server';
import { partnerApiOptions, withPartnerUserAuth } from '@/services/partner/straiaway-api-route';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) {
  return partnerApiOptions(request, METHODS);
}

export async function POST(request: Request) {
  return withPartnerUserAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to disconnect StraiAway.',
    errorFallback: 'StraiAway disconnect failed.',
  }, async (_incoming, userId) => disconnectStraiaway(userId));
}
