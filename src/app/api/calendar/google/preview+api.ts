import { previewGoogleCalendarSyncServer } from '@/services/calendar/google-server';
import type { GoogleCalendarDeletion } from '@/services/calendar/google-types';
import { googleCalendarApiOptions, withGoogleCalendarApiAuth } from '@/services/calendar/google-api-route';
import { apiCorsHeaders } from '@/services/http/cors';
import type { Activity } from '@/types/models';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) { return googleCalendarApiOptions(request, METHODS); }

export async function POST(request: Request) {
  return withGoogleCalendarApiAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to preview calendar sync.',
    errorFallback: 'Calendar sync preview failed.',
  }, async (request, userId) => {
    const body = await request.json() as {
      activities?: Activity[];
      deletions?: GoogleCalendarDeletion[];
      timeZone?: string;
    };
    if (!Array.isArray(body.activities) || body.activities.length > 10_000) {
      return Response.json(
        { error: 'Calendar payload is invalid.' },
        { status: 400, headers: apiCorsHeaders(request, METHODS) },
      );
    }
    if (body.deletions !== undefined
      && (!Array.isArray(body.deletions) || body.deletions.length > 10_000)) {
      return Response.json(
        { error: 'Calendar deletion payload is invalid.' },
        { status: 400, headers: apiCorsHeaders(request, METHODS) },
      );
    }
    return previewGoogleCalendarSyncServer(
      userId,
      body.activities,
      body.deletions ?? [],
      typeof body.timeZone === 'string' && body.timeZone.length < 80 ? body.timeZone : 'UTC',
    );
  });
}
