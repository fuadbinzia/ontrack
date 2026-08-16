import {
  decryptGoogleCalendarToken,
  encryptToken,
  googleCalendarAdmin,
  googleCalendarErrorMessage,
  required,
} from '@/services/calendar/google-oauth';
import { fetchGoogleApi } from '@/services/calendar/google-fetch';

const DEFAULT_GOOGLE_DRIVE_CALLBACK_URI = 'https://ontrack.expo.app/api/backup/google/callback';
export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const GOOGLE_DRIVE_FOLDER_NAME = 'onTrack Backups';
export const GOOGLE_DRIVE_BACKUP_PROPERTY = 'ontrackBackup';
export const GOOGLE_DRIVE_FOLDER_PROPERTY = 'ontrackBackupFolder';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(required('GOOGLE_CALENDAR_STATE_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

export function googleDriveCallbackUri() {
  return process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim() || DEFAULT_GOOGLE_DRIVE_CALLBACK_URI;
}

export function googleDriveReturnUri(requestUrl: string, native: boolean) {
  return native ? 'ontrack://backup/google' : `${new URL(requestUrl).origin}/profile/backup`;
}

export function googleDriveErrorMessage(error: unknown, fallback: string) {
  return googleCalendarErrorMessage(error, fallback);
}

export function hasGoogleDriveFileScope(scope: string | undefined) {
  if (!scope?.trim()) return true;
  return scope.trim().split(/\s+/).includes(GOOGLE_DRIVE_FILE_SCOPE);
}

export async function createDriveOAuthState(userId: string, returnUri: string) {
  const payload = base64url(encoder.encode(JSON.stringify({
    purpose: 'drive-backup',
    userId,
    returnUri,
    exp: Date.now() + 10 * 60_000,
  })));
  return `${payload}.${await hmac(payload)}`;
}

export async function readDriveOAuthState(state: string) {
  const [payload, signature] = state.split('.');
  if (!payload || !signature || signature !== await hmac(payload)) throw new Error('Invalid OAuth state.');
  const parsed = JSON.parse(decoder.decode(fromBase64url(payload))) as {
    purpose?: string;
    userId?: string;
    returnUri?: string;
    exp?: number;
  };
  if (parsed.purpose !== 'drive-backup' || !parsed.userId || !parsed.returnUri || !parsed.exp || parsed.exp < Date.now()) {
    throw new Error('Expired OAuth state.');
  }
  return parsed as { purpose: 'drive-backup'; userId: string; returnUri: string; exp: number };
}

export function googleDriveOAuthUrl(state: string, redirectUri: string) {
  const query = new URLSearchParams({
    client_id: required('GOOGLE_CALENDAR_CLIENT_ID'),
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'false',
    scope: `openid email ${GOOGLE_DRIVE_FILE_SCOPE}`,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}

export async function exchangeGoogleDriveCode(userId: string, code: string, redirectUri: string) {
  const response = await fetchGoogleApi('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: required('GOOGLE_CALENDAR_CLIENT_ID'),
      client_secret: required('GOOGLE_CALENDAR_CLIENT_SECRET'),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error_description?: string;
  };
  if (!response.ok || !tokens.access_token || !tokens.refresh_token) {
    throw new Error(tokens.error_description || 'Google did not return offline Drive access.');
  }
  if (!hasGoogleDriveFileScope(tokens.scope)) {
    throw new Error('Google did not grant Drive file access. Choose Allow for Google Drive and try again.');
  }
  const identityResponse = await fetchGoogleApi('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const identity = identityResponse.ok ? await identityResponse.json() as { email?: string } : {};
  const db = googleCalendarAdmin();
  const { error } = await db.from('google_drive_connections').upsert({
    user_id: userId,
    google_email: identity.email ?? null,
    refresh_token_ciphertext: await encryptToken(tokens.refresh_token),
    folder_id: null,
    connected_at: new Date().toISOString(),
    last_backup_at: null,
  });
  if (error) throw error;
}

export async function googleDriveAccessToken(refreshTokenCiphertext: string) {
  const response = await fetchGoogleApi('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: required('GOOGLE_CALENDAR_CLIENT_ID'),
      client_secret: required('GOOGLE_CALENDAR_CLIENT_SECRET'),
      refresh_token: await decryptGoogleCalendarToken(refreshTokenCiphertext),
      grant_type: 'refresh_token',
    }),
  });
  const result = await response.json() as { access_token?: string; scope?: string; error_description?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || 'Google Drive access expired. Reconnect Google Drive.');
  }
  if (!hasGoogleDriveFileScope(result.scope)) {
    throw new Error('Google Drive permission needs to be renewed. Reconnect and choose Allow for Drive file access.');
  }
  return result.access_token;
}

export async function revokeGoogleDriveToken(refreshTokenCiphertext: string) {
  const refreshToken = await decryptGoogleCalendarToken(refreshTokenCiphertext).catch(() => undefined);
  if (!refreshToken) return;
  await fetchGoogleApi(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  ).catch(() => undefined);
}
