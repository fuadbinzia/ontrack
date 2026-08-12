import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { resolveExpoApiUrl } from '@/services/http/api-url';
import { apiRequest } from '@/services/http/api-client';
import type { StayPackage, StraiawayConnectResult, StraiawayLinkStatus } from '@/services/partner/types';

export class StraiawayPartnerError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
    this.name = 'StraiawayPartnerError';
  }
}

const STRAIAWAY_APP_STORE_URL = 'https://straiaway.app';

function endpoint(path: string) {
  const useHostedApi = __DEV__ && Platform.OS !== 'web';
  const configuredBaseUrl = useHostedApi
    ? process.env.EXPO_PUBLIC_PARTNER_API_BASE_URL || process.env.EXPO_PUBLIC_CALENDAR_API_BASE_URL || 'https://ontrack.expo.app'
    : process.env.EXPO_PUBLIC_API_BASE_URL;
  return resolveExpoApiUrl(path, {
    configuredBaseUrl,
    preferConfiguredFirst: useHostedApi || !__DEV__,
    requireHttpsInProduction: true,
    createNotConfiguredError: () =>
      new StraiawayPartnerError('StraiAway connect is not configured in this build.', 'NOT_CONFIGURED'),
  });
}

function request<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: unknown) {
  return apiRequest<T, StraiawayPartnerError>({
    url: endpoint(path),
    method,
    body,
    timeoutMs: 20_000,
    offlineMessage: 'You appear to be offline. Reconnect and try again.',
    unavailableMessage: 'StraiAway connect is temporarily unavailable.',
    createError: (message, code, status) => new StraiawayPartnerError(message, code, status),
  });
}

async function sha256Base64url(value: string) {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomVerifier() {
  return `${Crypto.randomUUID().replace(/-/g, '')}${Crypto.randomUUID().replace(/-/g, '')}`;
}

export function getStraiawayStatus() {
  return request<StraiawayLinkStatus>('/api/partner/straiaway/status');
}

export async function connectStraiaway() {
  const verifier = randomVerifier();
  const codeChallenge = await sha256Base64url(verifier);
  const result = await request<StraiawayConnectResult>(
    '/api/partner/straiaway/connect',
    'POST',
    { codeChallenge },
  );
  const nativeUrl = result.authorizeUrl.split('&web=')[0];
  const webUrl = (() => {
    try {
      const parsed = new URL(result.authorizeUrl.includes('web=')
        ? decodeURIComponent(result.authorizeUrl.split('web=')[1] ?? '')
        : 'https://straiaway.app/partner/ontrack');
      return parsed.toString();
    } catch {
      return `https://straiaway.app/partner/ontrack?code=${encodeURIComponent(result.code)}`;
    }
  })();
  const canOpen = await Linking.canOpenURL(nativeUrl).catch(() => false);
  await Linking.openURL(canOpen ? nativeUrl : webUrl);
  return { ...result, verifier };
}

export function confirmStraiawayCallback(code: string, codeVerifier: string) {
  return request<StraiawayLinkStatus>('/api/partner/straiaway/callback', 'POST', { code, codeVerifier });
}

export function disconnectStraiaway() {
  return request<{ connected: false }>('/api/partner/straiaway/disconnect', 'POST', {});
}

export function pushStraiawayStays(stays: StayPackage[]) {
  return request<{ pushed: number; lastSyncedAt: string }>('/api/partner/straiaway/stays', 'POST', { stays });
}

export function pullStraiawayStays() {
  return request<{ stays: StayPackage[]; lastSyncedAt: string }>('/api/partner/straiaway/stays');
}

export async function openStraiawayStay(reservationId?: string) {
  const native = reservationId
    ? `straiaway://stay/${encodeURIComponent(reservationId)}`
    : 'straiaway://partner/connect';
  const web = reservationId
    ? `https://straiaway.app/stay/${encodeURIComponent(reservationId)}`
    : 'https://straiaway.app/partner/ontrack';
  const canOpen = await Linking.canOpenURL(native).catch(() => false);
  if (canOpen) {
    await Linking.openURL(native);
    return;
  }
  await Linking.openURL(web === 'https://straiaway.app/partner/ontrack' ? STRAIAWAY_APP_STORE_URL : web);
}

export { STRAIAWAY_APP_STORE_URL };
