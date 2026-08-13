#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import localEnv from './lib/local-env.cjs';

const { loadLocalEnvFile } = localEnv;

loadLocalEnvFile('.env.local');
loadLocalEnvFile('.living-system-map/runtime-analytics.local');
const url = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  process.stderr.write('Runtime analytics requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n');
  process.exit(2);
}
const days = Math.max(1, Math.min(90, Number(process.env.LSM_ANALYTICS_DAYS) || 7));
const environment = process.env.LSM_ANALYTICS_ENVIRONMENT || 'production';
const platform = process.env.LSM_ANALYTICS_PLATFORM || null;
const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await client.rpc('analytics_flow_map_summary', {
  p_days: days,
  p_environment: environment,
  p_platform: platform,
});
if (error) {
  process.stderr.write('Runtime analytics query failed.\n');
  process.exit(1);
}
process.stdout.write(`${JSON.stringify(data)}\n`);
