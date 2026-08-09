import { loadAccountFlags } from '@/services/cloud/account-flags';
import { getSupabaseClient } from '@/services/cloud/supabase';
import type { AgentUiLoginResult } from '@/utils/agent-ui/agent-login';

/**
 * Dev-only agent_1…agent_4 sign-in. Gates: `__DEV__` + `account_flags.agent_test`.
 * Creds from host `.env.local` — never source / status output.
 */
export interface AgentAccountLoginInput {
  email: string;
  password: string;
  /** Clear local graph before switching away from another signed-in account. */
  onAccountSwitch?: () => Promise<void>;
}

export type AgentAccountLoginResult = AgentUiLoginResult;

export async function isAgentTestAccount(userId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { data, error } = await client
    .from('account_flags')
    .select('agent_test')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return false;
  return data.agent_test === true;
}

function authErrorDetail(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'sign-in failed');
  }
  return 'sign-in failed';
}

export async function signInAgentTestAccount({
  email,
  password,
  onAccountSwitch,
}: AgentAccountLoginInput): Promise<AgentAccountLoginResult> {
  if (!__DEV__) {
    return { ok: false, detail: 'Agent sign-in is only available in __DEV__ builds.' };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, detail: 'Cloud is not configured on this build.' };
  }
  const wanted = email.trim().toLowerCase();
  if (!wanted || !password) {
    return { ok: false, detail: 'Agent sign-in needs both an email and a password.' };
  }

  const { data: current } = await client.auth.getSession();
  const signedIn = current.session?.user;
  if (signedIn?.email?.toLowerCase() === wanted) {
    if (await isAgentTestAccount(signedIn.id)) {
      return {
        ok: true,
        detail: `already signed in as ${wanted}`,
        userId: signedIn.id,
        email: wanted,
      };
    }
  }
  if (signedIn) {
    await client.auth.signOut();
    if (onAccountSwitch) await onAccountSwitch();
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: wanted,
    password,
  });
  if (error || !data.user) {
    return { ok: false, detail: `sign-in rejected for ${wanted}: ${authErrorDetail(error)}` };
  }

  if (!(await isAgentTestAccount(data.user.id))) {
    await client.auth.signOut();
    return {
      ok: false,
      detail: `${wanted} is not an agent test account (account_flags.agent_test) — signed out`,
    };
  }

  await loadAccountFlags(data.user.id);
  return {
    ok: true,
    detail: `signed in as ${wanted}`,
    userId: data.user.id,
    email: wanted,
  };
}
