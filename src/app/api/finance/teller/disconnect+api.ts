import { apiCorsHeaders } from '@/services/http/cors';
import {
  deleteTellerEnrollmentRecord,
  loadTellerEnrollment,
  tellerApiOptions,
  tellerGatewayRequest,
  withTellerApiAuth,
} from '@/services/finance/teller-server';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) {
  return tellerApiOptions(request, METHODS);
}

export async function POST(request: Request) {
  return withTellerApiAuth(request, async (request, userId) => {
    const body = await request.json().catch(() => ({})) as { enrollment_id?: string };
    const enrollmentId = body.enrollment_id?.trim();
    if (!enrollmentId) {
      return Response.json(
        { error: 'enrollment_id is required.' },
        { status: 400, headers: apiCorsHeaders(request, METHODS) },
      );
    }
    const enrollment = await loadTellerEnrollment(userId, enrollmentId);
    await tellerGatewayRequest({ operation: 'disconnect', accessToken: enrollment.accessToken });
    await deleteTellerEnrollmentRecord(userId, enrollmentId);
    return { ok: true, enrollment_id: enrollmentId };
  }, { rateLimit: false });
}
