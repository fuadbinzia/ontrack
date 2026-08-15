-- Co-hosts manage the whole shared itinerary while ordinary trip members can
-- continue to create and update only their own stops. Trip deletion remains a
-- host-only/local-owner action in the client.

create or replace function public.upsert_travel_trip_itinerary_items(
  requested_trip_id text,
  requested_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized_trip text := btrim(requested_trip_id);
  actor_is_manager boolean;
  entry jsonb;
  item_id text;
  share_mode text;
  shared_with uuid[];
  payload jsonb;
  updated_at timestamptz;
  upserted int := 0;
begin
  if actor is null
    or length(normalized_trip) not between 1 and 200
    or jsonb_typeof(requested_items) <> 'array'
    or octet_length(requested_items::text) > 800000 then
    raise exception 'Invalid travel itinerary upsert.';
  end if;

  if not (
    public.is_travel_trip_host(normalized_trip)
    or public.is_travel_trip_member(normalized_trip)
  ) then
    raise exception 'You do not have access to this trip’s itinerary.';
  end if;

  actor_is_manager := public.is_travel_trip_manager(normalized_trip);

  for entry in
    select value
    from jsonb_array_elements(requested_items) as value
  loop
    item_id := nullif(btrim(coalesce(entry ->> 'itemId', entry ->> 'id', '')), '');
    if item_id is null or length(item_id) > 200 then
      continue;
    end if;

    share_mode := lower(btrim(coalesce(entry ->> 'shareMode', 'private')));
    if share_mode not in ('private', 'trip', 'selected') then
      share_mode := 'private';
    end if;

    shared_with := coalesce(
      (
        select array_agg(distinct id)
        from (
          select nullif(btrim(value #>> '{}'), '')::uuid as id
          from jsonb_array_elements(
            case
              when jsonb_typeof(entry -> 'sharedWithUserIds') = 'array'
                then entry -> 'sharedWithUserIds'
              else '[]'::jsonb
            end
          ) as value
          where nullif(btrim(value #>> '{}'), '') ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ) as parsed
        where id is not null
      ),
      '{}'::uuid[]
    );
    if share_mode <> 'selected' then
      shared_with := '{}'::uuid[];
    end if;

    payload := coalesce(
      entry -> 'payload',
      entry - 'itemId' - 'shareMode' - 'sharedWithUserIds' - 'updatedAt'
    );
    if jsonb_typeof(payload) <> 'object' then
      continue;
    end if;
    if octet_length(payload::text) > 100000 then
      raise exception 'Itinerary item payload too large.';
    end if;

    begin
      updated_at := coalesce((entry ->> 'updatedAt')::timestamptz, now());
    exception
      when others then
        updated_at := now();
    end;

    insert into public.travel_trip_itinerary_items (
      trip_id,
      item_id,
      owner_user_id,
      share_mode,
      shared_with_user_ids,
      payload,
      updated_at
    )
    values (
      normalized_trip,
      item_id,
      actor,
      share_mode,
      shared_with,
      payload,
      updated_at
    )
    on conflict (trip_id, item_id) do update
    set
      share_mode = excluded.share_mode,
      shared_with_user_ids = excluded.shared_with_user_ids,
      payload = excluded.payload,
      updated_at = excluded.updated_at
    where (
        public.travel_trip_itinerary_items.owner_user_id = actor
        or actor_is_manager
      )
      and public.travel_trip_itinerary_items.updated_at <= excluded.updated_at;

    if found then
      upserted := upserted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'tripId', normalized_trip,
    'upserted', upserted
  );
end;
$$;

revoke all on function public.upsert_travel_trip_itinerary_items(text, jsonb)
  from public, anon;
grant execute on function public.upsert_travel_trip_itinerary_items(text, jsonb)
  to authenticated;
