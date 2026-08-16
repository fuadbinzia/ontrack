import { googleDriveStatus } from '@/services/backup/google-drive-server';
import { googleCalendarApiOptions, withGoogleCalendarApiAuth } from '@/services/calendar/google-api-route';

const METHODS = 'GET, OPTIONS';

export function OPTIONS(request: Request) { return googleCalendarApiOptions(request, METHODS); }

export async function GET(request: Request) {
  return withGoogleCalendarApiAuth(request, {
    methods: METHODS,
    unauthorizedMessage: 'Sign in to view Google Drive backup.',
    errorFallback: 'Google Drive status is unavailable.',
  }, async (_request, userId) => googleDriveStatus(userId));
}
