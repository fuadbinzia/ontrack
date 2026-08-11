-- Personal travel atlas with opt-in, summary-only friend overlays.

create table if not exists public.travel_map_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  share_with_friends boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.travel_map_visits (
  id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (owner_id, id)
);

create index if not exists travel_map_visits_owner_updated_idx
  on public.travel_map_visits (owner_id, updated_at desc);

alter table public.travel_map_profiles enable row level security;
alter table public.travel_map_visits enable row level security;
revoke all on public.travel_map_profiles from anon, authenticated;
revoke all on public.travel_map_visits from anon, authenticated;

create or replace function public.set_travel_map_visibility(requested_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Sign in to share your travel map.';
  end if;
  insert into public.travel_map_profiles (owner_id, share_with_friends, updated_at)
  values (actor, coalesce(requested_enabled, false), now())
  on conflict (owner_id) do update
    set share_with_friends = excluded.share_with_friends,
        updated_at = excluded.updated_at;
end;
$$;

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

create or replace function public.list_my_travel_map()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'shareWithFriends', coalesce((
      select profile.share_with_friends
      from public.travel_map_profiles as profile
      where profile.owner_id = auth.uid()
    ), false),
    'visits', coalesce((
      select jsonb_agg(visit.payload order by visit.updated_at, visit.id)
      from public.travel_map_visits as visit
      where visit.owner_id = auth.uid() and visit.deleted_at is null
    ), '[]'::jsonb)
  )
  where auth.uid() is not null;
$$;

create or replace function public.list_visible_friend_map_profiles()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', profile.user_id,
    'displayName', profile.display_name,
    'avatar_kind', profile.avatar_kind,
    'avatar_color', profile.avatar_color,
    'avatar_icon_id', profile.avatar_icon_id,
    'avatar_photo_path', profile.avatar_photo_path
  ) order by lower(profile.display_name)), '[]'::jsonb)
  from public.travel_map_profiles as map_profile
  join public.profiles as profile on profile.user_id = map_profile.owner_id
  where auth.uid() is not null
    and map_profile.share_with_friends
    and public.are_friends(auth.uid(), map_profile.owner_id);
$$;

create or replace function public.list_friend_travel_maps(requested_friend_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', profile.user_id,
    'displayName', profile.display_name,
    'avatar_kind', profile.avatar_kind,
    'avatar_color', profile.avatar_color,
    'avatar_icon_id', profile.avatar_icon_id,
    'avatar_photo_path', profile.avatar_photo_path,
    'visits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', visit.payload ->> 'id',
        'tripId', visit.payload ->> 'tripId',
        'canonicalTripId', visit.payload ->> 'canonicalTripId',
        'countryCode', visit.payload ->> 'countryCode',
        'countryName', visit.payload ->> 'countryName',
        'places', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', place ->> 'id',
            'label', place ->> 'label',
            'latitude', (place ->> 'latitude')::double precision,
            'longitude', (place ->> 'longitude')::double precision,
            'createdAt', place ->> 'createdAt',
            'updatedAt', place ->> 'updatedAt'
          ))
          from jsonb_array_elements(visit.payload -> 'places') as place
        ), '[]'::jsonb),
        'tripSummary', case
          when jsonb_typeof(visit.payload -> 'tripSummary') = 'object'
          then jsonb_build_object(
            'title', visit.payload #>> '{tripSummary,title}',
            'destination', visit.payload #>> '{tripSummary,destination}',
            'startDate', visit.payload #>> '{tripSummary,startDate}',
            'endDate', visit.payload #>> '{tripSummary,endDate}'
          )
          else null
        end,
        'createdAt', visit.payload ->> 'createdAt',
        'updatedAt', visit.payload ->> 'updatedAt'
      ) order by visit.updated_at, visit.id)
      from public.travel_map_visits as visit
      where visit.owner_id = map_profile.owner_id
        and visit.deleted_at is null
    ), '[]'::jsonb)
  ) order by lower(profile.display_name)), '[]'::jsonb)
  from public.travel_map_profiles as map_profile
  join public.profiles as profile on profile.user_id = map_profile.owner_id
  where auth.uid() is not null
    and map_profile.share_with_friends
    and map_profile.owner_id = any(coalesce(requested_friend_ids, '{}'::uuid[]))
    and public.are_friends(auth.uid(), map_profile.owner_id);
$$;

create or replace function public.can_open_friend_travel_map_trip(
  requested_owner_id uuid,
  requested_visit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(exists(
    select 1
    from public.travel_map_profiles as map_profile
    join public.travel_map_visits as visit
      on visit.owner_id = map_profile.owner_id
     and visit.id = requested_visit_id
     and visit.deleted_at is null
    where auth.uid() is not null
      and map_profile.owner_id = requested_owner_id
      and map_profile.share_with_friends
      and public.are_friends(auth.uid(), map_profile.owner_id)
      and nullif(
        coalesce(nullif(visit.payload ->> 'canonicalTripId', ''), visit.payload ->> 'tripId'),
        ''
      ) is not null
      and public.is_travel_trip_member(
        coalesce(nullif(visit.payload ->> 'canonicalTripId', ''), visit.payload ->> 'tripId')
      )
  ), false);
$$;

revoke all on function public.set_travel_map_visibility(boolean) from public;
revoke all on function public.apply_travel_map_mutations(jsonb) from public;
revoke all on function public.list_my_travel_map() from public;
revoke all on function public.list_visible_friend_map_profiles() from public;
revoke all on function public.list_friend_travel_maps(uuid[]) from public;
revoke all on function public.can_open_friend_travel_map_trip(uuid, uuid) from public;
grant execute on function public.set_travel_map_visibility(boolean) to authenticated;
grant execute on function public.apply_travel_map_mutations(jsonb) to authenticated;
grant execute on function public.list_my_travel_map() to authenticated;
grant execute on function public.list_visible_friend_map_profiles() to authenticated;
grant execute on function public.list_friend_travel_maps(uuid[]) to authenticated;
grant execute on function public.can_open_friend_travel_map_trip(uuid, uuid) to authenticated;
