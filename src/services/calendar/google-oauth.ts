import { createClient } from '@supabase/supabase-js';

import { fetchGoogleApi } from './google-fetch';

const DEFAULT_GOOGLE_CALENDAR_CALLBACK_URI = 'https://ontrack.expo.app/api/calendar/google/callback';
const GOOGLE_CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GOOGLE_CALENDAR_FULL_SCOPE = 'https://www.googleapis.com/auth/calendar';

export function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function hasGoogleCalendarWriteScope(scope: string | undefined) {
  if (!scope?.trim()) return true;
  const scopes = new Set(scope.trim().split(/\s+/));
  return scopes.has(GOOGLE_CALENDAR_EVENTS_SCOPE) || scopes.has(GOOGLE_CALENDAR_FULL_SCOPE);
}

export function googleCalendarCallbackUri() {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() || DEFAULT_GOOGLE_CALENDAR_CALLBACK_URI;
}

export function googleCalendarReturnUri(requestUrl: string, native: boolean) {
  return native ? 'ontrack://calendar/google' : `${new URL(requestUrl).origin}/profile/calendar-sync`;
}

export function googleCalendarAccountChanged(currentEmail: string | null | undefined, nextEmail: string | undefined) {
  return Boolean(
    currentEmail?.trim()
    && nextEmail?.trim()
    && currentEmail.trim().toLocaleLowerCase() !== nextEmail.trim().toLocaleLowerCase(),
  );
}

export function googleCalendarErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export function googleCalendarAdmin() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  if (!url) throw new Error('SUPABASE_URL is not configured.');
  return createClient(url, required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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

export async function createCalendarOAuthState(userId: string, returnUri: string) {
  const payload = base64url(encoder.encode(JSON.stringify({ userId, returnUri, exp: Date.now() + 10 * 60_000 })));
  return `${payload}.${await hmac(payload)}`;
}

export async function readCalendarOAuthState(state: string) {
  const [payload, signature] = state.split('.');
  if (!payload || !signature || signature !== await hmac(payload)) throw new Error('Invalid OAuth state.');
  const parsed = JSON.parse(decoder.decode(fromBase64url(payload))) as { userId?: string; returnUri?: string; exp?: number };
  if (!parsed.userId || !parsed.returnUri || !parsed.exp || parsed.exp < Date.now()) throw new Error('Expired OAuth state.');
  return parsed as { userId: string; returnUri: string; exp: number };
}

async function encryptionKey() {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(required('GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY')));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptToken(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), encoder.encode(value));
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`;
}

export async function decryptGoogleCalendarToken(value: string) {
  const [version, iv, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !encrypted) throw new Error('Stored calendar credential is invalid.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64url(iv) }, await encryptionKey(), fromBase64url(encrypted));
  return decoder.decode(plain);
}

export function googleOAuthUrl(state: string, redirectUri: string) {
  const query = new URLSearchParams({
    client_id: required('GOOGLE_CALENDAR_CLIENT_ID'),
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'false',
    scope: `openid email ${GOOGLE_CALENDAR_EVENTS_SCOPE}`,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}

export async function exchangeGoogleCalendarCode(userId: string, code: string, redirectUri: string) {
  const response = await fetchGoogleApi('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: required('GOOGLE_CALENDAR_CLIENT_ID'), client_secret: required('GOOGLE_CALENDAR_CLIENT_SECRET'), redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  const tokens = await response.json() as { access_token?: string; refresh_token?: string; scope?: string; error_description?: string };
  if (!response.ok || !tokens.access_token || !tokens.refresh_token) throw new Error(tokens.error_description || 'Google did not return offline calendar access.');
  if (!hasGoogleCalendarWriteScope(tokens.scope)) throw new Error('Google did not grant Calendar event access. Choose Allow for Google Calendar and try again.');
  const identityResponse = await fetchGoogleApi('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const identity = identityResponse.ok ? await identityResponse.json() as { email?: string } : {};
  const db = googleCalendarAdmin();
  const { data: currentConnection, error: connectionError } = await db.from('google_calendar_connections')
    .select('google_email')
    .eq('user_id', userId)
    .maybeSingle();
  if (connectionError) throw connectionError;
  if (googleCalendarAccountChanged(currentConnection?.google_email, identity.email)) {
    const { error: linksError } = await db.from('google_calendar_event_links').delete().eq('user_id', userId);
    if (linksError) throw linksError;
  }
  const { error } = await db.from('google_calendar_connections').upsert({
    user_id: userId,
    google_email: identity.email ?? null,
    refresh_token_ciphertext: await encryptToken(tokens.refresh_token),
    calendar_id: 'primary',
    connected_at: new Date().toISOString(),
    last_synced_at: null,
  });
  if (error) throw error;
}

export async function googleCalendarAccessToken(refreshTokenCiphertext: string) {
  const response = await fetchGoogleApi('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: required('GOOGLE_CALENDAR_CLIENT_ID'), client_secret: required('GOOGLE_CALENDAR_CLIENT_SECRET'), refresh_token: await decryptGoogleCalendarToken(refreshTokenCiphertext), grant_type: 'refresh_token' }),
  });
  const result = await response.json() as { access_token?: string; scope?: string; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error_description || 'Google Calendar access expired. Reconnect your calendar.');
  if (!hasGoogleCalendarWriteScope(result.scope)) throw new Error('Google Calendar permission needs to be renewed. Reconnect and choose Allow for Calendar event access.');
  return result.access_token;
}

export async function revokeGoogleCalendarToken(refreshToken: string) {
  await fetchGoogleApi(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).catch(() => undefined);
}
