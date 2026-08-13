import { apiCorsHeaders } from '@/services/http/cors';
import { partnerErrorMessage } from '@/services/partner/crypto';
import { inboundStraiAwayStays, pullStraiAwayStays, pushStraiAwayStays } from '@/services/partner/straiaway-server';
import { partnerApiOptions, withPartnerUserAuth } from '@/services/partner/straiaway-api-route';
import type { StayPackage } from '@/services/partner/types';

const METHODS = 'GET, POST, OPTIONS';

export function OPTIONS(request: Request) {
  return partnerApiOptions(request, METHODS);
}

export async function GET(request: Request) {
  return withPartnerUserAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to import StraiAway stays.',
    errorFallback: 'StraiAway stays could not be loaded.',
  }, async (_incoming, userId) => pullStraiAwayStays(userId));
}

export async function POST(request: Request) {
  const partnerName = request.headers.get('x-partner-name')?.trim().toLowerCase();
  if (partnerName === 'straiaway') {
    const cors = apiCorsHeaders(request, METHODS);
    try {
      const body = await request.json().catch(() => ({})) as { stays?: StayPackage[] };
      const result = await inboundStraiAwayStays(request, Array.isArray(body.stays) ? body.stays : []);
      return Response.json(result, { headers: cors });
    } catch (error) {
      const message = partnerErrorMessage(error, 'Stay handoff failed.');
      const status = /invalid|required/i.test(message) ? 401 : 503;
      return Response.json({ error: message }, { status, headers: cors });
    }
  }
  return withPartnerUserAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to send stays to StraiAway.',
    errorFallback: 'Stay handoff failed.',
  }, async (incoming, userId) => {
    const body = await incoming.json().catch(() => ({})) as { stays?: StayPackage[] };
    return pushStraiAwayStays(userId, Array.isArray(body.stays) ? body.stays : []);
  });
}
