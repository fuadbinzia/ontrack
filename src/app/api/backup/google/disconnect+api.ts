import { disconnectGoogleDriveServer } from '@/services/backup/google-drive-server';
import { googleCalendarApiOptions, withGoogleCalendarApiAuth } from '@/services/calendar/google-api-route';

const METHODS = 'POST, OPTIONS';

export function OPTIONS(request: Request) { return googleCalendarApiOptions(request, METHODS); }

export async function POST(request: Request) {
  return withGoogleCalendarApiAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to disconnect Google Drive.',
    errorFallback: 'Google Drive disconnect failed.',
  }, async (_request, userId) => disconnectGoogleDriveServer(userId));
}
