/** SSO providers onTrack surfaces on the Profile account card. */
export type AccountSsoProvider = 'apple' | 'google';

const PROVIDER_LABEL: Record<AccountSsoProvider, string> = {
  apple: 'Apple',
  google: 'Google',
};

function asSsoProvider(raw: unknown): AccountSsoProvider | undefined {
  return raw === 'apple' || raw === 'google' ? raw : undefined;
}

export type AccountProviderUser = {
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  identities?: Array<{
    provider: string;
    last_sign_in_at?: string;
  }>;
};

/**
 * Label for the SSO method used for the current session (one provider only).
 *
 * Prefer the provider recorded at sign-in. Otherwise use the identity with the
 * newest `last_sign_in_at`. Never trust `app_metadata.provider` alone after
 * linking — Supabase keeps that as the first signup provider.
 */
export function accountProviderLabel(
  user: AccountProviderUser | null | undefined,
  activeSignInProvider?: AccountSsoProvider | null,
): string {
  const active = asSsoProvider(activeSignInProvider);
  if (active) return PROVIDER_LABEL[active];

  let best: { provider: AccountSsoProvider; stamp: number } | undefined;
  for (const identity of user?.identities ?? []) {
    const provider = asSsoProvider(identity.provider);
    if (!provider) continue;
    const at = identity.last_sign_in_at ? Date.parse(identity.last_sign_in_at) : NaN;
    const stamp = Number.isFinite(at) ? at : 0;
    if (!best || stamp > best.stamp) {
      best = { provider, stamp };
    }
  }
  if (best) return PROVIDER_LABEL[best.provider];

  const primary = asSsoProvider(user?.app_metadata?.provider);
  if (primary) return PROVIDER_LABEL[primary];

  return 'Existing account';
}
