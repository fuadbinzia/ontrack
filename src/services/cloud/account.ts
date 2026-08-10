import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { getSupabaseClient } from './supabase';

export type AuthProvider = 'google' | 'apple';

export class CloudAccountError extends Error {}
export class ProviderCancelledError extends Error {}

WebBrowser.maybeCompleteAuthSession();
let lastCallbackCode: string | undefined;
let lastCallbackExchange: ReturnType<ReturnType<typeof requireClient>['auth']['exchangeCodeForSession']> | undefined;

export function shouldUseNativeApple(provider: AuthProvider, platform: string) {
  return provider === 'apple' && platform === 'ios';
}

export function isProviderCancellation(error: unknown) {
  if (error instanceof ProviderCancelledError) return true;
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  // Expo uses ERR_REQUEST_CANCELED, while native auth bridges can surface the
  // same cancellation with one of the common spelling/code variants.
  return ['ERR_REQUEST_CANCELED', 'ERR_REQUEST_CANCELLED', 'ERR_CANCELED', 'ERR_CANCELLED'].includes(
    code,
  );
}

export function appleNameMetadata(fullName?: {
  givenName?: string | null;
  familyName?: string | null;
}) {
  const givenName = fullName?.givenName?.trim() || undefined;
  const familyName = fullName?.familyName?.trim() || undefined;
  const displayName = [givenName, familyName].filter(Boolean).join(' ').trim();
  return displayName
    ? { full_name: displayName, given_name: givenName, family_name: familyName }
    : undefined;
}

export function accessibleAuthError(error: unknown) {
  const fallback = 'Sign-in could not be completed. Check your connection and try again.';
  const objectMessage =
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : undefined;
  const message = (error instanceof Error ? error.message : objectMessage)?.trim() || fallback;
  if (/network|fetch|offline/i.test(message)) {
    return 'You appear to be offline. Reconnect and try again, or continue as a guest.';
  }
  if (/configured|configuration|provider is not enabled/i.test(message)) {
    return 'Account sign-in is unavailable in this build. You can continue as a guest.';
  }
  if (/malformed|valid code|match this device|not started from this device/i.test(message)) {
    return 'That sign-in link is invalid or expired. Start again from this device.';
  }
  if (/app_state_domain_check|addon_entitlements_addon_id_check/i.test(message)) {
    return 'Cloud sync needs a database update before this account can finish signing in. Apply the latest Supabase migrations, then try again.';
  }
  if (/violates check constraint|duplicate key value|permission denied for/i.test(message)) {
    return 'Cloud sync could not save your account data. Try again in a moment, or continue as a guest.';
  }
  return message || fallback;
}

function requireClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new CloudAccountError(
      'Account sign-in is not configured for this build. You can continue as a guest.',
    );
  }
  return client;
}

export function oauthRedirectUrl() {
  return Platform.OS === 'web' ? Linking.createURL('auth/callback') : 'ontrack://auth/callback';
}

/** Normalize custom-scheme callback URLs so host/path variants match. */
export function oauthCallbackRouteKey(url: string) {
  const parsed = new URL(url);
  const path = `${parsed.host}${parsed.pathname}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return `${parsed.protocol}//${path.replace(/^\//, '')}`;
}

export function oauthCodeFromUrl(url: string, expectedRedirect = oauthRedirectUrl()) {
  let callback: URL;
  try {
    callback = new URL(url);
    // Validate expectedRedirect parses; compare via route key so Android’s
    // `ontrack:///auth/callback` matches `ontrack://auth/callback`.
    void new URL(expectedRedirect);
  } catch {
    throw new CloudAccountError('The sign-in response was malformed. Please try again.');
  }
  if (oauthCallbackRouteKey(url) !== oauthCallbackRouteKey(expectedRedirect)) {
    throw new CloudAccountError('The sign-in response did not match this device.');
  }
  const providerError = callback.searchParams.get('error_description') ?? callback.searchParams.get('error');
  if (providerError) throw new CloudAccountError(providerError);
  const code = callback.searchParams.get('code');
  if (!code) throw new CloudAccountError('The sign-in response did not include a valid code.');
  return code;
}

/** Test helper — clears in-flight callback dedupe between cases. */
export function resetOAuthCallbackExchangeForTests() {
  lastCallbackCode = undefined;
  lastCallbackExchange = undefined;
}

export async function exchangeOAuthCallback(url: string) {
  const code = oauthCodeFromUrl(url);
  if (lastCallbackCode !== code || !lastCallbackExchange) {
    lastCallbackCode = code;
    lastCallbackExchange = requireClient().auth.exchangeCodeForSession(code);
  }
  try {
    const { data, error } = await lastCallbackExchange;
    if (error) throw new CloudAccountError(error.message);
    if (!data.session) {
      throw new CloudAccountError('Sign-in did not establish a session. Please try again.');
    }
    return data.session;
  } catch (exchangeError) {
    // Do not cache a failed exchange forever — a retry with the same code
    // (after a transient network blip) must hit Supabase again.
    lastCallbackCode = undefined;
    lastCallbackExchange = undefined;
    throw exchangeError;
  }
}

export async function beginBrowserSignIn(provider: AuthProvider) {
  const client = requireClient();
  const redirectTo = oauthRedirectUrl();
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });
  if (error) throw new CloudAccountError(error.message);
  if (Platform.OS === 'web') return undefined;
  if (!data.url) throw new CloudAccountError('The provider did not return a sign-in page.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new ProviderCancelledError('Sign-in was cancelled.');
  }
  if (result.type !== 'success' || !result.url) {
    throw new CloudAccountError('The provider could not complete sign-in.');
  }
  return exchangeOAuthCallback(result.url);
}

export async function beginNativeAppleSignIn() {
  const AppleAuthentication = await import('expo-apple-authentication');
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) return beginBrowserSignIn('apple');
  try {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) {
      throw new CloudAccountError('Apple did not return a valid identity token.');
    }
    const metadata = appleNameMetadata(credential.fullName ?? undefined);
    const { data, error } = await requireClient().auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) throw new CloudAccountError(error.message);
    if (!data.session) {
      throw new CloudAccountError('Sign-in did not establish a session. Please try again.');
    }
    if (metadata && data.user) {
      const { error: metadataError } = await requireClient().auth.updateUser({
        data: {
          ...data.user.user_metadata,
          ...metadata,
        },
      });
      // Apple only returns the person's name on the first authorization.
      // Authentication remains usable if metadata persistence has a transient
      // failure; the identity token has already been validated by Supabase.
      if (metadataError) return data.session;
    }
    return data.session;
  } catch (error) {
    if (isProviderCancellation(error)) {
      throw new ProviderCancelledError('Sign-in was cancelled.');
    }
    throw error;
  }
}

export async function signOutLocalSession() {
  const { error } = await requireClient().auth.signOut({ scope: 'local' });
  if (error) throw new CloudAccountError(error.message);
}

/**
 * Permanently deletes the signed-in auth user and cascaded cloud data.
 * Call while a session is still active; local tokens are cleared afterward
 * so a relaunch cannot resurrect a zombie session for the deleted user.
 */
export async function deleteOwnCloudAccount() {
  const { error } = await requireClient().rpc('delete_own_account');
  if (error) {
    throw new CloudAccountError(
      error.message || 'Account deletion could not be completed. Try again in a moment.',
    );
  }
  try {
    await signOutLocalSession();
  } catch {
    // Server already deleted the user; local sign-out may report an error.
  }
}
