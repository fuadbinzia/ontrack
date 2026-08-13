-- Anonymous, content-free route flow analytics. App clients never access these tables directly.

create table if not exists public.analytics_flow_receipts (
  event_id uuid primary key,
  install_hash text not null,
  received_at timestamptz not null default now()
);

create table if not exists public.analytics_flow_routes_daily (
  day date not null,
  environment text not null,
  platform text not null,
  app_version text not null,
  route_key text not null,
  visits bigint not null default 0,
  completions bigint not null default 0,
  failures bigint not null default 0,
  primary key (day, environment, platform, app_version, route_key)
);

create table if not exists public.analytics_flow_transitions_daily (
  day date not null,
  environment text not null,
  platform text not null,
  app_version text not null,
  from_route text not null,
  to_route text not null,
  executions bigint not null default 0,
  primary key (day, environment, platform, app_version, from_route, to_route)
);

create table if not exists public.analytics_flow_outcomes_daily (
  day date not null,
  environment text not null,
  platform text not null,
  app_version text not null,
  route_key text not null,
  outcome_id text not null,
  completions bigint not null default 0,
  failures bigint not null default 0,
  primary key (day, environment, platform, app_version, route_key, outcome_id)
);

create table if not exists public.analytics_flow_paths_daily (
  day date not null,
  environment text not null,
  platform text not null,
  app_version text not null,
  path_hash text not null,
  route_path jsonb not null,
  executions bigint not null default 0,
  primary key (day, environment, platform, app_version, path_hash)
);

create table if not exists public.analytics_flow_live (
  install_hash text not null,
  session_hash text not null,
  environment text not null,
  platform text not null,
  app_version text not null,
  from_route text,
  route_key text not null,
  updated_at timestamptz not null default now(),
  primary key (install_hash, session_hash)
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'analytics_flow_receipts', 'analytics_flow_routes_daily',
    'analytics_flow_transitions_daily', 'analytics_flow_outcomes_daily',
    'analytics_flow_paths_daily', 'analytics_flow_live'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
  end loop;
end $$;

create index if not exists analytics_flow_receipts_received_idx on public.analytics_flow_receipts(received_at);
create index if not exists analytics_flow_routes_day_idx on public.analytics_flow_routes_daily(day desc);
create index if not exists analytics_flow_transitions_day_idx on public.analytics_flow_transitions_daily(day desc);
create index if not exists analytics_flow_live_updated_idx on public.analytics_flow_live(updated_at);

create or replace function public.record_analytics_flow_batch(
  p_install_hash text,
  p_platform text,
  p_environment text,
  p_app_version text,
  p_events jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  event_day date;
  event_id uuid;
  lifecycle text;
  route_key text;
  from_route text;
  outcome_id text;
  event_session_hash text;
begin
  if p_install_hash !~ '^[0-9a-f]{64}$'
    or p_platform not in ('ios', 'android', 'web', 'unknown')
    or p_environment not in ('production', 'testflight', 'preview', 'development')
    or length(p_app_version) not between 1 and 32
    or jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) not between 1 and 50 then
    raise exception 'invalid flow batch';
  end if;

  if (select count(*) from public.analytics_flow_receipts
      where install_hash = p_install_hash and received_at > now() - interval '1 hour') >= 500 then
    raise exception 'flow rate limit exceeded';
  end if;

  for item in select value from jsonb_array_elements(p_events)
  loop
    event_id := (item->>'id')::uuid;
    insert into public.analytics_flow_receipts(event_id, install_hash)
    values (event_id, p_install_hash)
    on conflict do nothing;
    if not found then continue; end if;

    event_day := ((item->>'occurredAt')::timestamptz at time zone 'utc')::date;
    lifecycle := item->>'lifecycle';
    route_key := item->>'route';
    from_route := nullif(item->>'fromRoute', '');
    outcome_id := nullif(item->>'outcomeId', '');
    event_session_hash := item->>'sessionHash';

    if lifecycle = 'visit' then
      insert into public.analytics_flow_routes_daily(day, environment, platform, app_version, route_key, visits)
      values (event_day, p_environment, p_platform, p_app_version, route_key, 1)
      on conflict (day, environment, platform, app_version, route_key) do update
      set visits = analytics_flow_routes_daily.visits + 1;
    elsif lifecycle = 'complete' and from_route is not null then
      insert into public.analytics_flow_routes_daily(day, environment, platform, app_version, route_key, completions)
      values (event_day, p_environment, p_platform, p_app_version, route_key, 1)
      on conflict (day, environment, platform, app_version, route_key) do update
      set completions = analytics_flow_routes_daily.completions + 1;
      insert into public.analytics_flow_transitions_daily(day, environment, platform, app_version, from_route, to_route, executions)
      values (event_day, p_environment, p_platform, p_app_version, from_route, route_key, 1)
      on conflict (day, environment, platform, app_version, from_route, to_route) do update
      set executions = analytics_flow_transitions_daily.executions + 1;
    end if;

    if outcome_id is not null and lifecycle in ('complete', 'fail') then
      insert into public.analytics_flow_outcomes_daily(
        day, environment, platform, app_version, route_key, outcome_id, completions, failures
      ) values (
        event_day, p_environment, p_platform, p_app_version, route_key, outcome_id,
        case when lifecycle = 'complete' then 1 else 0 end,
        case when lifecycle = 'fail' then 1 else 0 end
      )
      on conflict (day, environment, platform, app_version, route_key, outcome_id) do update set
        completions = analytics_flow_outcomes_daily.completions + excluded.completions,
        failures = analytics_flow_outcomes_daily.failures + excluded.failures;
      if lifecycle = 'fail' then
        insert into public.analytics_flow_routes_daily(day, environment, platform, app_version, route_key, failures)
        values (event_day, p_environment, p_platform, p_app_version, route_key, 1)
        on conflict (day, environment, platform, app_version, route_key) do update
        set failures = analytics_flow_routes_daily.failures + 1;
      end if;
    end if;

    if lifecycle in ('visit', 'complete', 'heartbeat') then
      insert into public.analytics_flow_live(
        install_hash, session_hash, environment, platform, app_version, from_route, route_key, updated_at
      ) values (
        p_install_hash, event_session_hash, p_environment, p_platform, p_app_version, from_route, route_key, now()
      ) on conflict (install_hash, session_hash) do update set
        environment = excluded.environment, platform = excluded.platform,
        app_version = excluded.app_version, from_route = excluded.from_route,
        route_key = excluded.route_key, updated_at = now();
    elsif lifecycle = 'session-end' then
      if jsonb_typeof(item->'path') = 'array' and jsonb_array_length(item->'path') between 1 and 30 then
        insert into public.analytics_flow_paths_daily(
          day, environment, platform, app_version, path_hash, route_path, executions
        ) values (
          event_day, p_environment, p_platform, p_app_version, item->>'pathHash', item->'path', 1
        ) on conflict (day, environment, platform, app_version, path_hash) do update
        set executions = analytics_flow_paths_daily.executions + 1;
      end if;
      delete from public.analytics_flow_live
      where install_hash = p_install_hash and analytics_flow_live.session_hash = event_session_hash;
    end if;
  end loop;

  delete from public.analytics_flow_live where updated_at < now() - interval '90 seconds';
  delete from public.analytics_flow_receipts where received_at < now() - interval '7 days';
  delete from public.analytics_flow_routes_daily where day < current_date - 89;
  delete from public.analytics_flow_transitions_daily where day < current_date - 89;
  delete from public.analytics_flow_outcomes_daily where day < current_date - 89;
  delete from public.analytics_flow_paths_daily where day < current_date - 89;
end;
$$;

revoke all on function public.record_analytics_flow_batch(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_analytics_flow_batch(text, text, text, text, jsonb) to service_role;

create or replace function public.analytics_flow_map_summary(
  p_days integer default 7,
  p_environment text default 'production',
  p_platform text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  window_days integer := greatest(1, least(coalesce(p_days, 7), 90));
  since_day date := current_date - (window_days - 1);
  result jsonb;
begin
  select jsonb_build_object(
    'schemaVersion', 1,
    'generatedAt', now(),
    'windowDays', window_days,
    'environment', p_environment,
    'platform', p_platform,
    'routes', coalesce((select jsonb_agg(to_jsonb(r) order by r.visits desc) from (
      select route_key as "route", sum(visits)::bigint as visits,
        sum(completions)::bigint as completions, sum(failures)::bigint as failures
      from public.analytics_flow_routes_daily
      where day >= since_day and environment = p_environment and (p_platform is null or platform = p_platform)
      group by route_key order by sum(visits) desc limit 250
    ) r), '[]'::jsonb),
    'transitions', coalesce((select jsonb_agg(to_jsonb(t) order by t.executions desc) from (
      select from_route as "from", to_route as "to", sum(executions)::bigint as executions
      from public.analytics_flow_transitions_daily
      where day >= since_day and environment = p_environment and (p_platform is null or platform = p_platform)
      group by from_route, to_route order by sum(executions) desc limit 500
    ) t), '[]'::jsonb),
    'outcomes', coalesce((select jsonb_agg(to_jsonb(o) order by (o.completions + o.failures) desc) from (
      select route_key as "route", outcome_id as "outcomeId",
        sum(completions)::bigint as completions, sum(failures)::bigint as failures
      from public.analytics_flow_outcomes_daily
      where day >= since_day and environment = p_environment and (p_platform is null or platform = p_platform)
      group by route_key, outcome_id order by sum(completions) + sum(failures) desc limit 250
    ) o), '[]'::jsonb),
    'paths', coalesce((select jsonb_agg(to_jsonb(p) order by p.executions desc) from (
      select route_path as path, sum(executions)::bigint as executions
      from public.analytics_flow_paths_daily
      where day >= since_day and environment = p_environment and (p_platform is null or platform = p_platform)
      group by path_hash, route_path having sum(executions) >= 3 order by sum(executions) desc limit 50
    ) p), '[]'::jsonb),
    'liveTransitions', coalesce((select jsonb_agg(to_jsonb(l) order by l.active desc) from (
      select from_route as "from", route_key as "to", count(*)::bigint as active
      from public.analytics_flow_live
      where updated_at >= now() - interval '90 seconds'
        and environment = p_environment and (p_platform is null or platform = p_platform)
      group by from_route, route_key order by count(*) desc limit 100
    ) l), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.analytics_flow_map_summary(integer, text, text) from public, anon, authenticated;
grant execute on function public.analytics_flow_map_summary(integer, text, text) to service_role;
