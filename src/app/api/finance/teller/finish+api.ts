import { apiCorsHeaders } from '@/services/http/cors';
import {
  loadTellerSession,
  tellerApiOptions,
  withTellerApiAuth,
} from '@/services/finance/teller-server';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) {
  return tellerApiOptions(request, METHODS);
}

export async function POST(request: Request) {
  return withTellerApiAuth(request, async (request, userId) => {
    const body = await request.json().catch(() => ({})) as { session_id?: string };
    const sessionId = body.session_id?.trim();
    if (!sessionId) {
      return Response.json(
        { error: 'session_id is required.' },
        { status: 400, headers: apiCorsHeaders(request, METHODS) },
      );
    }
    const session = await loadTellerSession(sessionId, userId);
    if (!session.completedAt || !session.enrollmentId) {
      return Response.json(
        { error: 'Teller enrollment is still completing.', code: 'LINK_PENDING' },
        { status: 409, headers: apiCorsHeaders(request, METHODS) },
      );
    }
    return { enrollment_id: session.enrollmentId };
  });
}
