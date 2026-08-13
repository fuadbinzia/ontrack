-- Calendar sync can rediscover an activity through a replacement Google event
-- while another request still holds its previous mapping. Replace either side
-- of the one-to-one mapping under a per-user transaction lock.
create or replace function public.upsert_google_calendar_event_links(link_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  link_row record;
  locked_user_id uuid;
  preserved_created_at timestamptz;
begin
  if jsonb_typeof(link_rows) is distinct from 'array' then
    raise exception 'Calendar link payload must be an array.';
  end if;

  for link_row in
    select *
    from jsonb_to_recordset(link_rows) as item(
      user_id uuid,
      calendar_id text,
      google_event_id text,
      activity_id text,
      origin text,
      google_updated_at timestamptz,
      local_updated_at timestamptz,
      created_at timestamptz
    )
  loop
    if link_row.user_id is null
      or nullif(link_row.calendar_id, '') is null
      or nullif(link_row.google_event_id, '') is null
      or nullif(link_row.activity_id, '') is null
      or link_row.origin is null
      or link_row.origin not in ('google', 'ontrack')
    then
      raise exception 'Calendar link payload is invalid.';
    end if;

    if locked_user_id is null then
      locked_user_id := link_row.user_id;
      perform pg_advisory_xact_lock(
        hashtextextended('google-calendar-links:' || locked_user_id::text, 0)
      );
    elsif locked_user_id <> link_row.user_id then
      raise exception 'Calendar link batch must belong to one user.';
    end if;

    select created_at
      into preserved_created_at
      from public.google_calendar_event_links
      where user_id = link_row.user_id
        and (
          activity_id = link_row.activity_id
          or (
            calendar_id = link_row.calendar_id
            and google_event_id = link_row.google_event_id
          )
        )
      order by (activity_id = link_row.activity_id) desc
      limit 1;

    delete from public.google_calendar_event_links
      where user_id = link_row.user_id
        and (
          activity_id = link_row.activity_id
          or (
            calendar_id = link_row.calendar_id
            and google_event_id = link_row.google_event_id
          )
        );

    insert into public.google_calendar_event_links (
      user_id,
      calendar_id,
      google_event_id,
      activity_id,
      origin,
      google_updated_at,
      local_updated_at,
      created_at
    ) values (
      link_row.user_id,
      link_row.calendar_id,
      link_row.google_event_id,
      link_row.activity_id,
      link_row.origin,
      link_row.google_updated_at,
      link_row.local_updated_at,
      coalesce(preserved_created_at, link_row.created_at, now())
    );
  end loop;
end;
$$;

revoke all on function public.upsert_google_calendar_event_links(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_google_calendar_event_links(jsonb) to service_role;
