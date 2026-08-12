import { disconnectGoogleCalendarServer } from '@/services/calendar/google-server';
import { googleCalendarApiOptions, withGoogleCalendarApiAuth } from '@/services/calendar/google-api-route';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) { return googleCalendarApiOptions(request, METHODS); }

export async function POST(request: Request) {
  return withGoogleCalendarApiAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to disconnect calendars.',
    errorFallback: 'Calendar disconnect failed.',
  }, async (request, userId) => {
    const body = await request.json().catch(() => ({})) as { removeExported?: boolean };
    const result = await disconnectGoogleCalendarServer(userId, body.removeExported === true);
    return { disconnected: !result.hasMore, hasMore: result.hasMore };
  });
}
