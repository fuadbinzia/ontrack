import { normalizeStayPackage, stayPackageKey } from '@/features/travel/stay-package';
import type { StayPackage, StraiAwayConnectResult, StraiAwayLinkStatus } from '@/services/partner/types';
import { PARTNER_SCOPES, PARTNER_STRAIAWAY } from '@/services/partner/types';

import {
  decryptPartnerToken,
  encryptPartnerToken,
  partnerAdmin,
  partnerSharedSecret,
  randomToken,
  readPartnerSecret,
  sha256Base64url,
  timingSafeEqual,
} from './crypto';

const CHALLENGE_TTL_MS = 10 * 60_000;
const SHARE_LINK_HOST = 'ontrack--links.expo.app';

export const STRAIAWAY_SCHEME_CONNECT = 'straiaway://partner/connect';
export const STRAIAWAY_UNIVERSAL_CONNECT = 'https://straiaway.app/partner/ontrack';
export const ONTRACK_PARTNER_RETURN = 'ontrack://partner/straiaway';
export const ONTRACK_PARTNER_UNIVERSAL = `https://${SHARE_LINK_HOST}/p/straiaway`;

type ChallengeRow = {
  code_hash: string;
  user_id: string;
  code_challenge: string;
  partner: string;
  expires_at: string;
  consumed_at: string | null;
  pending_partner_user_id: string | null;
};

type LinkRow = {
  user_id: string;
  partner: string;
  partner_user_id: string;
  partner_display_name: string | null;
  scopes: string[];
  inbound_token_hash: string;
  outbound_token_ciphertext: string;
  connected_at: string;
  last_synced_at: string | null;
};

function straiawayApiBase() {
  return (process.env.STRAIAWAY_PARTNER_API_BASE_URL?.trim() || 'http://localhost:3000/api').replace(/\/$/, '');
}

function authorizeUrlForCode(code: string) {
  const native = `${STRAIAWAY_SCHEME_CONNECT}?code=${encodeURIComponent(code)}`;
  const web = `${STRAIAWAY_UNIVERSAL_CONNECT}?code=${encodeURIComponent(code)}`;
  return `${native}&web=${encodeURIComponent(web)}`;
}

export async function createStraiAwayConnect(
  userId: string,
  codeChallenge: string,
): Promise<StraiAwayConnectResult> {
  const challenge = codeChallenge.trim();
  if (challenge.length < 16) throw new Error('A PKCE code challenge is required.');
  const code = randomToken(32);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const { error } = await partnerAdmin().from('partner_link_challenges').insert({
    code_hash: await sha256Base64url(code),
    user_id: userId,
    code_challenge: challenge,
    partner: PARTNER_STRAIAWAY,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return { authorizeUrl: authorizeUrlForCode(code), code, expiresAt };
}

function assertPartnerSecret(request: Request) {
  const expected = partnerSharedSecret();
  if (!expected) throw new Error('PARTNER_STRAIAWAY_SECRET is not configured.');
  const provided = readPartnerSecret(request);
  if (!provided || !timingSafeEqual(provided, expected)) {
    throw new Error('Partner secret is invalid.');
  }
}

async function loadChallenge(code: string): Promise<ChallengeRow> {
  const codeHash = await sha256Base64url(code);
  const { data, error } = await partnerAdmin()
    .from('partner_link_challenges')
    .select('*')
    .eq('code_hash', codeHash)
    .maybeSingle();
  if (error) throw error;
  const row = data as ChallengeRow | null;
  if (!row) throw new Error('Connect code is invalid.');
  if (row.consumed_at) throw new Error('Connect code was already used.');
  if (Date.parse(row.expires_at) < Date.now()) throw new Error('Connect code expired. Start again from onTrack.');
  return row;
}

export async function exchangeStraiAwayCode(
  request: Request,
  body: { code?: string; partnerUserId?: string; partnerDisplayName?: string },
) {
  assertPartnerSecret(request);
  const code = body.code?.trim();
  const partnerUserId = body.partnerUserId?.trim();
  if (!code || !partnerUserId) throw new Error('code and partnerUserId are required.');
  const challenge = await loadChallenge(code);
  const inboundToken = randomToken(32);
  const outboundToken = randomToken(32);
  const inboundHash = await sha256Base64url(inboundToken);
  const outboundCipher = await encryptPartnerToken(outboundToken);
  const connectedAt = new Date().toISOString();
  const admin = partnerAdmin();
  const { error: linkError } = await admin.from('partner_links').upsert({
    user_id: challenge.user_id,
    partner: PARTNER_STRAIAWAY,
    partner_user_id: partnerUserId,
    partner_display_name: body.partnerDisplayName?.trim() || null,
    scopes: [...PARTNER_SCOPES],
    inbound_token_hash: inboundHash,
    outbound_token_ciphertext: outboundCipher,
    connected_at: connectedAt,
    last_synced_at: null,
  });
  if (linkError) throw linkError;
  const { error: consumeError } = await admin
    .from('partner_link_challenges')
    .update({ consumed_at: connectedAt, pending_partner_user_id: partnerUserId })
    .eq('code_hash', challenge.code_hash);
  if (consumeError) throw consumeError;
  return {
    scopes: [...PARTNER_SCOPES],
    inboundToken,
    outboundToken,
    returnUri: `${ONTRACK_PARTNER_RETURN}?connected=1`,
    universalReturnUri: `${ONTRACK_PARTNER_UNIVERSAL}?connected=1`,
  };
}

export async function confirmStraiAwayCallback(userId: string, code: string, codeVerifier: string) {
  const codeHash = await sha256Base64url(code.trim());
  const { data, error } = await partnerAdmin()
    .from('partner_link_challenges')
    .select('*')
    .eq('code_hash', codeHash)
    .maybeSingle();
  if (error) throw error;
  const challenge = data as ChallengeRow | null;
  if (!challenge) throw new Error('Connect code is invalid.');
  if (challenge.user_id !== userId) throw new Error('Connect code belongs to another account.');
  const actual = await sha256Base64url(codeVerifier);
  if (!timingSafeEqual(challenge.code_challenge, actual)) throw new Error('PKCE verifier did not match.');
  return straiawayStatus(userId);
}

export async function straiawayStatus(userId: string): Promise<StraiAwayLinkStatus> {
  const { data, error } = await partnerAdmin()
    .from('partner_links')
    .select('partner_user_id, partner_display_name, scopes, connected_at, last_synced_at')
    .eq('user_id', userId)
    .eq('partner', PARTNER_STRAIAWAY)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { connected: false, scopes: [] };
  const row = data as Pick<LinkRow, 'partner_user_id' | 'partner_display_name' | 'scopes' | 'connected_at' | 'last_synced_at'>;
  return {
    connected: true,
    partnerUserId: row.partner_user_id,
    partnerDisplayName: row.partner_display_name ?? undefined,
    scopes: (row.scopes ?? []).filter((scope): scope is StraiAwayLinkStatus['scopes'][number] =>
      PARTNER_SCOPES.includes(scope as StraiAwayLinkStatus['scopes'][number]),
    ),
    connectedAt: row.connected_at,
    lastSyncedAt: row.last_synced_at ?? undefined,
  };
}

async function loadLink(userId: string): Promise<LinkRow> {
  const { data, error } = await partnerAdmin()
    .from('partner_links')
    .select('*')
    .eq('user_id', userId)
    .eq('partner', PARTNER_STRAIAWAY)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Connect StraiAway before syncing stays.');
  return data as LinkRow;
}

export async function disconnectStraiAway(userId: string) {
  const admin = partnerAdmin();
  await admin.from('partner_stay_packages').delete().eq('user_id', userId).eq('partner', PARTNER_STRAIAWAY);
  const { error } = await admin.from('partner_links').delete().eq('user_id', userId).eq('partner', PARTNER_STRAIAWAY);
  if (error) throw error;
  return { connected: false as const, scopes: [] };
}

async function markSynced(userId: string) {
  await partnerAdmin()
    .from('partner_links')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('partner', PARTNER_STRAIAWAY);
}

async function upsertLocalPackages(userId: string, packages: StayPackage[]) {
  const admin = partnerAdmin();
  for (const pkg of packages) {
    const key = stayPackageKey(pkg);
    const { error } = await admin.from('partner_stay_packages').upsert({
      user_id: userId,
      partner: PARTNER_STRAIAWAY,
      package_key: key,
      payload: pkg,
      updated_at: pkg.updatedAt,
    });
    if (error) throw error;
  }
}

async function listLocalPackages(userId: string): Promise<StayPackage[]> {
  const { data, error } = await partnerAdmin()
    .from('partner_stay_packages')
    .select('payload')
    .eq('user_id', userId)
    .eq('partner', PARTNER_STRAIAWAY);
  if (error) throw error;
  return (data ?? [])
    .map((row) => normalizeStayPackage((row as { payload: unknown }).payload))
    .filter((pkg): pkg is StayPackage => Boolean(pkg));
}

async function callStraiAway(
  outboundToken: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
) {
  const response = await fetch(`${straiawayApiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${outboundToken}`,
      'X-Partner-Name': 'ontrack',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload as { message?: string; error?: string }).message ||
      (payload as { error?: string }).error ||
      `StraiAway partner request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload;
}

export async function pushStraiAwayStays(userId: string, packages: StayPackage[]) {
  const link = await loadLink(userId);
  const normalized = packages.map(normalizeStayPackage).filter((pkg): pkg is StayPackage => Boolean(pkg));
  await upsertLocalPackages(userId, normalized);
  const outbound = await decryptPartnerToken(link.outbound_token_ciphertext);
  await callStraiAway(outbound, 'POST', '/partner/ontrack/stays', { stays: normalized });
  await markSynced(userId);
  return { pushed: normalized.length, lastSyncedAt: new Date().toISOString() };
}

export async function pullStraiAwayStays(userId: string): Promise<{ stays: StayPackage[]; lastSyncedAt: string }> {
  const link = await loadLink(userId);
  const outbound = await decryptPartnerToken(link.outbound_token_ciphertext);
  const payload = await callStraiAway(outbound, 'GET', '/partner/ontrack/stays');
  const remote = Array.isArray((payload as { stays?: unknown }).stays)
    ? (payload as { stays: unknown[] }).stays
    : Array.isArray(payload)
      ? payload
      : [];
  const stays = remote.map(normalizeStayPackage).filter((pkg): pkg is StayPackage => Boolean(pkg));
  await upsertLocalPackages(userId, stays);
  await markSynced(userId);
  const merged = await listLocalPackages(userId);
  return { stays: merged, lastSyncedAt: new Date().toISOString() };
}

export async function inboundStraiAwayStays(request: Request, packages: StayPackage[]) {
  const token = readPartnerSecret(request);
  if (!token) throw new Error('Partner token is required.');
  const tokenHash = await sha256Base64url(token);
  const { data, error } = await partnerAdmin()
    .from('partner_links')
    .select('user_id')
    .eq('inbound_token_hash', tokenHash)
    .eq('partner', PARTNER_STRAIAWAY)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Partner token is invalid.');
  const userId = (data as { user_id: string }).user_id;
  const stays = packages.map(normalizeStayPackage).filter((pkg): pkg is StayPackage => Boolean(pkg));
  await upsertLocalPackages(userId, stays);
  await markSynced(userId);
  return { accepted: stays.length };
}
