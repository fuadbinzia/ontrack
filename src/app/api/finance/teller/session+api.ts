import {
  createTellerSession,
  tellerApiOptions,
  withTellerApiAuth,
} from '@/services/finance/teller-server';

const METHODS = 'POST, OPTIONS';
const COMPLETION_REDIRECT_URI = 'ontrack://teller/complete';

export function OPTIONS(request: Request) {
  return tellerApiOptions(request, METHODS);
}

export async function POST(request: Request) {
  return withTellerApiAuth(request, async (request, userId) => {
    const session = await createTellerSession(userId);
    const origin = process.env.TELLER_CONNECT_ORIGIN?.trim() || new URL(request.url).origin;
    return {
      configured: true,
      session_id: session.sessionId,
      connect_url: `${origin}/api/finance/teller/connect?session=${encodeURIComponent(session.sessionId)}`,
      completion_redirect_uri: COMPLETION_REDIRECT_URI,
    };
  });
}
