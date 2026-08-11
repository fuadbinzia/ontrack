-- Allow atlas pins to exist without a linked trip or synthetic trip summary.

create or replace function public.apply_travel_map_mutations(requested_mutations jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  mutation jsonb;
  visit jsonb;
  place jsonb;
  visit_id uuid;
  mutation_at timestamptz;
begin
  if actor is null then
    raise exception 'Sign in to sync your travel map.';
  end if;
  if requested_mutations is null or jsonb_typeof(requested_mutations) <> 'array' then
    raise exception 'Travel map mutations must be an array.';
  end if;
  if jsonb_array_length(requested_mutations) > 100 then
    raise exception 'Too many travel map mutations.';
  end if;

  insert into public.travel_map_profiles (owner_id)
  values (actor)
  on conflict (owner_id) do nothing;

  for mutation in select value from jsonb_array_elements(requested_mutations)
  loop
    if mutation ->> 'type' = 'delete' then
      begin
        visit_id := (mutation ->> 'visitId')::uuid;
      exception when others then
        raise exception 'Invalid travel map visit id.';
      end;
      begin
        mutation_at := coalesce((mutation ->> 'updatedAt')::timestamptz, now());
      exception when others then
        raise exception 'Invalid travel map mutation timestamp.';
      end;
      insert into public.travel_map_visits (id, owner_id, payload, updated_at, deleted_at)
      values (visit_id, actor, '{}'::jsonb, mutation_at, mutation_at)
      on conflict (owner_id, id) do update
        set payload = '{}'::jsonb,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at
      where public.travel_map_visits.updated_at <= excluded.updated_at;
    elsif mutation ->> 'type' = 'upsert' then
      visit := mutation -> 'visit';
      if jsonb_typeof(visit) <> 'object'
        or jsonb_typeof(visit -> 'places') <> 'array'
        or not (
          (
            nullif(btrim(coalesce(visit ->> 'tripId', '')), '') is null
            and coalesce(jsonb_typeof(visit -> 'tripSummary'), 'null') = 'null'
          )
          or (
            length(btrim(coalesce(visit ->> 'tripId', ''))) between 1 and 180
            and jsonb_typeof(visit -> 'tripSummary') = 'object'
            and length(btrim(coalesce(visit #>> '{tripSummary,title}', ''))) between 1 and 180
            and length(btrim(coalesce(visit #>> '{tripSummary,destination}', ''))) between 1 and 240
          )
        )
        or (
          nullif(btrim(coalesce(visit ->> 'canonicalTripId', '')), '') is not null
          and nullif(btrim(coalesce(visit ->> 'tripId', '')), '') is null
        )
        or coalesce(visit ->> 'countryCode', '') !~ '^[A-Z]{2}$'
        or length(btrim(coalesce(visit ->> 'countryName', ''))) not between 1 and 120
        or jsonb_array_length(visit -> 'places') > 500
      then
        raise exception 'Invalid travel map visit.';
      end if;
      for place in select value from jsonb_array_elements(visit -> 'places')
      loop
        begin
          if jsonb_typeof(place) <> 'object'
            or length(btrim(coalesce(place ->> 'id', ''))) not between 1 and 180
            or length(btrim(coalesce(place ->> 'label', ''))) not between 1 and 240
            or not (place ? 'latitude')
            or not (place ? 'longitude')
            or (place ->> 'latitude')::double precision not between -90 and 90
            or (place ->> 'longitude')::double precision not between -180 and 180
          then
            raise exception 'Invalid travel map place.';
          end if;
        exception when invalid_text_representation then
          raise exception 'Invalid travel map place coordinates.';
        end;
      end loop;
      begin
        visit_id := (visit ->> 'id')::uuid;
      exception when others then
        raise exception 'Invalid travel map visit id.';
      end;
      begin
        mutation_at := coalesce((visit ->> 'updatedAt')::timestamptz, now());
      exception when others then
        raise exception 'Invalid travel map visit timestamp.';
      end;
      insert into public.travel_map_visits (id, owner_id, payload, updated_at, deleted_at)
      values (visit_id, actor, visit, mutation_at, null)
      on conflict (owner_id, id) do update
        set payload = excluded.payload,
            updated_at = excluded.updated_at,
            deleted_at = null
      where public.travel_map_visits.updated_at <= excluded.updated_at;
    else
      raise exception 'Unknown travel map mutation.';
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_travel_map_mutations(jsonb) from public;
grant execute on function public.apply_travel_map_mutations(jsonb) to authenticated;
