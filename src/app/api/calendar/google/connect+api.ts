import { createCalendarOAuthState, googleCalendarCallbackUri, googleCalendarReturnUri, googleOAuthUrl } from '@/services/calendar/google-server';
import { googleCalendarApiOptions, withGoogleCalendarApiAuth } from '@/services/calendar/google-api-route';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) { return googleCalendarApiOptions(request, METHODS); }

export async function POST(request: Request) {
  return withGoogleCalendarApiAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to onTrack before connecting Google Calendar.',
    errorFallback: 'Calendar connection could not start.',
  }, async (request, userId) => {
    const body = await request.json().catch(() => ({})) as { redirectUri?: string };
    const native = body.redirectUri === 'ontrack://calendar/google';
    const returnUri = googleCalendarReturnUri(request.url, native);
    const callbackUri = googleCalendarCallbackUri();
    const state = await createCalendarOAuthState(userId, returnUri);
    return { authorizationUrl: googleOAuthUrl(state, callbackUri) };
  });
}
