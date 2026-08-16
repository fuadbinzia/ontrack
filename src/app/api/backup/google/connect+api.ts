import {
  createDriveOAuthState,
  googleDriveCallbackUri,
  googleDriveOAuthUrl,
  googleDriveReturnUri,
} from '@/services/backup/google-drive-oauth';
import { googleCalendarApiOptions, withGoogleCalendarApiAuth } from '@/services/calendar/google-api-route';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) { return googleCalendarApiOptions(request, METHODS); }

export async function POST(request: Request) {
  return withGoogleCalendarApiAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to onTrack before connecting Google Drive.',
    errorFallback: 'Google Drive connection could not start.',
  }, async (request, userId) => {
    const body = await request.json().catch(() => ({})) as { redirectUri?: string };
    const native = body.redirectUri === 'ontrack://backup/google';
    const returnUri = googleDriveReturnUri(request.url, native);
    const callbackUri = googleDriveCallbackUri();
    const state = await createDriveOAuthState(userId, returnUri);
    return { authorizationUrl: googleDriveOAuthUrl(state, callbackUri) };
  });
}
