/** Dev-only `login` op registry. Creds on daemon body only — never deep link. */

export interface AgentUiLoginRequest {
  email: string;
  password: string;
}

export interface AgentUiLoginResult {
  ok: boolean;
  detail: string;
  userId?: string;
  email?: string;
}

export type AgentUiLoginHandler = (
  request: AgentUiLoginRequest,
) => Promise<AgentUiLoginResult>;

let handler: AgentUiLoginHandler | null = null;

/** Returns an unregister function (auth provider effect cleanup). */
export function setAgentUiLoginHandler(next: AgentUiLoginHandler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function hasAgentUiLoginHandler(): boolean {
  return handler !== null;
}

export function resetAgentUiLoginHandler(): void {
  handler = null;
}

export async function runAgentUiLogin(
  request: Partial<AgentUiLoginRequest>,
): Promise<AgentUiLoginResult> {
  if (!__DEV__) {
    return { ok: false, detail: 'Agent sign-in is only available in __DEV__ builds.' };
  }
  const email = (request.email ?? '').trim();
  const password = request.password ?? '';
  if (!email || !password) {
    return {
      ok: false,
      detail:
        'login needs email + password — run ./scripts/agent-accounts-setup.sh and keep them in .env.local',
    };
  }
  if (!handler) {
    return {
      ok: false,
      detail: 'auth is not mounted yet — retry once the app finishes launching',
    };
  }
  try {
    return await handler({ email, password });
  } catch (error) {
    const detail =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message)
        : 'agent sign-in failed';
    return { ok: false, detail };
  }
}
