import { createClient } from '@supabase/supabase-js';

import {
  apiRateLimitSubject,
  authenticateApiRequest,
  isApiRequestBlocked,
} from '@/services/http/api-auth';
import { checkApiRateLimit } from '@/services/http/api-rate-limit';
import { apiCorsHeaders, apiOptionsResponse } from '@/services/http/cors';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type TellerEnvironment = 'sandbox' | 'development' | 'production';
export type TellerGatewayOperation = 'accounts' | 'balances' | 'transactions' | 'disconnect';

export class TellerServerError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status = 502,
  ) {
    super(message);
    this.name = 'TellerServerError';
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new TellerServerError(`${name} is not configured.`, 'NOT_CONFIGURED', 503);
  return value;
}

export function tellerEnvironment(): TellerEnvironment {
  const value = (process.env.TELLER_ENVIRONMENT ?? 'development').trim();
  if (value === 'sandbox' || value === 'development' || value === 'production') return value;
  throw new TellerServerError(
    'TELLER_ENVIRONMENT must be sandbox, development, or production.',
    'INVALID_ENV',
    503,
  );
}

export function tellerConfigured(): boolean {
  return Boolean(
    process.env.TELLER_APPLICATION_ID?.trim() &&
      process.env.TELLER_SIGNING_KEY?.trim() &&
      process.env.TELLER_TOKEN_ENCRYPTION_KEY?.trim() &&
      process.env.TELLER_GATEWAY_URL?.trim() &&
      process.env.TELLER_GATEWAY_SHARED_SECRET?.trim() &&
      (process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

function adminClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  if (!url) throw new TellerServerError('SUPABASE_URL is not configured.', 'NOT_CONFIGURED', 503);
  return createClient(url, required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeFlexible(value: string): Uint8Array {
  const trimmed = value.trim();
  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
    return Uint8Array.from(trimmed.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
  }
  const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function tokenHash(value: string): Promise<string> {
  return base64url(await sha256(value));
}

async function tokenEncryptionKey() {
  const secret = required('TELLER_TOKEN_ENCRYPTION_KEY');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptAccessToken(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await tokenEncryptionKey(),
    encoder.encode(value),
  );
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(ciphertext))}`;
}

async function decryptAccessToken(value: string): Promise<string> {
  const [version, iv, ciphertext] = value.split('.');
  if (version !== 'v1' || !iv || !ciphertext) {
    throw new TellerServerError('Stored Teller credential is invalid.', 'INVALID_CREDENTIAL', 503);
  }
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: arrayBuffer(decodeFlexible(iv)) },
    await tokenEncryptionKey(),
    arrayBuffer(decodeFlexible(ciphertext)),
  );
  return decoder.decode(plain);
}

function randomCapability(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function createTellerSession(userId: string): Promise<{
  sessionId: string;
  nonce: string;
  expiresAt: string;
}> {
  const sessionId = randomCapability();
  const nonce = randomCapability();
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const db = adminClient();
  const { error: cleanupError } = await db
    .from('teller_link_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString());
  if (cleanupError) throw cleanupError;
  const { error } = await db.from('teller_link_sessions').insert({
    session_token_hash: await tokenHash(sessionId),
    user_id: userId,
    nonce,
    environment: tellerEnvironment(),
    expires_at: expiresAt,
  });
  if (error) throw error;
  return { sessionId, nonce, expiresAt };
}

type TellerSession = {
  userId: string;
  nonce: string;
  environment: TellerEnvironment;
  expiresAt: string;
  completedAt?: string;
  enrollmentId?: string;
};

export async function loadTellerSession(sessionId: string, userId?: string): Promise<TellerSession> {
  const db = adminClient();
  let query = db
    .from('teller_link_sessions')
    .select('user_id,nonce,environment,expires_at,completed_at,enrollment_id')
    .eq('session_token_hash', await tokenHash(sessionId));
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) {
    throw new TellerServerError('This Teller session is missing or expired.', 'SESSION_EXPIRED', 400);
  }
  return {
    userId: data.user_id,
    nonce: data.nonce,
    environment: data.environment as TellerEnvironment,
    expiresAt: data.expires_at,
    completedAt: data.completed_at ?? undefined,
    enrollmentId: data.enrollment_id ?? undefined,
  };
}

function signingKeyBytes(): Uint8Array {
  const configured = required('TELLER_SIGNING_KEY');
  const pem = configured.match(/-----BEGIN PUBLIC KEY-----([\s\S]+)-----END PUBLIC KEY-----/);
  return decodeFlexible(pem ? pem[1]!.replace(/\s/g, '') : configured);
}

export async function verifyTellerEnrollmentSignature(input: {
  nonce: string;
  accessToken: string;
  userId: string;
  enrollmentId: string;
  environment: TellerEnvironment;
  signatures: string[];
}): Promise<boolean> {
  const keyBytes = signingKeyBytes();
  const format = keyBytes.byteLength === 32 ? 'raw' : 'spki';
  const key = await crypto.subtle.importKey(
    format,
    arrayBuffer(keyBytes),
    { name: 'Ed25519' },
    false,
    ['verify'],
  );
  const message = [
    input.nonce,
    input.accessToken,
    input.userId,
    input.enrollmentId,
    input.environment,
  ].join('.');
  const digest = await sha256(message);
  for (const signature of input.signatures) {
    try {
      if (await crypto.subtle.verify(
        'Ed25519',
        key,
        arrayBuffer(decodeFlexible(signature)),
        arrayBuffer(digest),
      )) return true;
    } catch {
      // Try the remaining key-rotation signatures.
    }
  }
  return false;
}

export async function completeTellerSession(input: {
  sessionId: string;
  accessToken: string;
  tellerUserId: string;
  enrollmentId: string;
  institutionName?: string;
  signatures: string[];
}): Promise<void> {
  const session = await loadTellerSession(input.sessionId);
  if (session.completedAt) {
    throw new TellerServerError('This Teller session was already used.', 'SESSION_REPLAYED', 409);
  }
  const verified = await verifyTellerEnrollmentSignature({
    nonce: session.nonce,
    accessToken: input.accessToken,
    userId: input.tellerUserId,
    enrollmentId: input.enrollmentId,
    environment: session.environment,
    signatures: input.signatures,
  });
  if (!verified) {
    throw new TellerServerError('Teller enrollment signature is invalid.', 'INVALID_SIGNATURE', 400);
  }
  const db = adminClient();
  const { error } = await db.rpc('complete_teller_link_session', {
    p_session_token_hash: await tokenHash(input.sessionId),
    p_enrollment_id: input.enrollmentId,
    p_access_token_ciphertext: await encryptAccessToken(input.accessToken),
    p_institution_name: input.institutionName ?? '',
  });
  if (error) {
    throw new TellerServerError(
      'This Teller session is missing, expired, or already used.',
      'SESSION_REPLAYED',
      409,
    );
  }
}

export type StoredTellerEnrollment = {
  enrollmentId: string;
  accessToken: string;
  institutionName?: string;
  lastSyncedAt?: string;
};

export async function loadTellerEnrollment(
  userId: string,
  enrollmentId: string,
): Promise<StoredTellerEnrollment> {
  const db = adminClient();
  const { data, error } = await db
    .from('teller_enrollments')
    .select('enrollment_id,access_token_ciphertext,institution_name,last_synced_at')
    .eq('user_id', userId)
    .eq('enrollment_id', enrollmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new TellerServerError('Teller enrollment was not found.', 'ENROLLMENT_NOT_FOUND', 404);
  return {
    enrollmentId: data.enrollment_id,
    accessToken: await decryptAccessToken(data.access_token_ciphertext),
    institutionName: data.institution_name ?? undefined,
    lastSyncedAt: data.last_synced_at ?? undefined,
  };
}

export async function markTellerSynced(userId: string, enrollmentId: string): Promise<void> {
  const db = adminClient();
  const { error } = await db
    .from('teller_enrollments')
    .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('enrollment_id', enrollmentId);
  if (error) throw error;
}

export async function deleteTellerEnrollmentRecord(
  userId: string,
  enrollmentId: string,
): Promise<void> {
  const db = adminClient();
  const { error } = await db
    .from('teller_enrollments')
    .delete()
    .eq('user_id', userId)
    .eq('enrollment_id', enrollmentId);
  if (error) throw error;
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return [...signed].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function tellerGatewayRequest<T>(input: {
  operation: TellerGatewayOperation;
  accessToken: string;
  accountId?: string;
  query?: Record<string, string>;
}): Promise<T> {
  const body = JSON.stringify(input);
  const timestamp = String(Date.now());
  const nonce = randomCapability();
  const signature = await hmacHex(
    required('TELLER_GATEWAY_SHARED_SECRET'),
    `${timestamp}.${nonce}.${body}`,
  );
  const response = await fetch(required('TELLER_GATEWAY_URL'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OnTrack-Timestamp': timestamp,
      'X-OnTrack-Nonce': nonce,
      'X-OnTrack-Signature': signature,
    },
    body,
  });
  const data = await response.json().catch(() => ({})) as T & {
    error?: { message?: string; code?: string } | string;
    code?: string;
  };
  if (!response.ok) {
    const message = typeof data.error === 'string'
      ? data.error
      : data.error?.message ?? 'Teller request failed.';
    const code = typeof data.error === 'object' ? data.error?.code : data.code;
    throw new TellerServerError(message, code ?? data.code, response.status >= 500 ? 503 : response.status);
  }
  return data;
}

type TellerApiHandler = (request: Request, userId: string) => Promise<unknown | Response>;

export function tellerApiOptions(request: Request, methods = 'POST, OPTIONS'): Response {
  return apiOptionsResponse(request, methods);
}

export async function withTellerApiAuth(
  request: Request,
  handler: TellerApiHandler,
  options: { rateLimit?: boolean } = {},
): Promise<Response> {
  const cors = apiCorsHeaders(request, 'POST, OPTIONS');
  const auth = await authenticateApiRequest(request);
  if (isApiRequestBlocked(auth) || auth.status !== 'ok') {
    return Response.json(
      { error: 'Sign in to onTrack before using Teller.', code: 'PERMISSION_DENIED' },
      { status: 401, headers: cors },
    );
  }
  if (
    options.rateLimit !== false &&
    checkApiRateLimit('finance', apiRateLimitSubject(request, auth)) === 'limited'
  ) {
    return Response.json(
      { error: 'Teller request limit reached. Try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: cors },
    );
  }
  if (!tellerConfigured()) {
    return Response.json(
      { configured: false, error: 'Teller is not configured on the server.', code: 'NOT_CONFIGURED' },
      { status: 503, headers: cors },
    );
  }
  try {
    const result = await handler(request, auth.userId);
    if (result instanceof Response) return result;
    return Response.json(result, { headers: cors });
  } catch (error) {
    const status = error instanceof TellerServerError ? error.status : 503;
    const code = error instanceof TellerServerError ? error.code : undefined;
    const message = error instanceof Error ? error.message : 'Teller request failed.';
    return Response.json({ configured: true, error: message, code }, { status, headers: cors });
  }
}
