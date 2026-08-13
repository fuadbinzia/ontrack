import { authenticateApiRequest, isApiRequestBlocked } from '@/services/http/api-auth';
import { apiCorsHeaders, apiOptionsResponse } from '@/services/http/cors';

import { googleCalendarErrorMessage } from './google-oauth';

type GoogleCalendarApiHandler = (request: Request, userId: string) => Promise<unknown | Response>;

export function googleCalendarApiOptions(request: Request, methods: string) {
  return apiOptionsResponse(request, methods);
}

export async function withGoogleCalendarApiAuth(
  request: Request,
  config: {
    methods: string;
    unauthorizedMessage: string;
    errorFallback: string;
  },
  handler: GoogleCalendarApiHandler,
): Promise<Response> {
  const cors = apiCorsHeaders(request, config.methods);
  const auth = await authenticateApiRequest(request);
  if (isApiRequestBlocked(auth) || auth.status !== 'ok') {
    return Response.json({ error: config.unauthorizedMessage }, { status: 401, headers: cors });
  }
  try {
    const result = await handler(request, auth.userId);
    if (result instanceof Response) return result;
    return Response.json(result, { headers: cors });
  } catch (error) {
    const code = error instanceof Error
      && 'code' in error
      && typeof error.code === 'string'
      ? error.code
      : undefined;
    return Response.json(
      {
        error: googleCalendarErrorMessage(error, config.errorFallback),
        ...(code ? { code } : {}),
      },
      { status: 503, headers: cors },
    );
  }
}
