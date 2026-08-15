#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import localEnv from './lib/local-env.cjs';

const { loadLocalEnvFile } = localEnv;

function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function runRuntimeAccounts({
  environment = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
  createSupabaseClient = createClient,
  loadEnvironmentFiles = true,
} = {}) {
  if (loadEnvironmentFiles) {
    loadLocalEnvFile('.env.local', environment);
    loadLocalEnvFile('.living-system-map/runtime-analytics.local', environment);
  }
  const url = environment.SUPABASE_URL?.trim() || environment.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    stderr.write('Runtime accounts require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n');
    return 2;
  }

  const client = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const users = [];
  const perPage = 200;
  for (let page = 1; page <= 100; page += 1) {
    const result = await client.auth.admin.listUsers({ page, perPage });
    if (result.error) {
      stderr.write('Runtime account query failed.\n');
      return 1;
    }
    users.push(...result.data.users);
    if (result.data.users.length < perPage) break;
  }

  const { data: costRows, error: costError } = await client.rpc(
    'living_system_map_account_cost_summary',
    { p_days: 30 },
  );
  if (costError) {
    stderr.write('Runtime account cost query failed. Apply the latest Supabase migrations.\n');
    return 1;
  }
  const costsByUser = new Map((costRows ?? []).map((row) => [row.user_id, row]));
  const rows = users.map((user) => {
    const costRow = costsByUser.get(user.id);
    return {
      email: user.email ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      provider: user.is_anonymous ? 'anonymous' : user.app_metadata?.provider ?? 'email',
      isAnonymous: Boolean(user.is_anonymous),
      cost: {
        storageBytes: count(costRow?.storage_bytes),
        storageObjects: count(costRow?.storage_objects),
        syncedStateBytes: count(costRow?.synced_state_bytes),
        sessions30d: count(costRow?.sessions),
        activeMs30d: count(costRow?.active_ms),
        plaidItems: count(costRow?.plaid_items),
        googleCalendarConnections: count(costRow?.google_calendar_connections),
        partnerLinks: count(costRow?.partner_links),
        aiRequests: null,
        aiInputTokens: null,
        aiOutputTokens: null,
      },
    };
  }).sort((left, right) => {
    const leftTime = left.lastSignInAt ? Date.parse(left.lastSignInAt) : 0;
    const rightTime = right.lastSignInAt ? Date.parse(right.lastSignInAt) : 0;
    return rightTime - leftTime || left.createdAt.localeCompare(right.createdAt);
  });

  stdout.write(`${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), users: rows })}\n`);
  return 0;
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (entryPath === import.meta.url) {
  runRuntimeAccounts()
    .then((code) => {
      process.exitCode = code;
    })
    .catch(() => {
      process.stderr.write('Runtime account query failed.\n');
      process.exitCode = 1;
    });
}
