import { exchangeGoogleCalendarCode, googleCalendarCallbackUri, googleCalendarErrorMessage, readCalendarOAuthState } from '@/services/calendar/google-server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  let returnUri = 'ontrack://calendar/google';
  try {
    const state = await readCalendarOAuthState(url.searchParams.get('state') ?? '');
    returnUri = state.returnUri;
    const providerError = url.searchParams.get('error_description') || url.searchParams.get('error');
    if (providerError) throw new Error(providerError);
    const code = url.searchParams.get('code');
    if (!code) throw new Error('Google did not return an authorization code.');
    await exchangeGoogleCalendarCode(state.userId, code, googleCalendarCallbackUri());
    const redirect = new URL(returnUri);
    redirect.searchParams.set('calendarConnected', '1');
    return Response.redirect(redirect.toString(), 302);
  } catch (error) {
    const redirect = new URL(returnUri);
    redirect.searchParams.set('calendarError', googleCalendarErrorMessage(error, 'Google Calendar connection failed.'));
    return Response.redirect(redirect.toString(), 302);
  }
}
