-- Fix PL/pgSQL variable/column ambiguity in flow ingestion conflict targets.

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

    if event_lifecycle in ('visit', 'complete', 'heartbeat') then
      insert into public.analytics_flow_live(
        install_hash, session_hash, environment, platform, app_version, from_route, route_key, updated_at
      ) values (
        p_install_hash, event_session_hash, p_environment, p_platform, p_app_version,
        event_from_route, event_route_key, now()
      ) on conflict on constraint analytics_flow_live_pkey do update set
        environment = excluded.environment,
        platform = excluded.platform,
        app_version = excluded.app_version,
        from_route = excluded.from_route,
        route_key = excluded.route_key,
        updated_at = now();
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
