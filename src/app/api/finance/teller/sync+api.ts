import { loadTellerEnrollmentData } from '@/services/finance/teller-data';
import {
  loadTellerEnrollment,
  markTellerSynced,
  tellerApiOptions,
  withTellerApiAuth,
} from '@/services/finance/teller-server';
import { apiCorsHeaders } from '@/services/http/cors';

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
    const data = await loadTellerEnrollmentData(enrollment);
    await markTellerSynced(userId, enrollmentId);
    return {
      configured: true,
      enrollment_id: enrollmentId,
      institution_name: data.institutionName,
      accounts: data.accounts,
      transactions: data.transactions,
      refreshed_from: data.refreshedFrom,
      sync_status: 'ready',
    };
  });
}
