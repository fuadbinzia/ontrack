-- Keep account email private. Collaboration APIs expose opaque user ids and
-- display names; email remains an input-only delivery/addressing mechanism.

drop function if exists public.list_friends();

create function public.list_friends()
returns table (
  user_id uuid,
  display_name text,
  friends_since timestamptz,
  avatar_kind text,
  avatar_color text,
  avatar_icon_id text,
  avatar_photo_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when friendship.user_a = auth.uid() then friendship.user_b
      else friendship.user_a
    end,
    profile.display_name,
    friendship.created_at,
    profile.avatar_kind,
    profile.avatar_color,
    profile.avatar_icon_id,
    profile.avatar_photo_path
  from public.friendships as friendship
  join public.profiles as profile
    on profile.user_id = case
      when friendship.user_a = auth.uid() then friendship.user_b
      else friendship.user_a
    end
  where auth.uid() is not null
    and (friendship.user_a = auth.uid() or friendship.user_b = auth.uid())
  order by lower(profile.display_name), profile.user_id;
$$;

drop function if exists public.list_friend_requests();

create function public.list_friend_requests()
returns table (
  id uuid,
  direction text,
  status text,
  created_at timestamptz,
  other_user_id uuid,
  other_display_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select
      auth.uid() as user_id,
      lower(coalesce(auth.jwt() ->> 'email', '')) as email
  )
  select
    request.id,
    'incoming'::text,
    request.status,
    request.created_at,
    request.from_user_id,
    coalesce(nullif(btrim(profile.display_name), ''), 'onTrack member')
  from public.friend_requests as request
  cross join actor
  left join public.profiles as profile on profile.user_id = request.from_user_id
  where actor.user_id is not null
    and request.status = 'pending'
    and (
      request.to_user_id = actor.user_id
      or (request.to_user_id is null and lower(request.to_email) = actor.email)
    )

  union all

  select
    request.id,
    'outgoing'::text,
    request.status,
    request.created_at,
    request.to_user_id,
    coalesce(nullif(btrim(profile.display_name), ''), 'Pending Friend')
  from public.friend_requests as request
  cross join actor
  left join public.profiles as profile on profile.user_id = request.to_user_id
  where actor.user_id is not null
    and request.status = 'pending'
    and request.from_user_id = actor.user_id
  order by created_at desc;
$$;

create or replace function public.get_my_friend_invite()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  profile_row public.profiles;
  invite_code text;
begin
  if actor is null then
    raise exception 'Sign in to view your invite link.';
  end if;
  perform public.ensure_profile();
  select * into profile_row from public.profiles where user_id = actor;
  invite_code := public.create_friend_invite_link();
  return jsonb_build_object(
    'code', invite_code,
    'slug', profile_row.invite_slug,
    'sharePath', coalesce(profile_row.invite_slug, invite_code),
    'displayName', profile_row.display_name
  );
end;
$$;

create or replace function public.resolve_friend_invite_link(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_token text := lower(btrim(invite_code));
  link_row public.friend_invite_links;
  from_profile public.profiles;
  slug_token text;
begin
  if length(raw_token) < 3 or length(raw_token) > 32 then
    raise exception 'This friend invite is invalid.';
  end if;

  if raw_token ~ '^[a-f0-9]{20}$' then
    select * into link_row
    from public.friend_invite_links as link
    where link.code = raw_token
      and link.revoked_at is null
      and link.expires_at > now();
    if link_row.code is null then
      raise exception 'This friend invite is unavailable.';
    end if;
    select * into from_profile
    from public.profiles as profile
    where profile.user_id = link_row.from_user_id;
    return jsonb_build_object(
      'code', link_row.code,
      'slug', from_profile.invite_slug,
      'sharePath', coalesce(from_profile.invite_slug, link_row.code),
      'fromUserId', link_row.from_user_id,
      'displayName', coalesce(from_profile.display_name, 'onTrack member')
    );
  end if;

  begin
    slug_token := public.normalize_friend_invite_slug(raw_token);
  exception when others then
    raise exception 'This friend invite is unavailable.';
  end;

  select * into from_profile
  from public.profiles as profile
  where profile.invite_slug = slug_token;
  if from_profile.user_id is null then
    raise exception 'This friend invite is unavailable.';
  end if;

  select * into link_row
  from public.friend_invite_links as link
  where link.from_user_id = from_profile.user_id
    and link.revoked_at is null
    and link.expires_at > now()
  order by link.created_at desc
  limit 1;

  return jsonb_build_object(
    'code', coalesce(link_row.code, slug_token),
    'slug', from_profile.invite_slug,
    'sharePath', from_profile.invite_slug,
    'fromUserId', from_profile.user_id,
    'displayName', coalesce(from_profile.display_name, 'onTrack member')
  );
end;
$$;

create or replace function public.create_travel_friend_invite(
  invite_payload jsonb,
  invite_trip_id text,
  invitee_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  friend_profile public.profiles;
begin
  if actor is null or invitee_user_id is null or actor = invitee_user_id then
    raise exception 'Choose a friend to invite.';
  end if;
  if not exists (
    select 1 from public.friendships as friendship
    where friendship.user_a = least(actor, invitee_user_id)
      and friendship.user_b = greatest(actor, invitee_user_id)
  ) then
    raise exception 'Only accepted friends can be invited this way.';
  end if;
  select * into friend_profile
  from public.profiles as profile
  where profile.user_id = invitee_user_id;
  if friend_profile.user_id is null or nullif(btrim(friend_profile.email), '') is null then
    raise exception 'That friend cannot receive an invitation.';
  end if;
  return public.create_travel_invite(
    invite_payload,
    invite_trip_id,
    coalesce(nullif(btrim(friend_profile.display_name), ''), 'Traveler'),
    friend_profile.email
  );
end;
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
  if not (public.is_travel_trip_host(normalized_trip) or public.is_travel_trip_member(normalized_trip)) then
    raise exception 'You do not have access to this trip’s friends.';
  end if;
  host_id := public.travel_trip_host_user_id(normalized_trip);
  if host_id is null then return '[]'::jsonb; end if;
  select * into host_avatar from public.profiles where user_id = host_id limit 1;
  host_name := coalesce(nullif(btrim(host_avatar.display_name), ''), public.travel_user_display_name(host_id), 'Host');
  roster := roster || jsonb_build_array(jsonb_build_object(
    'userId', host_id,
    'displayName', host_name,
    'role', 'host',
    'avatarKind', coalesce(host_avatar.avatar_kind, 'initials'),
    'avatarColor', host_avatar.avatar_color,
    'avatarIconId', host_avatar.avatar_icon_id,
    'avatarPhotoPath', host_avatar.avatar_photo_path
  ));

  for member_row in
    select distinct on (invite.accepted_by_user_id)
      invite.accepted_by_user_id as user_id,
      invite.invitee_name as display_name,
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
      select 1 from public.travel_trip_cohosts as cohost
      where cohost.trip_id = normalized_trip and cohost.user_id = member_row.user_id
    ) into is_cohost;
    select * into member_avatar from public.profiles where user_id = member_row.user_id limit 1;
    roster := roster || jsonb_build_array(jsonb_build_object(
      'userId', member_row.user_id,
      'displayName', coalesce(nullif(btrim(member_avatar.display_name), ''), nullif(btrim(member_row.display_name), ''), 'Traveler'),
      'role', case when is_cohost then 'cohost' else 'member' end,
      'inviteCode', member_row.invite_code,
      'acceptedAt', member_row.accepted_at,
      'avatarKind', coalesce(member_avatar.avatar_kind, 'initials'),
      'avatarColor', member_avatar.avatar_color,
      'avatarIconId', member_avatar.avatar_icon_id,
      'avatarPhotoPath', member_avatar.avatar_photo_path
    ));
  end loop;
  return roster;
end;
$$;

drop function if exists public.list_travel_open_join_requests(text);

create function public.list_travel_open_join_requests(invite_trip_id text)
returns table(
  id uuid,
  requester_user_id uuid,
  requester_name text,
  status text,
  created_at timestamptz,
  granted_invite_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    request.id,
    request.requester_user_id,
    request.requester_name,
    request.status,
    request.created_at,
    request.granted_invite_code
  from public.travel_open_join_requests as request
  where request.trip_id = btrim(invite_trip_id)
    and public.is_travel_trip_manager(request.trip_id)
    and request.status = 'pending'
  order by request.created_at asc;
$$;

create or replace function public.decide_travel_open_join(request_id uuid, approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  request public.travel_open_join_requests%rowtype;
  link public.travel_open_join_links%rowtype;
  host_id uuid;
  generated_code text;
begin
  if actor is null then raise exception 'Sign in required.'; end if;
  select * into request
  from public.travel_open_join_requests as candidate
  where candidate.id = request_id
  for update;
  if request.id is null then raise exception 'Join request not found.'; end if;
  if not public.is_travel_trip_manager(request.trip_id) then
    raise exception 'Only the trip host or a co-host can decide join requests.';
  end if;
  select * into link
  from public.travel_open_join_links as candidate
  where candidate.code = request.link_code
  for update;
  if link.code is null or link.revoked_at is not null or link.expires_at <= now() then
    raise exception 'Only the trip host or a co-host can decide join requests.';
  end if;
  host_id := coalesce(public.travel_trip_host_user_id(request.trip_id), link.host_user_id);
  if request.status <> 'pending' then
    return jsonb_build_object(
      'status', request.status,
      'requestId', request.id,
      'grantedInviteCode', request.granted_invite_code,
      'requesterName', request.requester_name,
      'requesterUserId', request.requester_user_id
    );
  end if;
  if not approve then
    update public.travel_open_join_requests
    set status = 'rejected', decided_at = now(), decided_by_user_id = actor
    where id = request.id;
    return jsonb_build_object(
      'status', 'rejected',
      'requestId', request.id,
      'requesterName', request.requester_name,
      'requesterUserId', request.requester_user_id
    );
  end if;
  loop
    generated_code := encode(extensions.gen_random_bytes(10), 'hex');
    begin
      insert into public.travel_invites (
        code, payload, trip_id, invitee_name, invitee_email,
        inviter_user_id, accepted_at, accepted_by_user_id
      ) values (
        generated_code, link.payload, request.trip_id, request.requester_name,
        request.requester_email, host_id, now(), request.requester_user_id
      );
      exit;
    exception when unique_violation then end;
  end loop;
  update public.travel_open_join_requests
  set status = 'approved', decided_at = now(), decided_by_user_id = actor,
      granted_invite_code = generated_code
  where id = request.id;
  return jsonb_build_object(
    'status', 'approved',
    'requestId', request.id,
    'grantedInviteCode', generated_code,
    'requesterName', request.requester_name,
    'requesterUserId', request.requester_user_id
  );
end;
$$;

drop function if exists public.list_todo_email_invites();

create function public.list_todo_email_invites()
returns table(
  id uuid,
  list_id uuid,
  list_name text,
  inviter_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select invite.id, invite.list_id, list.name, invite.inviter_name, invite.created_at
  from public.todo_email_invites as invite
  join public.todo_lists as list on list.id = invite.list_id
  where invite.invitee_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and invite.accepted_at is null
    and invite.revoked_at is null
    and invite.expires_at > now()
  order by invite.created_at desc;
$$;

drop function if exists public.todo_list_pending_invites(uuid);

create function public.todo_list_pending_invites(requested_list_id uuid)
returns table(id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select invite.id, invite.created_at
  from public.todo_email_invites as invite
  where invite.list_id = requested_list_id
    and invite.accepted_at is null
    and invite.revoked_at is null
    and invite.expires_at > now()
    and public.is_todo_owner(requested_list_id)
  order by invite.created_at desc;
$$;

revoke all on function public.list_friends() from public;
revoke all on function public.list_friend_requests() from public;
revoke all on function public.get_my_friend_invite() from public;
revoke all on function public.resolve_friend_invite_link(text) from public;
revoke all on function public.create_travel_friend_invite(jsonb, text, uuid) from public;
revoke all on function public.list_travel_trip_roster(text) from public;
revoke all on function public.list_travel_open_join_requests(text) from public;
revoke all on function public.decide_travel_open_join(uuid, boolean) from public;
revoke all on function public.list_todo_email_invites() from public;
revoke all on function public.todo_list_pending_invites(uuid) from public;

grant execute on function public.list_friends() to authenticated;
grant execute on function public.list_friend_requests() to authenticated;
grant execute on function public.get_my_friend_invite() to authenticated;
grant execute on function public.resolve_friend_invite_link(text) to authenticated;
grant execute on function public.create_travel_friend_invite(jsonb, text, uuid) to authenticated;
grant execute on function public.list_travel_trip_roster(text) to authenticated;
grant execute on function public.list_travel_open_join_requests(text) to authenticated;
grant execute on function public.decide_travel_open_join(uuid, boolean) to authenticated;
grant execute on function public.list_todo_email_invites() to authenticated;
grant execute on function public.todo_list_pending_invites(uuid) to authenticated;
