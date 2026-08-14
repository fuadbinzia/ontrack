#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import localEnv from './lib/local-env.cjs';

const { loadLocalEnvFile } = localEnv;

loadLocalEnvFile('.env.local');
loadLocalEnvFile('.living-system-map/runtime-analytics.local');
const url = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  process.stderr.write('Runtime accounts require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(2);
}

const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const users = [];
const perPage = 200;
for (let page = 1; page <= 100; page += 1) {
  const result = await client.auth.admin.listUsers({ page, perPage });
  if (result.error) {
    process.stderr.write('Runtime account query failed.\n');
    process.exit(1);
  }
  users.push(...result.data.users);
  if (result.data.users.length < perPage) break;
}

const { data: costRows, error: costError } = await client.rpc(
  'living_system_map_account_cost_summary',
  { p_days: 30 },
);
if (costError) {
  process.stderr.write('Runtime account cost query failed. Apply the latest Supabase migrations.\n');
  process.exit(1);
}
const costsByUser = new Map((costRows ?? []).map((row) => [row.user_id, row]));

function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

const rows = users.map((user) => ({
  email: user.email ?? null,
  createdAt: user.created_at,
  lastSignInAt: user.last_sign_in_at ?? null,
  provider: user.is_anonymous ? 'anonymous' : user.app_metadata?.provider ?? 'email',
  isAnonymous: Boolean(user.is_anonymous),
  cost: {
    storageBytes: count(costsByUser.get(user.id)?.storage_bytes),
    storageObjects: count(costsByUser.get(user.id)?.storage_objects),
    syncedStateBytes: count(costsByUser.get(user.id)?.synced_state_bytes),
    sessions30d: count(costsByUser.get(user.id)?.sessions),
    activeMs30d: count(costsByUser.get(user.id)?.active_ms),
    plaidItems: count(costsByUser.get(user.id)?.plaid_items),
    googleCalendarConnections: count(costsByUser.get(user.id)?.google_calendar_connections),
    partnerLinks: count(costsByUser.get(user.id)?.partner_links),
    aiRequests: null,
    aiInputTokens: null,
    aiOutputTokens: null,
  },
})).sort((left, right) => {
  const leftTime = left.lastSignInAt ? Date.parse(left.lastSignInAt) : 0;
  const rightTime = right.lastSignInAt ? Date.parse(right.lastSignInAt) : 0;
  return rightTime - leftTime || left.createdAt.localeCompare(right.createdAt);
});

process.stdout.write(`${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), users: rows })}\n`);
