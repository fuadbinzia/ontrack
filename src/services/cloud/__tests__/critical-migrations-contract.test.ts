import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = (name: string) =>
  readFileSync(join(process.cwd(), 'supabase/migrations', name), 'utf8').toLowerCase();

describe('critical persistence migration boundaries', () => {
  it('keeps account deletion caller-scoped, authenticated, and storage-aware', () => {
    const source = migration('202608030001_delete_own_account.sql');
    expect(source).toContain('uid uuid := auth.uid()');
    expect(source).toContain('delete from storage.objects');
    expect(source).toContain('delete from auth.users where id = uid');
    expect(source).toContain('revoke all on function public.delete_own_account() from public');
    expect(source).toContain('grant execute on function public.delete_own_account() to authenticated');
  });

  it('purges account-owned domain rows while keeping reset and delete RPCs caller-scoped', () => {
    const source = migration('202608120010_complete_account_data_purge.sql');
    for (const table of ['todo_lists', 'vehicles', 'travel_chat_messages', 'google_calendar_connections', 'app_state']) {
      expect(source).toContain(`delete from public.${table}`);
    }
    expect(source).toContain('uid uuid := auth.uid()');
    expect(source).toContain('perform public.purge_user_data(uid)');
    expect(source).toContain('grant execute on function public.reset_own_data() to authenticated');
    expect(source).toContain('grant execute on function public.delete_own_account() to authenticated');
  });

  it('keeps storage cleanup user-executed instead of hidden in a definer purge', () => {
    const source = migration('202608120011_storage_api_account_purge.sql');
    expect(source).toContain('create or replace function public.list_own_storage_objects()');
    expect(source).toContain("owner_id = auth.uid()::text");
    expect(source).toContain('create policy "users delete own app storage objects"');
    expect(source).toContain('grant execute on function public.list_own_storage_objects() to authenticated');
  });

  it('preserves server-managed capabilities during an account data reset', () => {
    const source = migration('202608120012_preserve_account_capabilities_on_reset.sql');
    expect(source).toContain('delete from public.account_flags where user_id = target_user_id');
    expect(source).toContain('delete from public.agent_entitlements where user_id = target_user_id');
    expect(source).toContain('delete from public.addon_entitlements where user_id = target_user_id');
    expect(source).toContain("execute replace(definition, account_capability_block, '')");
  });

  it('enforces owner-scoped app sync and media policies', () => {
    const source = migration('202607250001_app_sync.sql');
    expect(source).toContain('alter table public.app_state enable row level security');
    expect(source).toContain('using (user_id = auth.uid())');
    expect(source).toContain("(storage.foldername(name))[1] = auth.uid()::text");
  });

  it('revokes anonymous travel invite and chat RPC access', () => {
    const source = migration('202607270006_travel_invite_authenticated_only.sql');
    for (const rpc of ['create_travel_invite', 'accept_travel_invite', 'travel_chat_messages', 'send_travel_chat_message']) {
      expect(source).toMatch(new RegExp(`revoke execute on function public\\.${rpc}\\([^;]+from anon`));
    }
  });

  it('requires an authenticated participant before resolving a trip chat', () => {
    const source = migration('202607270007_all_accounts_test_trip_chat.sql');
    expect(source).toContain('auth.uid() is not null');
    expect(source).toContain('invite.inviter_user_id = auth.uid()');
    expect(source).toContain('invite.accepted_by_user_id = auth.uid()');
    expect(source).toContain('revoke all on function public.travel_chat_trip_id(text) from public');
  });

  it('keeps account flags self-readable but never client self-grantable', () => {
    const base = migration('202608050009_account_flags.sql');
    const grant = migration('202608050010_account_flags_select_grant.sql');
    const agent = migration('202608090001_account_flags_agent_test.sql');
    expect(base).toContain('using (user_id = auth.uid())');
    expect(base).toContain('grant select on public.account_flags to authenticated');
    expect(base).not.toMatch(/grant\s+(insert|update|delete)\s+on public\.account_flags to authenticated/);
    expect(grant).toContain('grant select on public.account_flags to authenticated');
    expect(agent).toContain('account_flags_agent_test_not_admin');
  });

  it('keeps Calendar credentials behind RLS with no direct client grants', () => {
    const base = migration('202608120001_google_calendar_sync.sql');
    const direction = migration('202608120003_google_calendar_sync_direction.sql');
    expect(base).toContain('alter table public.google_calendar_connections enable row level security');
    expect(base).toContain('revoke all on public.google_calendar_connections from anon, authenticated');
    expect(base).toContain('revoke all on public.google_calendar_event_links from anon, authenticated');
    expect(direction).toContain('sync_direction');
  });

  it('replaces conflicting Calendar event links atomically without client RPC access', () => {
    const source = migration('202608130001_atomic_google_calendar_event_links.sql');
    expect(source).toContain('pg_advisory_xact_lock');
    expect(source).toContain('activity_id = link_row.activity_id');
    expect(source).toContain('google_event_id = link_row.google_event_id');
    expect(source).toContain('delete from public.google_calendar_event_links');
    expect(source).toContain('insert into public.google_calendar_event_links');
    expect(source).toContain('revoke all on function public.upsert_google_calendar_event_links(jsonb) from public, anon, authenticated');
    expect(source).toContain('grant execute on function public.upsert_google_calendar_event_links(jsonb) to service_role');
  });

  it('adds Finance only to the existing owner-scoped sync and entitlement constraints', () => {
    const source = migration('202608120007_finance_addon.sql');
    expect(source).toContain('alter table public.app_state');
    expect(source).toContain('add constraint app_state_domain_check');
    expect(source).toContain("'finance'");
    expect(source).toContain('alter table public.addon_entitlements');
    expect(source).toContain('add constraint addon_entitlements_addon_id_check');
    expect(source).not.toMatch(/grant\s+(insert|update|delete)/);
  });

  it('keeps anonymous flow analytics aggregate-only and service-role scoped', () => {
    const source = migration('202608130002_flow_analytics.sql');
    const ingestionFix = migration('202608130003_fix_flow_analytics_ingestion.sql');
    const latency = migration('202608130004_flow_latency_aggregates.sql');
    const percentileFix = migration('202608130005_flow_latency_percentile_numeric.sql');
    const devices = migration('202608130006_anonymous_flow_devices.sql');
    for (const table of [
      'analytics_flow_receipts', 'analytics_flow_routes_daily',
      'analytics_flow_transitions_daily', 'analytics_flow_outcomes_daily',
      'analytics_flow_paths_daily', 'analytics_flow_live',
    ]) {
      expect(source).toContain(`alter table public.%i enable row level security`);
      expect(source).toContain(`'${table}'`);
    }
    expect(source).toContain('revoke all on function public.record_analytics_flow_batch');
    expect(source).toContain('grant execute on function public.record_analytics_flow_batch(text, text, text, text, jsonb) to service_role');
    expect(source).toContain("delete from public.analytics_flow_live where updated_at < now() - interval '90 seconds'");
    expect(source).toContain('having sum(executions) >= 3');
    expect(source).not.toMatch(/grant\s+(select|insert|update|delete).*to\s+(anon|authenticated)/);
    expect(ingestionFix).toContain('event_route_key text');
    expect(ingestionFix).not.toContain('\n  route_key text;');
    expect(ingestionFix).toContain('on conflict on constraint analytics_flow_routes_daily_pkey');
    expect(ingestionFix).toContain('on conflict on constraint analytics_flow_transitions_daily_pkey');
    for (const table of ['analytics_flow_routes_daily', 'analytics_flow_transitions_daily', 'analytics_flow_outcomes_daily']) {
      expect(latency).toContain(`alter table public.${table}`);
    }
    expect(latency).toContain('latency_samples bigint not null default 0');
    expect(latency).toContain("event_lifecycle = 'measure'");
    expect(latency).toContain('analytics_latency_percentile');
    expect(latency).toContain('grant execute on function public.record_analytics_flow_batch(text, text, text, text, jsonb)');
    expect(devices).toContain('analytics_flow_devices_daily');
    expect(devices).toContain('install_hash text not null');
    expect(devices).toContain("upper(substr(install_hash, 1, 8))");
    expect(devices).toContain("delete from public.analytics_flow_devices_daily where day < current_date - 89");
    expect(devices).toContain('revoke all on public.analytics_flow_devices_daily from anon, authenticated');
    expect(devices).toContain('grant execute on function public.analytics_flow_device_summary(integer, text, text)');
    expect(devices).not.toMatch(/grant\s+(select|insert|update|delete).*to\s+(anon|authenticated)/);
    expect(latency).not.toMatch(/grant\s+(select|insert|update|delete).*to\s+(anon|authenticated)/);
    expect(percentileFix).toContain('sample_count numeric');
    expect(percentileFix).toContain('grant execute on function public.analytics_latency_percentile(numeric');
  });

  it('keeps per-account cost drivers server-only and excludes private payload content', () => {
    const source = migration('202608130007_living_system_map_account_cost_summary.sql');
    expect(source).toContain('living_system_map_account_cost_summary');
    expect(source).toContain("object.metadata ->> 'size'");
    expect(source).toContain('pg_column_size(state.payload)');
    expect(source).toContain('public.plaid_items');
    expect(source).toContain('public.google_calendar_connections');
    expect(source).toContain('public.partner_links');
    expect(source).toContain('revoke all on function public.living_system_map_account_cost_summary(integer) from public, anon, authenticated');
    expect(source).toContain('grant execute on function public.living_system_map_account_cost_summary(integer) to service_role');
    expect(source).not.toMatch(/grant execute .* to (anon|authenticated)/);
  });
});
