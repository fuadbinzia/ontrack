-- Aggregate-only latency histograms for route paints, transitions, and named actions.

alter table public.analytics_flow_routes_daily
  add column if not exists latency_samples bigint not null default 0,
  add column if not exists latency_total_ms bigint not null default 0,
  add column if not exists latency_max_ms integer not null default 0,
  add column if not exists latency_b100 bigint not null default 0,
  add column if not exists latency_b250 bigint not null default 0,
  add column if not exists latency_b500 bigint not null default 0,
  add column if not exists latency_b1000 bigint not null default 0,
  add column if not exists latency_b2000 bigint not null default 0,
  add column if not exists latency_b5000 bigint not null default 0,
  add column if not exists latency_bslow bigint not null default 0;

alter table public.analytics_flow_transitions_daily
  add column if not exists latency_samples bigint not null default 0,
  add column if not exists latency_total_ms bigint not null default 0,
  add column if not exists latency_max_ms integer not null default 0,
  add column if not exists latency_b100 bigint not null default 0,
  add column if not exists latency_b250 bigint not null default 0,
  add column if not exists latency_b500 bigint not null default 0,
  add column if not exists latency_b1000 bigint not null default 0,
  add column if not exists latency_b2000 bigint not null default 0,
  add column if not exists latency_b5000 bigint not null default 0,
  add column if not exists latency_bslow bigint not null default 0;

alter table public.analytics_flow_outcomes_daily
  add column if not exists latency_samples bigint not null default 0,
  add column if not exists latency_total_ms bigint not null default 0,
  add column if not exists latency_max_ms integer not null default 0,
  add column if not exists latency_b100 bigint not null default 0,
  add column if not exists latency_b250 bigint not null default 0,
  add column if not exists latency_b500 bigint not null default 0,
  add column if not exists latency_b1000 bigint not null default 0,
  add column if not exists latency_b2000 bigint not null default 0,
  add column if not exists latency_b5000 bigint not null default 0,
  add column if not exists latency_bslow bigint not null default 0;

create or replace function public.analytics_latency_percentile(
  sample_count bigint,
  b100 bigint,
  b250 bigint,
  b500 bigint,
  b1000 bigint,
  b2000 bigint,
  b5000 bigint,
  bslow bigint,
  maximum_ms integer,
  requested_percentile numeric
)
returns integer
language sql
immutable
as $$
  select case
    when sample_count <= 0 then null
    when b100 >= ceil(sample_count * requested_percentile) then 100
    when b100 + b250 >= ceil(sample_count * requested_percentile) then 250
    when b100 + b250 + b500 >= ceil(sample_count * requested_percentile) then 500
    when b100 + b250 + b500 + b1000 >= ceil(sample_count * requested_percentile) then 1000
    when b100 + b250 + b500 + b1000 + b2000 >= ceil(sample_count * requested_percentile) then 2000
    when b100 + b250 + b500 + b1000 + b2000 + b5000 >= ceil(sample_count * requested_percentile) then 5000
    when bslow > 0 then maximum_ms
    else maximum_ms
  end
$$;

revoke all on function public.analytics_latency_percentile(bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, numeric)
from public, anon, authenticated;
grant execute on function public.analytics_latency_percentile(bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, integer, numeric)
to service_role;

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
  event_lifecycle text;
  event_route_key text;
  event_from_route text;
  event_outcome_id text;
  event_session_hash text;
  event_metric text;
  event_duration_ms integer;
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
    event_lifecycle := item->>'lifecycle';
    event_route_key := item->>'route';
    event_from_route := nullif(item->>'fromRoute', '');
    event_outcome_id := nullif(item->>'outcomeId', '');
    event_session_hash := item->>'sessionHash';
    event_metric := nullif(item->>'metric', '');
    event_duration_ms := case when item ? 'durationMs' then (item->>'durationMs')::integer else null end;

    if event_lifecycle = 'visit' then
      insert into public.analytics_flow_routes_daily(day, environment, platform, app_version, route_key, visits)
      values (event_day, p_environment, p_platform, p_app_version, event_route_key, 1)
      on conflict on constraint analytics_flow_routes_daily_pkey do update
      set visits = analytics_flow_routes_daily.visits + 1;
    elsif event_lifecycle = 'complete' and event_from_route is not null then
      insert into public.analytics_flow_routes_daily(day, environment, platform, app_version, route_key, completions)
      values (event_day, p_environment, p_platform, p_app_version, event_route_key, 1)
      on conflict on constraint analytics_flow_routes_daily_pkey do update
      set completions = analytics_flow_routes_daily.completions + 1;
      insert into public.analytics_flow_transitions_daily(day, environment, platform, app_version, from_route, to_route, executions)
      values (event_day, p_environment, p_platform, p_app_version, event_from_route, event_route_key, 1)
      on conflict on constraint analytics_flow_transitions_daily_pkey do update
      set executions = analytics_flow_transitions_daily.executions + 1;
    end if;

    if event_outcome_id is not null and event_lifecycle in ('complete', 'fail') then
      insert into public.analytics_flow_outcomes_daily(
        day, environment, platform, app_version, route_key, outcome_id, completions, failures
      ) values (
        event_day, p_environment, p_platform, p_app_version, event_route_key, event_outcome_id,
        case when event_lifecycle = 'complete' then 1 else 0 end,
        case when event_lifecycle = 'fail' then 1 else 0 end
      )
      on conflict on constraint analytics_flow_outcomes_daily_pkey do update set
        completions = analytics_flow_outcomes_daily.completions + excluded.completions,
        failures = analytics_flow_outcomes_daily.failures + excluded.failures;
      if event_lifecycle = 'fail' then
        insert into public.analytics_flow_routes_daily(day, environment, platform, app_version, route_key, failures)
        values (event_day, p_environment, p_platform, p_app_version, event_route_key, 1)
        on conflict on constraint analytics_flow_routes_daily_pkey do update
        set failures = analytics_flow_routes_daily.failures + 1;
      end if;
    end if;

    if event_lifecycle = 'measure' and event_metric = 'page-load' then
      insert into public.analytics_flow_routes_daily(
        day, environment, platform, app_version, route_key,
        latency_samples, latency_total_ms, latency_max_ms,
        latency_b100, latency_b250, latency_b500, latency_b1000, latency_b2000, latency_b5000, latency_bslow
      ) values (
        event_day, p_environment, p_platform, p_app_version, event_route_key,
        1, event_duration_ms, event_duration_ms,
        (event_duration_ms <= 100)::integer, (event_duration_ms > 100 and event_duration_ms <= 250)::integer,
        (event_duration_ms > 250 and event_duration_ms <= 500)::integer, (event_duration_ms > 500 and event_duration_ms <= 1000)::integer,
        (event_duration_ms > 1000 and event_duration_ms <= 2000)::integer, (event_duration_ms > 2000 and event_duration_ms <= 5000)::integer,
        (event_duration_ms > 5000)::integer
      ) on conflict on constraint analytics_flow_routes_daily_pkey do update set
        latency_samples = analytics_flow_routes_daily.latency_samples + 1,
        latency_total_ms = analytics_flow_routes_daily.latency_total_ms + excluded.latency_total_ms,
        latency_max_ms = greatest(analytics_flow_routes_daily.latency_max_ms, excluded.latency_max_ms),
        latency_b100 = analytics_flow_routes_daily.latency_b100 + excluded.latency_b100,
        latency_b250 = analytics_flow_routes_daily.latency_b250 + excluded.latency_b250,
        latency_b500 = analytics_flow_routes_daily.latency_b500 + excluded.latency_b500,
        latency_b1000 = analytics_flow_routes_daily.latency_b1000 + excluded.latency_b1000,
        latency_b2000 = analytics_flow_routes_daily.latency_b2000 + excluded.latency_b2000,
        latency_b5000 = analytics_flow_routes_daily.latency_b5000 + excluded.latency_b5000,
        latency_bslow = analytics_flow_routes_daily.latency_bslow + excluded.latency_bslow;

      if event_from_route is not null then
        insert into public.analytics_flow_transitions_daily(
          day, environment, platform, app_version, from_route, to_route,
          latency_samples, latency_total_ms, latency_max_ms,
          latency_b100, latency_b250, latency_b500, latency_b1000, latency_b2000, latency_b5000, latency_bslow
        ) values (
          event_day, p_environment, p_platform, p_app_version, event_from_route, event_route_key,
          1, event_duration_ms, event_duration_ms,
          (event_duration_ms <= 100)::integer, (event_duration_ms > 100 and event_duration_ms <= 250)::integer,
          (event_duration_ms > 250 and event_duration_ms <= 500)::integer, (event_duration_ms > 500 and event_duration_ms <= 1000)::integer,
          (event_duration_ms > 1000 and event_duration_ms <= 2000)::integer, (event_duration_ms > 2000 and event_duration_ms <= 5000)::integer,
          (event_duration_ms > 5000)::integer
        ) on conflict on constraint analytics_flow_transitions_daily_pkey do update set
          latency_samples = analytics_flow_transitions_daily.latency_samples + 1,
          latency_total_ms = analytics_flow_transitions_daily.latency_total_ms + excluded.latency_total_ms,
          latency_max_ms = greatest(analytics_flow_transitions_daily.latency_max_ms, excluded.latency_max_ms),
          latency_b100 = analytics_flow_transitions_daily.latency_b100 + excluded.latency_b100,
          latency_b250 = analytics_flow_transitions_daily.latency_b250 + excluded.latency_b250,
          latency_b500 = analytics_flow_transitions_daily.latency_b500 + excluded.latency_b500,
          latency_b1000 = analytics_flow_transitions_daily.latency_b1000 + excluded.latency_b1000,
          latency_b2000 = analytics_flow_transitions_daily.latency_b2000 + excluded.latency_b2000,
          latency_b5000 = analytics_flow_transitions_daily.latency_b5000 + excluded.latency_b5000,
          latency_bslow = analytics_flow_transitions_daily.latency_bslow + excluded.latency_bslow;
      end if;
    elsif event_lifecycle = 'measure' and event_metric = 'action' and event_outcome_id is not null then
      insert into public.analytics_flow_outcomes_daily(
        day, environment, platform, app_version, route_key, outcome_id,
        latency_samples, latency_total_ms, latency_max_ms,
        latency_b100, latency_b250, latency_b500, latency_b1000, latency_b2000, latency_b5000, latency_bslow
      ) values (
        event_day, p_environment, p_platform, p_app_version, event_route_key, event_outcome_id,
        1, event_duration_ms, event_duration_ms,
        (event_duration_ms <= 100)::integer, (event_duration_ms > 100 and event_duration_ms <= 250)::integer,
        (event_duration_ms > 250 and event_duration_ms <= 500)::integer, (event_duration_ms > 500 and event_duration_ms <= 1000)::integer,
        (event_duration_ms > 1000 and event_duration_ms <= 2000)::integer, (event_duration_ms > 2000 and event_duration_ms <= 5000)::integer,
        (event_duration_ms > 5000)::integer
      ) on conflict on constraint analytics_flow_outcomes_daily_pkey do update set
        latency_samples = analytics_flow_outcomes_daily.latency_samples + 1,
        latency_total_ms = analytics_flow_outcomes_daily.latency_total_ms + excluded.latency_total_ms,
        latency_max_ms = greatest(analytics_flow_outcomes_daily.latency_max_ms, excluded.latency_max_ms),
        latency_b100 = analytics_flow_outcomes_daily.latency_b100 + excluded.latency_b100,
        latency_b250 = analytics_flow_outcomes_daily.latency_b250 + excluded.latency_b250,
        latency_b500 = analytics_flow_outcomes_daily.latency_b500 + excluded.latency_b500,
        latency_b1000 = analytics_flow_outcomes_daily.latency_b1000 + excluded.latency_b1000,
        latency_b2000 = analytics_flow_outcomes_daily.latency_b2000 + excluded.latency_b2000,
        latency_b5000 = analytics_flow_outcomes_daily.latency_b5000 + excluded.latency_b5000,
        latency_bslow = analytics_flow_outcomes_daily.latency_bslow + excluded.latency_bslow;
    end if;

    if event_lifecycle in ('visit', 'complete', 'heartbeat') then
      insert into public.analytics_flow_live(
        install_hash, session_hash, environment, platform, app_version, from_route, route_key, updated_at
      ) values (
        p_install_hash, event_session_hash, p_environment, p_platform, p_app_version,
        event_from_route, event_route_key, now()
      ) on conflict on constraint analytics_flow_live_pkey do update set
        environment = excluded.environment, platform = excluded.platform,
        app_version = excluded.app_version, from_route = excluded.from_route,
        route_key = excluded.route_key, updated_at = now();
    elsif event_lifecycle = 'session-end' then
      if jsonb_typeof(item->'path') = 'array' and jsonb_array_length(item->'path') between 1 and 30 then
        insert into public.analytics_flow_paths_daily(
          day, environment, platform, app_version, path_hash, route_path, executions
        ) values (
          event_day, p_environment, p_platform, p_app_version, item->>'pathHash', item->'path', 1
        ) on conflict on constraint analytics_flow_paths_daily_pkey do update
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

revoke all on function public.record_analytics_flow_batch(text, text, text, text, jsonb)
from public, anon, authenticated;
grant execute on function public.record_analytics_flow_batch(text, text, text, text, jsonb)
to service_role;

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
        sum(completions)::bigint as completions, sum(failures)::bigint as failures,
        sum(latency_samples)::bigint as "latencySamples",
        case when sum(latency_samples) > 0 then round(sum(latency_total_ms)::numeric / sum(latency_samples))::integer end as "averageLoadMs",
        public.analytics_latency_percentile(sum(latency_samples), sum(latency_b100), sum(latency_b250), sum(latency_b500), sum(latency_b1000), sum(latency_b2000), sum(latency_b5000), sum(latency_bslow), max(latency_max_ms), .5) as "p50LoadMs",
        public.analytics_latency_percentile(sum(latency_samples), sum(latency_b100), sum(latency_b250), sum(latency_b500), sum(latency_b1000), sum(latency_b2000), sum(latency_b5000), sum(latency_bslow), max(latency_max_ms), .95) as "p95LoadMs",
        max(latency_max_ms)::integer as "maxLoadMs"
      from public.analytics_flow_routes_daily
      where day >= since_day and environment = p_environment and (p_platform is null or platform = p_platform)
      group by route_key order by sum(visits) desc limit 250
    ) r), '[]'::jsonb),
    'transitions', coalesce((select jsonb_agg(to_jsonb(t) order by t.executions desc) from (
      select from_route as "from", to_route as "to", sum(executions)::bigint as executions,
        sum(latency_samples)::bigint as "latencySamples",
        case when sum(latency_samples) > 0 then round(sum(latency_total_ms)::numeric / sum(latency_samples))::integer end as "averageMs",
        public.analytics_latency_percentile(sum(latency_samples), sum(latency_b100), sum(latency_b250), sum(latency_b500), sum(latency_b1000), sum(latency_b2000), sum(latency_b5000), sum(latency_bslow), max(latency_max_ms), .5) as "p50Ms",
        public.analytics_latency_percentile(sum(latency_samples), sum(latency_b100), sum(latency_b250), sum(latency_b500), sum(latency_b1000), sum(latency_b2000), sum(latency_b5000), sum(latency_bslow), max(latency_max_ms), .95) as "p95Ms",
        max(latency_max_ms)::integer as "maxMs"
      from public.analytics_flow_transitions_daily
      where day >= since_day and environment = p_environment and (p_platform is null or platform = p_platform)
      group by from_route, to_route order by sum(executions) desc limit 500
    ) t), '[]'::jsonb),
    'outcomes', coalesce((select jsonb_agg(to_jsonb(o) order by (o.completions + o.failures) desc) from (
      select route_key as "route", outcome_id as "outcomeId",
        sum(completions)::bigint as completions, sum(failures)::bigint as failures,
        sum(latency_samples)::bigint as "latencySamples",
        case when sum(latency_samples) > 0 then round(sum(latency_total_ms)::numeric / sum(latency_samples))::integer end as "averageActionMs",
        public.analytics_latency_percentile(sum(latency_samples), sum(latency_b100), sum(latency_b250), sum(latency_b500), sum(latency_b1000), sum(latency_b2000), sum(latency_b5000), sum(latency_bslow), max(latency_max_ms), .5) as "p50ActionMs",
        public.analytics_latency_percentile(sum(latency_samples), sum(latency_b100), sum(latency_b250), sum(latency_b500), sum(latency_b1000), sum(latency_b2000), sum(latency_b5000), sum(latency_bslow), max(latency_max_ms), .95) as "p95ActionMs",
        max(latency_max_ms)::integer as "maxActionMs"
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

revoke all on function public.analytics_flow_map_summary(integer, text, text)
from public, anon, authenticated;
grant execute on function public.analytics_flow_map_summary(integer, text, text)
to service_role;
