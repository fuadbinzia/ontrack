import { setGoogleCalendarDirection } from '@/services/calendar/google-server';
import { googleCalendarApiOptions, withGoogleCalendarApiAuth } from '@/services/calendar/google-api-route';
import { GOOGLE_CALENDAR_SYNC_DIRECTIONS } from '@/services/calendar/google-types';
import type { GoogleCalendarSyncDirection } from '@/services/calendar/google-types';
import { apiCorsHeaders } from '@/services/http/cors';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) { return googleCalendarApiOptions(request, METHODS); }

export async function POST(request: Request) {
  return withGoogleCalendarApiAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to change calendar sync.',
    errorFallback: 'Calendar sync direction could not be changed.',
  }, async (request, userId) => {
    const body = await request.json() as { direction?: GoogleCalendarSyncDirection };
    if (!body.direction || !GOOGLE_CALENDAR_SYNC_DIRECTIONS.has(body.direction)) {
      return Response.json({ error: 'Choose a valid calendar sync direction.' }, { status: 400, headers: apiCorsHeaders(request, METHODS) });
    }
    return setGoogleCalendarDirection(userId, body.direction);
  });
}
