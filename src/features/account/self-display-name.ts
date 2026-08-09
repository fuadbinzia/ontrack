import type { User } from '@supabase/supabase-js';

import { asNonEmptyString, asString } from '@/utils/parse';

/**
 * Best display name for the signed-in (or guest) user.
 * Prefers welcome/prefs name, then SSO metadata, then email local-part.
 * Skips the legacy "You" placeholder; empty guests fall back to "Guest".
 */
export function resolveSelfDisplayName(input: {
  preferencesName?: string | null;
  user?: Pick<User, 'email' | 'user_metadata'> | null;
  fallback?: string;
}): string {
  const fromPrefs = asNonEmptyString(input.preferencesName)?.trim();
  if (fromPrefs && !/^you$/i.test(fromPrefs)) return fromPrefs;

  const meta = input.user?.user_metadata ?? {};
  const fromMeta =
    asNonEmptyString(meta.full_name) ??
    asNonEmptyString(meta.name) ??
    asNonEmptyString(meta.given_name);
  if (fromMeta && !/^you$/i.test(fromMeta)) return fromMeta;

  const email = asString(input.user?.email)?.trim();
  if (email) {
    const local = email.split('@')[0]?.trim();
    if (local) return local;
  }

  return input.fallback?.trim() || 'Guest';
}
