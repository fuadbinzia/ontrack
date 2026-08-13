-- Server-only operational summary for the localhost Living System Map.
-- This reports measurable cost drivers without exposing credentials or app content.

create or replace function public.living_system_map_account_cost_summary(
  p_days integer default 30
)
returns table(
  user_id uuid,
  storage_bytes bigint,
  storage_objects bigint,
  synced_state_bytes bigint,
  sessions bigint,
  active_ms bigint,
  plaid_items bigint,
  google_calendar_connections bigint,
  partner_links bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with account_storage as (
    select
      account.id as user_id,
      count(object.id)::bigint as storage_objects,
      coalesce(sum(
        case
          when coalesce(object.metadata ->> 'size', '') ~ '^[0-9]+$'
            then (object.metadata ->> 'size')::bigint
          else 0
        end
      ), 0)::bigint as storage_bytes
    from auth.users as account
    left join storage.objects as object
      on object.bucket_id in ('app-media', 'profile-avatars', 'meal-photos', 'todo-recipe-images')
      and (
        object.owner_id = account.id::text
        or object.name like account.id::text || '/%'
      )
    group by account.id
  ),
  state_usage as (
    select state.user_id, coalesce(sum(pg_column_size(state.payload)), 0)::bigint as synced_state_bytes
    from public.app_state as state
    group by state.user_id
  ),
  activity_usage as (
    select
      daily.user_id,
      coalesce(sum(daily.session_count), 0)::bigint as sessions,
      coalesce(sum(daily.active_ms), 0)::bigint as active_ms
    from public.analytics_daily as daily
    where daily.day >= (timezone('utc', now()))::date
      - (greatest(1, least(coalesce(p_days, 30), 90)) - 1)
    group by daily.user_id
  ),
  plaid_usage as (
    select item.user_id, count(*)::bigint as plaid_items
    from public.plaid_items as item
    group by item.user_id
  ),
  calendar_usage as (
    select connection.user_id, count(*)::bigint as google_calendar_connections
    from public.google_calendar_connections as connection
    group by connection.user_id
  ),
  partner_usage as (
    select link.user_id, count(*)::bigint as partner_links
    from public.partner_links as link
    group by link.user_id
  )
  select
    account.id,
    coalesce(storage.storage_bytes, 0),
    coalesce(storage.storage_objects, 0),
    coalesce(state.synced_state_bytes, 0),
    coalesce(activity.sessions, 0),
    coalesce(activity.active_ms, 0),
    coalesce(plaid.plaid_items, 0),
    coalesce(calendar.google_calendar_connections, 0),
    coalesce(partner.partner_links, 0)
  from auth.users as account
  left join account_storage as storage on storage.user_id = account.id
  left join state_usage as state on state.user_id = account.id
  left join activity_usage as activity on activity.user_id = account.id
  left join plaid_usage as plaid on plaid.user_id = account.id
  left join calendar_usage as calendar on calendar.user_id = account.id
  left join partner_usage as partner on partner.user_id = account.id;
$$;

revoke all on function public.living_system_map_account_cost_summary(integer) from public, anon, authenticated;
grant execute on function public.living_system_map_account_cost_summary(integer) to service_role;

comment on function public.living_system_map_account_cost_summary(integer) is
  'Server-only per-account storage, sync, activity, and paid-integration footprint for the localhost Living System Map. AI calls are not yet durably metered per account.';
