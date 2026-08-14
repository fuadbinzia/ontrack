import { apiCorsHeaders, apiOptionsResponse } from '@/services/http/cors';
import { checkApiRateLimit } from '@/services/http/api-rate-limit';
import {
  completeTellerSession,
  TellerServerError,
  tellerConfigured,
} from '@/services/finance/teller-server';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) {
  return apiOptionsResponse(request, METHODS);
}

export async function POST(request: Request) {
  const cors = apiCorsHeaders(request, METHODS);
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (checkApiRateLimit('finance', `teller-complete:${forwarded}`) === 'limited') {
    return Response.json(
      { error: 'Teller completion limit reached.', code: 'RATE_LIMITED' },
      { status: 429, headers: cors },
    );
  }
  if (!tellerConfigured()) {
    return Response.json(
      { error: 'Teller is not configured.', code: 'NOT_CONFIGURED' },
      { status: 503, headers: cors },
    );
  }
  try {
    const body = await request.json().catch(() => ({})) as {
      session_id?: string;
      access_token?: string;
      teller_user_id?: string;
      enrollment_id?: string;
      institution_name?: string;
      signatures?: string[];
    };
    if (
      !body.session_id?.trim() || !body.access_token?.trim() ||
      !body.teller_user_id?.trim() || !body.enrollment_id?.trim() ||
      !Array.isArray(body.signatures) || body.signatures.length === 0
    ) {
      return Response.json({ error: 'Incomplete Teller enrollment.' }, { status: 400, headers: cors });
    }
    await completeTellerSession({
      sessionId: body.session_id.trim(),
      accessToken: body.access_token.trim(),
      tellerUserId: body.teller_user_id.trim(),
      enrollmentId: body.enrollment_id.trim(),
      institutionName: body.institution_name?.trim(),
      signatures: body.signatures.filter((value): value is string => typeof value === 'string'),
    });
    return Response.json({ ok: true }, { headers: cors });
  } catch (error) {
    const status = error instanceof TellerServerError ? error.status : 503;
    const code = error instanceof TellerServerError ? error.code : undefined;
    return Response.json(
      { error: error instanceof Error ? error.message : 'Teller enrollment failed.', code },
      { status, headers: cors },
    );
  }
}
