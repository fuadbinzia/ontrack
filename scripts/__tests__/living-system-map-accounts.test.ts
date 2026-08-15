import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { runRuntimeAccounts } from '../living-system-map-accounts.mjs';
import localEnv from '../lib/local-env.cjs';

const { loadLocalEnvFile } = localEnv as {
  loadLocalEnvFile: (filePath: string, environment?: NodeJS.ProcessEnv) => void;
};

const root = process.cwd();
const scriptPath = path.join(root, 'scripts/living-system-map-accounts.mjs');
const source = fs.readFileSync(scriptPath, 'utf8');

describe('Living System Map runtime account boundary', () => {
  it('loads server-only local environment files before validating credentials', () => {
    expect(source).toContain("import localEnv from './lib/local-env.cjs'");
    expect(source).toContain("loadLocalEnvFile('.env.local', environment)");
    expect(source).toContain(
      "loadLocalEnvFile('.living-system-map/runtime-analytics.local', environment)",
    );
    expect(loadLocalEnvFile).toEqual(expect.any(Function));
  });

  it('constructs a non-persistent Supabase admin client', () => {
    expect(source).toContain("import { createClient } from '@supabase/supabase-js'");
    expect(source).toContain('auth: { autoRefreshToken: false, persistSession: false }');
    expect(createClient).toEqual(expect.any(Function));
  });

  it('queries the fixed cost-summary RPC with a bounded 30-day window', () => {
    expect(source).toContain("'living_system_map_account_cost_summary'");
    expect(source).toContain('{ p_days: 30 }');
    expect(source).not.toMatch(/client\.rpc\(\s*process\.env/);
  });

  it('fails closed before network access when server credentials are absent', async () => {
    const writeError = jest.fn();
    const createSupabaseClient = jest.fn();

    await expect(runRuntimeAccounts({
      environment: {},
      stdout: { write: jest.fn() },
      stderr: { write: writeError },
      createSupabaseClient,
      loadEnvironmentFiles: false,
    } as never)).resolves.toBe(2);
    expect(writeError).toHaveBeenCalledWith(
      'Runtime accounts require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n',
    );
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });

  it('joins paged auth users to the bounded cost summary', async () => {
    const writeOutput = jest.fn();
    const listUsers = jest.fn().mockResolvedValue({
      data: {
        users: [{
          id: 'user-synthetic',
          email: 'alex.rivera@example.com',
          created_at: '2026-08-01T00:00:00.000Z',
          last_sign_in_at: '2026-08-14T00:00:00.000Z',
          is_anonymous: false,
          app_metadata: { provider: 'email' },
        }],
      },
      error: null,
    });
    const rpc = jest.fn().mockResolvedValue({
      data: [{ user_id: 'user-synthetic', storage_bytes: 128, sessions: 3 }],
      error: null,
    });
    const createSupabaseClient = jest.fn(() => ({
      auth: { admin: { listUsers } },
      rpc,
    }));

    await expect(runRuntimeAccounts({
      environment: {
        SUPABASE_URL: 'https://project.supabase.test',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-synthetic',
      },
      stdout: { write: writeOutput },
      stderr: { write: jest.fn() },
      createSupabaseClient,
    } as never)).resolves.toBe(0);

    expect(createSupabaseClient).toHaveBeenCalledWith(
      'https://project.supabase.test',
      'service-role-synthetic',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    expect(listUsers).toHaveBeenCalledWith({ page: 1, perPage: 200 });
    expect(rpc).toHaveBeenCalledWith('living_system_map_account_cost_summary', { p_days: 30 });
    const payload = JSON.parse(writeOutput.mock.calls[0][0]);
    expect(payload.users).toEqual([
      expect.objectContaining({
        email: 'alex.rivera@example.com',
        cost: expect.objectContaining({ storageBytes: 128, sessions30d: 3 }),
      }),
    ]);
  });
});
