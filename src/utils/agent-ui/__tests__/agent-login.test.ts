import {
    hasAgentUiLoginHandler,
    resetAgentUiLoginHandler,
    runAgentUiLogin,
    setAgentUiLoginHandler,
} from '../agent-login';
import { handleAgentUiRequest } from '../handle-agent-ui-url';
import { setAgentUiRoute } from '../route';

const mockWrite = jest.fn();

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///documents' },
  File: jest.fn().mockImplementation(() => ({
    exists: false,
    create: jest.fn(),
    write: mockWrite,
  })),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: '127.0.0.1:8081' } },
}));

jest.mock('../http-bridge', () => ({
  getAgentUiActiveNonce: jest.fn(() => undefined),
  postAgentUiStatus: jest.fn(async () => undefined),
  setAgentUiActiveNonce: jest.fn(),
  fetchAgentUiCommand: jest.fn(async () => null),
  probeAgentUiHttp: jest.fn(async () => false),
  resolveAgentUiHttpBase: jest.fn(() => 'http://127.0.0.1:8191'),
  resetAgentUiHttpBaseCache: jest.fn(),
}));

const statuses: { op?: string; ok?: boolean; detail?: string; id?: string }[] = [];
jest.mock('../persist', () => ({
  writeAgentUiDump: jest.fn(() => ({ count: 0, route: '/', elements: [] })),
  writeAgentUiStatus: jest.fn(async (status: Record<string, unknown>) => {
    statuses.push(status);
  }),
}));

describe('agent-ui login op', () => {
  beforeEach(() => {
    statuses.length = 0;
    resetAgentUiLoginHandler();
    setAgentUiRoute('/welcome');
  });

  it('refuses to sign in outside __DEV__ builds', async () => {
    const handler = jest.fn();
    setAgentUiLoginHandler(handler);
    const dev = (globalThis as { __DEV__?: boolean }).__DEV__;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      const result = await runAgentUiLogin({
        email: 'agent_1@example.com',
        password: 'test-only',
      });
      expect(result.ok).toBe(false);
      expect(result.detail).toContain('__DEV__');
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses a request without both credentials', async () => {
    const handler = jest.fn();
    setAgentUiLoginHandler(handler);
    const result = await runAgentUiLogin({ email: 'agent_1@example.com' });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('agent-accounts-setup.sh');
    expect(handler).not.toHaveBeenCalled();
  });

  it('reports a clear retry when auth has not mounted yet', async () => {
    expect(hasAgentUiLoginHandler()).toBe(false);
    const result = await runAgentUiLogin({
      email: 'agent_1@example.com',
      password: 'test-only',
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('not mounted yet');
  });

  it('delegates to the auth handler and never echoes the password', async () => {
    setAgentUiLoginHandler(async ({ email }) => ({
      ok: true,
      detail: `signed in as ${email}`,
      email,
      userId: 'user-1',
    }));

    const ok = await handleAgentUiRequest({
      op: 'login',
      email: 'agent_3@example.com',
      password: 'super-secret',
    });

    expect(ok).toBe(true);
    const status = statuses.at(-1);
    expect(status).toMatchObject({
      op: 'login',
      ok: true,
      id: 'agent_3@example.com',
    });
    expect(JSON.stringify(statuses)).not.toContain('super-secret');
  });

  it('surfaces a handler rejection as a failed status', async () => {
    setAgentUiLoginHandler(async () => ({
      ok: false,
      detail: 'agent_9@example.com is not an agent test account (account_flags.agent_test) — signed out',
    }));

    const ok = await handleAgentUiRequest({
      op: 'login',
      email: 'agent_9@example.com',
      password: 'test-only',
    });

    expect(ok).toBe(false);
    expect(statuses.at(-1)).toMatchObject({ op: 'login', ok: false });
    expect(statuses.at(-1)?.detail).toContain('agent_test');
  });

  it('unregisters cleanly so a remount cannot leave a stale handler', () => {
    const unregister = setAgentUiLoginHandler(async () => ({ ok: true, detail: 'ok' }));
    expect(hasAgentUiLoginHandler()).toBe(true);
    unregister();
    expect(hasAgentUiLoginHandler()).toBe(false);
  });
});
