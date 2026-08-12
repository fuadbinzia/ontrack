import { createClient } from '@supabase/supabase-js';

import {
  apiRateLimitSubject,
  authenticateApiRequest,
  isApiRequestBlocked,
} from '@/services/http/api-auth';
import { checkApiRateLimit } from '@/services/http/api-rate-limit';
import { apiCorsHeaders, apiOptionsResponse } from '@/services/http/cors';

import type { PlaidLinkPurpose } from './plaid';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class PlaidServerError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status = 502,
  ) {
    super(message);
    this.name = 'PlaidServerError';
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new PlaidServerError(`${name} is not configured.`, 'NOT_CONFIGURED', 503);
  return value;
}

export function plaidConfigured(): boolean {
  return Boolean(
    process.env.PLAID_CLIENT_ID?.trim() &&
      process.env.PLAID_SECRET?.trim() &&
      (process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

function plaidHost(): string {
  const environment = (
    process.env.PLAID_ENV ?? process.env.EXPO_PUBLIC_PLAID_ENV ?? 'sandbox'
  ).trim();
  if (environment === 'production') return 'production.plaid.com';
  if (environment === 'development') return 'development.plaid.com';
  if (environment === 'sandbox') return 'sandbox.plaid.com';
  throw new PlaidServerError('PLAID_ENV must be sandbox, development, or production.', 'INVALID_ENV', 503);
}

export async function plaidRequest<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://${plaidHost()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: required('PLAID_CLIENT_ID'),
      secret: required('PLAID_SECRET'),
      ...payload,
    }),
  });
  const body = await response.json().catch(() => ({})) as T & {
    error_code?: string;
    error_message?: string;
  };
  if (!response.ok) {
    throw new PlaidServerError(
      body.error_message || 'Plaid request failed.',
      body.error_code,
      response.status >= 500 ? 503 : 502,
    );
  }
  return body;
}

function adminClient() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  if (!url) throw new PlaidServerError('SUPABASE_URL is not configured.', 'NOT_CONFIGURED', 503);
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

function fromBase64url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function tokenEncryptionKey() {
  const secret =
    process.env.PLAID_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) {
    throw new PlaidServerError('PLAID_TOKEN_ENCRYPTION_KEY is not configured.', 'NOT_CONFIGURED', 503);
  }
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptAccessToken(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await tokenEncryptionKey(),
    encoder.encode(value),
  );
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`;
}

async function decryptAccessToken(value: string): Promise<string> {
  const [version, iv, ciphertext] = value.split('.');
  if (version !== 'v1' || !iv || !ciphertext) {
    throw new PlaidServerError('Stored Plaid credential is invalid.', 'INVALID_CREDENTIAL', 503);
  }
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64url(iv) },
    await tokenEncryptionKey(),
    fromBase64url(ciphertext),
  );
  return decoder.decode(plain);
}

async function linkTokenHash(linkToken: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(linkToken));
  return base64url(new Uint8Array(digest));
}

export async function storePlaidLinkSession(input: {
  linkToken: string;
  userId: string;
  purpose: PlaidLinkPurpose;
  expiration: string;
}): Promise<void> {
  const db = adminClient();
  const now = new Date().toISOString();
  const { error: cleanupError } = await db
    .from('plaid_link_sessions')
    .delete()
    .lt('expires_at', now);
  if (cleanupError) throw cleanupError;
  const { error } = await db.from('plaid_link_sessions').upsert({
    link_token_hash: await linkTokenHash(input.linkToken),
    user_id: input.userId,
    purpose: input.purpose,
    expires_at: input.expiration,
  });
  if (error) throw error;
}

export async function requirePlaidLinkSession(
  linkToken: string,
  userId: string,
): Promise<{ purpose: PlaidLinkPurpose }> {
  const db = adminClient();
  const { data, error } = await db
    .from('plaid_link_sessions')
    .select('purpose,expires_at')
    .eq('link_token_hash', await linkTokenHash(linkToken))
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) {
    throw new PlaidServerError('This Plaid Link session is missing or expired.', 'LINK_SESSION_EXPIRED', 400);
  }
  return { purpose: data.purpose === 'investments' ? 'investments' : 'transactions' };
}

export async function deletePlaidLinkSession(linkToken: string): Promise<void> {
  const db = adminClient();
  const { error } = await db
    .from('plaid_link_sessions')
    .delete()
    .eq('link_token_hash', await linkTokenHash(linkToken));
  if (error) throw error;
}

export type StoredPlaidItem = {
  itemId: string;
  accessToken: string;
  purpose: PlaidLinkPurpose;
  institutionId?: string;
  institutionName?: string;
  cursor: string | null;
};

export async function savePlaidItem(input: {
  userId: string;
  itemId: string;
  accessToken: string;
  purpose: PlaidLinkPurpose;
  institutionId?: string;
  institutionName?: string;
  cursor?: string | null;
}): Promise<void> {
  const db = adminClient();
  const { error } = await db.from('plaid_items').upsert({
    user_id: input.userId,
    item_id: input.itemId,
    access_token_ciphertext: await encryptAccessToken(input.accessToken),
    purpose: input.purpose,
    institution_id: input.institutionId ?? null,
    institution_name: input.institutionName ?? null,
    transactions_cursor: input.cursor ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function loadPlaidItem(userId: string, itemId: string): Promise<StoredPlaidItem> {
  const db = adminClient();
  const { data, error } = await db
    .from('plaid_items')
    .select('item_id,access_token_ciphertext,purpose,institution_id,institution_name,transactions_cursor')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new PlaidServerError('Plaid Item was not found.', 'ITEM_NOT_FOUND', 404);
  return {
    itemId: data.item_id,
    accessToken: await decryptAccessToken(data.access_token_ciphertext),
    purpose: data.purpose === 'investments' ? 'investments' : 'transactions',
    institutionId: data.institution_id ?? undefined,
    institutionName: data.institution_name ?? undefined,
    cursor: data.transactions_cursor,
  };
}

export async function updatePlaidCursor(
  userId: string,
  itemId: string,
  cursor: string,
): Promise<void> {
  const db = adminClient();
  const { error } = await db
    .from('plaid_items')
    .update({ transactions_cursor: cursor, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('item_id', itemId);
  if (error) throw error;
}

export async function deletePlaidItemRecord(userId: string, itemId: string): Promise<void> {
  const db = adminClient();
  const { error } = await db
    .from('plaid_items')
    .delete()
    .eq('user_id', userId)
    .eq('item_id', itemId);
  if (error) throw error;
}

type PlaidApiHandler = (request: Request, userId: string) => Promise<unknown | Response>;

export function plaidApiOptions(request: Request, methods = 'POST, OPTIONS'): Response {
  return apiOptionsResponse(request, methods);
}

export async function withPlaidApiAuth(
  request: Request,
  handler: PlaidApiHandler,
  options: { rateLimit?: boolean } = {},
): Promise<Response> {
  const methods = 'POST, OPTIONS';
  const cors = apiCorsHeaders(request, methods);
  const auth = await authenticateApiRequest(request);
  if (isApiRequestBlocked(auth) || auth.status !== 'ok') {
    return Response.json(
      { error: 'Sign in to onTrack before using Plaid.', code: 'PERMISSION_DENIED' },
      { status: 401, headers: cors },
    );
  }
  if (
    options.rateLimit !== false &&
    checkApiRateLimit('finance', apiRateLimitSubject(request, auth)) === 'limited'
  ) {
    return Response.json(
      { error: 'Plaid request limit reached. Try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: cors },
    );
  }
  if (!plaidConfigured()) {
    return Response.json(
      { configured: false, error: 'Plaid is not configured on the server.' },
      { status: 503, headers: cors },
    );
  }
  try {
    const result = await handler(request, auth.userId);
    if (result instanceof Response) return result;
    return Response.json(result, { headers: cors });
  } catch (error) {
    const status = error instanceof PlaidServerError ? error.status : 503;
    const code = error instanceof PlaidServerError ? error.code : undefined;
    const message = error instanceof Error ? error.message : 'Plaid request failed.';
    return Response.json(
      { configured: true, error: message, code },
      { status, headers: cors },
    );
  }
}
