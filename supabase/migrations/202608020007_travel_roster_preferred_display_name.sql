-- Prefer the fuller trip/invite name when a profile display_name is only a
-- truncated prefix (e.g. profile "Jordan" vs invitee "Jordan Lee").
-- Keeps CoTravelers and trip-card initials aligned after partial renames.

create or replace function public.travel_preferred_display_name(
  profile_name text,
  invitee_name text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    case
      when nullif(btrim(profile_name), '') is null then null
      when nullif(btrim(invitee_name), '') is null then nullif(btrim(profile_name), '')
      when lower(btrim(invitee_name)) = lower(btrim(profile_name))
        then nullif(btrim(profile_name), '')
      when lower(btrim(invitee_name)) like lower(btrim(profile_name)) || ' %'
        then nullif(btrim(invitee_name), '')
      when lower(btrim(profile_name)) like lower(btrim(invitee_name)) || ' %'
        then nullif(btrim(profile_name), '')
      else nullif(btrim(profile_name), '')
    end,
    nullif(btrim(invitee_name), ''),
    nullif(btrim(profile_name), '')
  );
$$;

create or replace function public.list_travel_trip_roster(requested_trip_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  normalized_trip text := btrim(requested_trip_id);
  host_id uuid;
  host_email text;
  host_name text;
  host_avatar public.profiles%rowtype;
  roster jsonb := '[]'::jsonb;
  member_row record;
  member_avatar public.profiles%rowtype;
  is_cohost boolean;
begin
  if actor is null or length(normalized_trip) not between 1 and 200 then
    raise exception 'Sign in required.';
  end if;

  if not (
    public.is_travel_trip_host(normalized_trip)
    or public.is_travel_trip_member(normalized_trip)
  ) then
    raise exception 'You do not have access to this trip’s friends.';
  end if;

  host_id := public.travel_trip_host_user_id(normalized_trip);
  if host_id is null then
    return '[]'::jsonb;
  end if;

  select account.email into host_email
  from auth.users as account
  where account.id = host_id
  limit 1;

  select * into host_avatar
  from public.profiles as profile
  where profile.user_id = host_id
  limit 1;

  host_name := coalesce(
    nullif(btrim(host_avatar.display_name), ''),
    public.travel_user_display_name(host_id),
    'Host'
  );

  roster := roster || jsonb_build_array(
    jsonb_build_object(
      'userId', host_id,
      'displayName', host_name,
      'email', host_email,
      'role', 'host',
      'avatarKind', coalesce(host_avatar.avatar_kind, 'initials'),
      'avatarColor', host_avatar.avatar_color,
      'avatarIconId', host_avatar.avatar_icon_id,
      'avatarPhotoPath', host_avatar.avatar_photo_path
    )
  );

  for member_row in
    select distinct on (invite.accepted_by_user_id)
      invite.accepted_by_user_id as user_id,
      invite.invitee_name as display_name,
      invite.invitee_email as email,
      invite.code as invite_code,
      invite.accepted_at
    from public.travel_invites as invite
    where invite.trip_id = normalized_trip
      and invite.accepted_by_user_id is not null
      and invite.accepted_by_user_id <> host_id
      and invite.accepted_at is not null
      and invite.revoked_at is null
      and invite.expires_at > now()
    order by invite.accepted_by_user_id, invite.accepted_at desc
  loop
    select exists (
      select 1
      from public.travel_trip_cohosts as cohost
      where cohost.trip_id = normalized_trip
        and cohost.user_id = member_row.user_id
    ) into is_cohost;

    select * into member_avatar
    from public.profiles as profile
    where profile.user_id = member_row.user_id
    limit 1;

    roster := roster || jsonb_build_array(
      jsonb_build_object(
        'userId', member_row.user_id,
        'displayName', coalesce(
          public.travel_preferred_display_name(
            member_avatar.display_name,
            member_row.display_name
          ),
          'Traveler'
        ),
        'email', member_row.email,
        'role', case when is_cohost then 'cohost' else 'member' end,
        'inviteCode', member_row.invite_code,
        'acceptedAt', member_row.accepted_at,
        'avatarKind', coalesce(member_avatar.avatar_kind, 'initials'),
        'avatarColor', member_avatar.avatar_color,
        'avatarIconId', member_avatar.avatar_icon_id,
        'avatarPhotoPath', member_avatar.avatar_photo_path
      )
    );
  end loop;

  return roster;
end;
$$;

revoke all on function public.travel_preferred_display_name(text, text) from public;
grant execute on function public.travel_preferred_display_name(text, text) to authenticated;
