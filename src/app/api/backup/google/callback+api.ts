import {
  exchangeGoogleDriveCode,
  googleDriveCallbackUri,
  googleDriveErrorMessage,
  readDriveOAuthState,
} from '@/services/backup/google-drive-oauth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  let returnUri = 'ontrack://backup/google';
  try {
    const state = await readDriveOAuthState(url.searchParams.get('state') ?? '');
    returnUri = state.returnUri;
    const providerError = url.searchParams.get('error_description') || url.searchParams.get('error');
    if (providerError) throw new Error(providerError);
    const code = url.searchParams.get('code');
    if (!code) throw new Error('Google did not return an authorization code.');
    await exchangeGoogleDriveCode(state.userId, code, googleDriveCallbackUri());
    const redirect = new URL(returnUri);
    redirect.searchParams.set('driveConnected', '1');
    return Response.redirect(redirect.toString(), 302);
  } catch (error) {
    const redirect = new URL(returnUri);
    redirect.searchParams.set('driveError', googleDriveErrorMessage(error, 'Google Drive connection failed.'));
    return Response.redirect(redirect.toString(), 302);
  }
}
