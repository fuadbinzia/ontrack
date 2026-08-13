-- Stable, anonymous per-install flow aggregates. Raw install IDs never reach this schema.

create table public.analytics_flow_device_receipts (
  event_id uuid primary key,
  received_at timestamptz not null default now()
);

create table public.analytics_flow_devices_daily (
  day date not null,
  environment text not null,
  platform text not null,
  app_version text not null,
  install_hash text not null,
  lifecycle text not null,
  route_key text not null,
  from_route text not null default '',
  outcome_id text not null default '',
  executions bigint not null default 0,
  last_seen_at timestamptz not null,
  primary key (
    day, environment, platform, app_version, install_hash,
    lifecycle, route_key, from_route, outcome_id
  )
);

alter table public.analytics_flow_device_receipts enable row level security;
alter table public.analytics_flow_devices_daily enable row level security;
revoke all on public.analytics_flow_device_receipts from anon, authenticated;
revoke all on public.analytics_flow_devices_daily from anon, authenticated;

create index analytics_flow_devices_window_idx
on public.analytics_flow_devices_daily(environment, platform, day desc, last_seen_at desc);

create or replace function public.record_analytics_flow_device_batch(
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
  event_id uuid;
  event_at timestamptz;
  event_day date;
  event_lifecycle text;
  event_route text;
  event_from_route text;
  event_outcome_id text;
begin
  if p_install_hash !~ '^[0-9a-f]{64}$'
    or p_platform not in ('ios', 'android', 'web', 'unknown')
    or p_environment not in ('production', 'testflight', 'preview', 'development')
    or length(p_app_version) not between 1 and 32
    or jsonb_typeof(p_events) <> 'array'
    or jsonb_array_length(p_events) not between 1 and 50 then
    raise exception 'invalid anonymous device batch';
  end if;

  for item in select value from jsonb_array_elements(p_events)
  loop
    event_id := (item->>'id')::uuid;
    insert into public.analytics_flow_device_receipts(event_id)
    values (event_id)
    on conflict do nothing;
    if not found then continue; end if;

    event_at := (item->>'occurredAt')::timestamptz;
    event_day := (event_at at time zone 'utc')::date;
    event_lifecycle := item->>'lifecycle';
    event_route := item->>'route';
    event_from_route := coalesce(nullif(item->>'fromRoute', ''), '');
    event_outcome_id := coalesce(nullif(item->>'outcomeId', ''), '');

    if event_lifecycle not in ('visit', 'complete', 'fail', 'measure', 'heartbeat', 'session-end')
      or event_route !~ '^/' or length(event_route) > 180 or event_route ~ '[?#@[:space:]]'
      or (event_from_route <> '' and (event_from_route !~ '^/' or length(event_from_route) > 180 or event_from_route ~ '[?#@[:space:]]'))
      or length(event_outcome_id) > 80 then
      raise exception 'invalid anonymous device event';
    end if;

    insert into public.analytics_flow_devices_daily(
      day, environment, platform, app_version, install_hash,
      lifecycle, route_key, from_route, outcome_id, executions, last_seen_at
    ) values (
      event_day, p_environment, p_platform, p_app_version, p_install_hash,
      event_lifecycle, event_route, event_from_route, event_outcome_id, 1, event_at
    ) on conflict on constraint analytics_flow_devices_daily_pkey do update set
      executions = analytics_flow_devices_daily.executions + 1,
      last_seen_at = greatest(analytics_flow_devices_daily.last_seen_at, excluded.last_seen_at);
  end loop;

  delete from public.analytics_flow_device_receipts where received_at < now() - interval '7 days';
  delete from public.analytics_flow_devices_daily where day < current_date - 89;
end;
$$;

revoke all on function public.record_analytics_flow_device_batch(text, text, text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.record_analytics_flow_device_batch(text, text, text, text, jsonb)
to service_role;

create or replace function public.analytics_flow_device_summary(
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
    'devices', coalesce((select jsonb_agg(to_jsonb(d) order by d."lastSeenAt" desc) from (
      select
        platform || '-' || upper(substr(install_hash, 1, 8)) as "deviceId",
        platform,
        (array_agg(app_version order by last_seen_at desc))[1] as "appVersion",
        sum(executions) filter (where lifecycle = 'visit')::bigint as visits,
        sum(executions) filter (where lifecycle = 'complete' and from_route <> '')::bigint as transitions,
        sum(executions) filter (where outcome_id <> '')::bigint as outcomes,
        sum(executions) filter (where lifecycle = 'fail')::bigint as failures,
        max(last_seen_at) as "lastSeenAt"
      from public.analytics_flow_devices_daily
      where day >= since_day and environment = p_environment
        and (p_platform is null or platform = p_platform)
      group by install_hash, platform
      order by max(last_seen_at) desc limit 100
    ) d), '[]'::jsonb),
    'deviceActions', coalesce((select jsonb_agg(to_jsonb(a) order by a."lastSeenAt" desc, a.executions desc) from (
      select
        platform || '-' || upper(substr(install_hash, 1, 8)) as "deviceId",
        lifecycle,
        route_key as route,
        nullif(from_route, '') as "fromRoute",
        nullif(outcome_id, '') as "outcomeId",
        sum(executions)::bigint as executions,
        max(last_seen_at) as "lastSeenAt"
      from public.analytics_flow_devices_daily
      where day >= since_day and environment = p_environment
        and (p_platform is null or platform = p_platform)
        and lifecycle in ('visit', 'complete', 'fail')
      group by install_hash, platform, lifecycle, route_key, from_route, outcome_id
      order by max(last_seen_at) desc, sum(executions) desc limit 1000
    ) a), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.analytics_flow_device_summary(integer, text, text)
from public, anon, authenticated;
grant execute on function public.analytics_flow_device_summary(integer, text, text)
to service_role;
