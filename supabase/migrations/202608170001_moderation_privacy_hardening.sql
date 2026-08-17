-- UGC safety (block/report), lock-screen chat privacy, avatar least-privilege,
-- and complete account-reset coverage for E-ZPass + moderation rows.

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id, blocker_id);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;

create or replace function public.users_are_blocked(left_user uuid, right_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    left_user is not null
    and right_user is not null
    and left_user <> right_user
    and exists (
      select 1
      from public.user_blocks as block
      where (block.blocker_id = left_user and block.blocked_id = right_user)
         or (block.blocker_id = right_user and block.blocked_id = left_user)
    );
$$;

revoke all on function public.users_are_blocked(uuid, uuid) from public;
grant execute on function public.users_are_blocked(uuid, uuid) to authenticated;

create or replace function public.block_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Sign in to block someone.';
  end if;
  if target_user_id is null or target_user_id = actor then
    raise exception 'That person cannot be blocked.';
  end if;
  if not exists (select 1 from auth.users as account where account.id = target_user_id) then
    raise exception 'That person cannot be blocked.';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (actor, target_user_id)
  on conflict do nothing;

  delete from public.friendships
  where (user_a = actor and user_b = target_user_id)
     or (user_b = actor and user_a = target_user_id);
  delete from public.friend_requests
  where status = 'pending'
    and (
      (from_user_id = actor and to_user_id = target_user_id)
      or (from_user_id = target_user_id and to_user_id = actor)
    );
end;
$$;

create or replace function public.unblock_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Sign in to unblock someone.';
  end if;
  delete from public.user_blocks
  where blocker_id = actor
    and blocked_id = target_user_id;
end;
$$;

create or replace function public.list_blocked_users()
returns table (
  user_id uuid,
  display_name text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    block.blocked_id as user_id,
    coalesce(nullif(btrim(profile.display_name), ''), 'Blocked User') as display_name,
    block.created_at as blocked_at
  from public.user_blocks as block
  left join public.profiles as profile on profile.user_id = block.blocked_id
  where auth.uid() is not null
    and block.blocker_id = auth.uid()
  order by block.created_at desc;
$$;

revoke all on function public.block_user(uuid) from public;
revoke all on function public.unblock_user(uuid) from public;
revoke all on function public.list_blocked_users() from public;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.list_blocked_users() to authenticated;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid references auth.users (id) on delete set null,
  content_kind text not null
    check (content_kind in (
      'travel_chat_message',
      'food_post',
      'user',
      'shared_list',
      'shared_trip'
    )),
  content_id text,
  reason text not null
    check (reason in (
      'harassment',
      'hate',
      'spam',
      'sexual',
      'illegal',
      'impersonation',
      'private_info',
      'unsafe',
      'copyright',
      'other'
    )),
  note text
    check (note is null or length(btrim(note)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists content_reports_reporter_created_idx
  on public.content_reports (reporter_id, created_at desc);
create index if not exists content_reports_target_created_idx
  on public.content_reports (target_user_id, created_at desc);

alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;

create or replace function public.report_content(
  requested_kind text,
  requested_reason text,
  requested_target_user_id uuid default null,
  requested_content_id text default null,
  requested_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  kind text := lower(btrim(coalesce(requested_kind, '')));
  reason text := lower(btrim(coalesce(requested_reason, '')));
  note text := nullif(btrim(coalesce(requested_note, '')), '');
  content_id text := nullif(btrim(coalesce(requested_content_id, '')), '');
  inserted_id uuid;
begin
  if actor is null then
    raise exception 'Sign in to report content.';
  end if;
  if kind not in (
    'travel_chat_message',
    'food_post',
    'user',
    'shared_list',
    'shared_trip'
  ) then
    raise exception 'That report type is not supported.';
  end if;
  if reason not in (
    'harassment',
    'hate',
    'spam',
    'sexual',
    'illegal',
    'impersonation',
    'private_info',
    'unsafe',
    'copyright',
    'other'
  ) then
    raise exception 'Choose a report reason.';
  end if;
  if requested_target_user_id is not null and requested_target_user_id = actor then
    raise exception 'You cannot report your own account.';
  end if;
  if content_id is not null and length(content_id) > 200 then
    raise exception 'That report could not be saved.';
  end if;
  if note is not null and length(note) > 500 then
    raise exception 'Keep report details under 500 characters.';
  end if;

  if (
    select count(*)
    from public.content_reports as report
    where report.reporter_id = actor
      and report.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'Please wait before sending another report.';
  end if;

  insert into public.content_reports (
    reporter_id,
    target_user_id,
    content_kind,
    content_id,
    reason,
    note
  )
  values (
    actor,
    requested_target_user_id,
    kind,
    content_id,
    reason,
    note
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.report_content(text, text, uuid, text, text) from public;
grant execute on function public.report_content(text, text, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- First-line chat filter (not a complete moderation system)
-- ---------------------------------------------------------------------------
create or replace function public.travel_chat_body_is_blocked(chat_body text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(chat_body, '') ~* '(child\s*porn|child\s*sexual|csam|nigger|faggot|kike|rape\s+you|kill\s+yourself)'
$$;

revoke all on function public.travel_chat_body_is_blocked(text) from public;
grant execute on function public.travel_chat_body_is_blocked(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Hide blocked senders + reject blocked language on send
-- ---------------------------------------------------------------------------
create or replace function public.travel_chat_messages(chat_access_code text)
returns table (
  id uuid,
  sender_name text,
  sender_device_id uuid,
  sender_user_id uuid,
  body text,
  created_at timestamptz,
  kind text,
  reply_to_id uuid,
  reply_preview text,
  reply_sender_name text,
  edited_at timestamptz,
  deleted_at timestamptz,
  media_path text,
  media_duration_ms integer,
  reactions jsonb,
  peer_last_read_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with chat as (
    select public.travel_chat_trip_id(chat_access_code) as trip_id
  ),
  peer_read as (
    select max(reads.last_read_at) as peer_last_read_at
    from public.travel_chat_reads as reads
    join chat on chat.trip_id = reads.trip_id
    where reads.user_id is distinct from auth.uid()
  ),
  recent as (
    select
      message.id,
      message.sender_name,
      message.sender_device_id,
      message.sender_user_id,
      case
        when message.deleted_at is not null then ''
        else message.body
      end as body,
      message.created_at,
      message.kind,
      message.reply_to_id,
      message.edited_at,
      message.deleted_at,
      case
        when message.deleted_at is not null then null
        else message.media_path
      end as media_path,
      case
        when message.deleted_at is not null then null
        else message.media_duration_ms
      end as media_duration_ms
    from public.travel_chat_messages as message
    join chat on chat.trip_id = message.trip_id
    where message.sender_user_id is null
       or message.sender_user_id = auth.uid()
       or not public.users_are_blocked(auth.uid(), message.sender_user_id)
    order by message.created_at desc
    limit 500
  )
  select
    recent.id,
    recent.sender_name,
    recent.sender_device_id,
    recent.sender_user_id,
    recent.body,
    recent.created_at,
    recent.kind,
    recent.reply_to_id,
    case
      when parent.deleted_at is not null then 'Message deleted'
      when parent.kind = 'voice' then 'Voice message'
      else left(coalesce(parent.body, ''), 120)
    end as reply_preview,
    parent.sender_name as reply_sender_name,
    recent.edited_at,
    recent.deleted_at,
    recent.media_path,
    recent.media_duration_ms,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'emoji', grouped.emoji,
          'count', grouped.reaction_count,
          'mine', grouped.mine
        )
        order by grouped.emoji
      )
      from (
        select
          reaction.emoji,
          count(*)::int as reaction_count,
          bool_or(reaction.user_id = auth.uid()) as mine
        from public.travel_chat_reactions as reaction
        where reaction.message_id = recent.id
        group by reaction.emoji
      ) as grouped
    ), '[]'::jsonb) as reactions,
    peer_read.peer_last_read_at
  from recent
  left join public.travel_chat_messages as parent on parent.id = recent.reply_to_id
  cross join peer_read
  order by recent.created_at asc;
$$;

revoke all on function public.travel_chat_messages(text) from public, anon;
grant execute on function public.travel_chat_messages(text) to authenticated;

create or replace function public.send_travel_chat_message(
  chat_access_code text,
  chat_sender_device_id uuid,
  chat_sender_name text,
  chat_body text default '',
  chat_reply_to_id uuid default null,
  chat_kind text default 'text',
  chat_media_path text default null,
  chat_media_duration_ms integer default null
)
returns public.travel_chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  chat_trip_id text;
  inserted public.travel_chat_messages;
  actor uuid := auth.uid();
  cleaned_body text := btrim(coalesce(chat_body, ''));
  cleaned_kind text := coalesce(nullif(btrim(chat_kind), ''), 'text');
  reply_trip text;
  reply_sender uuid;
begin
  if actor is null then
    raise exception 'Sign in to send trip chat messages.';
  end if;
  chat_trip_id := public.travel_chat_trip_id(chat_access_code);
  if chat_trip_id is null
    or length(btrim(chat_sender_name)) not between 1 and 120
    or cleaned_kind not in ('text', 'voice') then
    raise exception 'This trip chat is unavailable.';
  end if;

  if cleaned_kind = 'text' then
    if length(cleaned_body) not between 1 and 2000 then
      raise exception 'This trip chat is unavailable.';
    end if;
    if chat_media_path is not null or chat_media_duration_ms is not null then
      raise exception 'This trip chat is unavailable.';
    end if;
  else
    if chat_media_path is null
      or length(btrim(chat_media_path)) < 3
      or chat_media_duration_ms is null
      or chat_media_duration_ms <= 0
      or chat_media_duration_ms > 60000 then
      raise exception 'Voice message could not be sent.';
    end if;
    if length(cleaned_body) > 2000 then
      raise exception 'Messages can be up to 2,000 characters.';
    end if;
  end if;

  if public.travel_chat_body_is_blocked(cleaned_body) then
    raise exception 'This message was blocked because it appears to contain prohibited content.';
  end if;

  if chat_reply_to_id is not null then
    select message.trip_id, message.sender_user_id
      into reply_trip, reply_sender
    from public.travel_chat_messages as message
    where message.id = chat_reply_to_id;
    if reply_trip is distinct from chat_trip_id then
      raise exception 'This trip chat is unavailable.';
    end if;
    if public.users_are_blocked(actor, reply_sender) then
      raise exception 'You cannot reply to this person.';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    87201434,
    hashtext(chat_trip_id || ':' || actor::text)
  );

  if exists (
    select 1
    from public.travel_chat_messages as message
    where message.trip_id = chat_trip_id
      and message.sender_user_id = actor
      and message.created_at > now() - interval '1 second'
  ) then
    raise exception 'Please wait a moment before sending another message.';
  end if;

  insert into public.travel_chat_messages (
    trip_id,
    sender_device_id,
    sender_user_id,
    sender_name,
    body,
    kind,
    reply_to_id,
    media_path,
    media_duration_ms
  )
  values (
    chat_trip_id,
    chat_sender_device_id,
    actor,
    btrim(chat_sender_name),
    cleaned_body,
    cleaned_kind,
    chat_reply_to_id,
    case when cleaned_kind = 'voice' then btrim(chat_media_path) else null end,
    case when cleaned_kind = 'voice' then chat_media_duration_ms else null end
  )
  returning * into inserted;
  return inserted;
end;
$$;

revoke all on function public.send_travel_chat_message(
  text, uuid, text, text, uuid, text, text, integer
) from public, anon;
grant execute on function public.send_travel_chat_message(
  text, uuid, text, text, uuid, text, text, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- Lock-screen previews off by default
-- ---------------------------------------------------------------------------
alter table public.travel_chat_devices
  add column if not exists show_previews boolean not null default false;

create or replace function public.set_travel_chat_preview_preference(
  chat_access_code text,
  chat_device_id uuid,
  chat_show_previews boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  chat_trip_id text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to update chat alerts.';
  end if;
  chat_trip_id := public.travel_chat_trip_id(chat_access_code);
  if chat_trip_id is null then
    raise exception 'This trip chat is unavailable.';
  end if;
  update public.travel_chat_devices
  set show_previews = coalesce(chat_show_previews, false),
      updated_at = now()
  where trip_id = chat_trip_id
    and device_id = chat_device_id;
end;
$$;

revoke all on function public.set_travel_chat_preview_preference(text, uuid, boolean) from public;
grant execute on function public.set_travel_chat_preview_preference(text, uuid, boolean) to authenticated;

create or replace function public.notify_travel_chat_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notifications jsonb;
  generic_body text;
  preview text;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  generic_body := case
    when new.kind = 'voice' then 'New voice message'
    else 'New message'
  end;
  preview := case
    when new.kind = 'voice' then 'Voice message'
    when length(btrim(coalesce(new.body, ''))) = 0 then 'New message'
    when length(new.body) > 140 then left(new.body, 137) || '...'
    else new.body
  end;

  select jsonb_agg(
    jsonb_build_object(
      'to', device.expo_push_token,
      'title', 'Trip Chat',
      'body', case
        when device.show_previews then
          coalesce(nullif(btrim(new.sender_name), ''), 'Trip member') || ': ' || preview
        else
          generic_body || ' from ' || coalesce(nullif(btrim(new.sender_name), ''), 'a trip member')
      end,
      'sound', 'default',
      'channelId', 'event-chat',
      'data', jsonb_build_object(
        'url', '/travel-chat',
        'tripId', new.trip_id
      )
    )
  )
  into notifications
  from public.travel_chat_devices as device
  join public.travel_invites as invite on invite.code = device.access_code
  where device.trip_id = new.trip_id
    and device.device_id <> new.sender_device_id
    and invite.revoked_at is null
    and invite.expires_at > now()
    and not public.users_are_blocked(
      new.sender_user_id,
      coalesce(invite.accepted_by_user_id, invite.inviter_user_id)
    );

  if notifications is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
      body := notifications
    );
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile avatars: owner / friend / trip-mate only
-- ---------------------------------------------------------------------------
create or replace function public.can_read_profile_avatar(owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and owner_id is not null
    and (
      owner_id = auth.uid()
      or exists (
        select 1
        from public.friendships as friendship
        where (friendship.user_a = auth.uid() and friendship.user_b = owner_id)
           or (friendship.user_b = auth.uid() and friendship.user_a = owner_id)
      )
      or exists (
        select 1
        from public.travel_invites as mine
        join public.travel_invites as theirs
          on theirs.trip_id = mine.trip_id
        where mine.accepted_at is not null
          and mine.revoked_at is null
          and mine.expires_at > now()
          and theirs.accepted_at is not null
          and theirs.revoked_at is null
          and theirs.expires_at > now()
          and (
            mine.inviter_user_id = auth.uid()
            or mine.accepted_by_user_id = auth.uid()
          )
          and (
            theirs.inviter_user_id = owner_id
            or theirs.accepted_by_user_id = owner_id
          )
      )
    );
$$;

revoke all on function public.can_read_profile_avatar(uuid) from public;
grant execute on function public.can_read_profile_avatar(uuid) to authenticated;

drop policy if exists "authenticated read profile avatars" on storage.objects;
drop policy if exists "owner friends or trip mates read profile avatars" on storage.objects;

create policy "owner friends or trip mates read profile avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and public.can_read_profile_avatar(((storage.foldername(name))[1])::uuid)
);

-- ---------------------------------------------------------------------------
-- Account purge: E-ZPass + moderation + keep later vault patches
-- ---------------------------------------------------------------------------
create or replace function public.purge_user_data(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  hosted_trip_ids text[];
begin
  if target_user_id is null then
    raise exception 'Missing user';
  end if;

  select coalesce(array_agg(distinct trip_id), '{}'::text[])
  into hosted_trip_ids
  from (
    select invite.trip_id
    from public.travel_invites as invite
    where invite.inviter_user_id = target_user_id
    union
    select link.trip_id
    from public.travel_open_join_links as link
    where link.host_user_id = target_user_id
  ) as hosted;

  delete from public.travel_chat_reactions where user_id = target_user_id;
  delete from public.travel_chat_reads where user_id = target_user_id;
  delete from public.travel_chat_messages
  where sender_user_id = target_user_id
     or trip_id = any(hosted_trip_ids);
  delete from public.travel_chat_devices as device
  using public.travel_invites as invite
  where device.access_code = invite.code
    and (invite.inviter_user_id = target_user_id
      or invite.accepted_by_user_id = target_user_id);

  update public.todo_items
  set assignee_user_ids = array_remove(assignee_user_ids, target_user_id),
      assignee_user_id = case when assignee_user_id = target_user_id then null else assignee_user_id end,
      completed_by_user_id = case
        when completed_by_user_id = target_user_id then null
        else completed_by_user_id
      end
  where target_user_id = any(assignee_user_ids)
     or assignee_user_id = target_user_id
     or completed_by_user_id = target_user_id;
  update public.travel_trip_itinerary_items
  set shared_with_user_ids = array_remove(shared_with_user_ids, target_user_id)
  where target_user_id = any(shared_with_user_ids);

  delete from public.care_team_memberships
  where clinician_id = target_user_id or granted_by = target_user_id;
  delete from public.nutrition_target_versions
  where author_id = target_user_id or approved_by = target_user_id;
  delete from public.meals where created_by = target_user_id;
  delete from public.consent_records where guardian_id = target_user_id;
  delete from public.audit_events where actor_id = target_user_id;
  update public.clinician_profiles set verified_by = null
  where verified_by = target_user_id;
  delete from public.nutrition_profiles where owner_id = target_user_id;
  delete from public.clinician_profiles where user_id = target_user_id;
  delete from public.user_roles where user_id = target_user_id;

  delete from public.todo_collaborator_links where created_by_user_id = target_user_id;
  delete from public.todo_email_invites
  where inviter_user_id = target_user_id or accepted_by_user_id = target_user_id;
  delete from public.todo_share_links where created_by_user_id = target_user_id;
  delete from public.todo_mutation_receipts where user_id = target_user_id;
  delete from public.todo_list_members where user_id = target_user_id;
  delete from public.todo_lists where owner_user_id = target_user_id;

  update public.vehicle_activity_events set actor_user_id = null
  where actor_user_id = target_user_id;
  delete from public.vehicle_share_links where created_by_user_id = target_user_id;
  delete from public.vehicle_mutation_receipts where user_id = target_user_id;
  delete from public.vehicle_members where user_id = target_user_id;
  delete from public.vehicles where owner_user_id = target_user_id;

  delete from public.travel_trip_cohosts
  where user_id = target_user_id or granted_by_user_id = target_user_id;
  delete from public.travel_trip_itinerary_items where owner_user_id = target_user_id;
  delete from public.travel_trip_expenses where owner_user_id = target_user_id;
  delete from public.travel_map_visits where owner_id = target_user_id;
  delete from public.travel_map_profiles where owner_id = target_user_id;
  delete from public.travel_open_join_requests
  where requester_user_id = target_user_id or decided_by_user_id = target_user_id;
  delete from public.travel_open_join_links where host_user_id = target_user_id;
  delete from public.travel_invites
  where inviter_user_id = target_user_id or accepted_by_user_id = target_user_id;

  delete from public.friendships
  where user_a = target_user_id or user_b = target_user_id;
  delete from public.friend_requests
  where from_user_id = target_user_id or to_user_id = target_user_id;
  delete from public.friend_invite_links where from_user_id = target_user_id;
  delete from public.user_blocks
  where blocker_id = target_user_id or blocked_id = target_user_id;
  delete from public.content_reports
  where reporter_id = target_user_id or target_user_id = target_user_id;
  delete from public.profiles where user_id = target_user_id;

  delete from public.food_posts where author_id = target_user_id;
  delete from public.food_meal_plan_entries where owner_id = target_user_id;
  delete from public.food_pantry_items where owner_id = target_user_id;
  delete from public.food_recipes where owner_id = target_user_id;
  delete from public.food_profiles where user_id = target_user_id;
  delete from public.google_drive_connections where user_id = target_user_id;
  delete from public.google_calendar_event_links where user_id = target_user_id;
  delete from public.google_calendar_connections where user_id = target_user_id;
  delete from public.partner_stay_packages where user_id = target_user_id;
  delete from public.partner_links where user_id = target_user_id;
  delete from public.partner_link_challenges where user_id = target_user_id;
  delete from public.teller_enrollments where user_id = target_user_id;
  delete from public.teller_link_sessions where user_id = target_user_id;
  delete from public.plaid_items where user_id = target_user_id;
  delete from public.plaid_link_sessions where user_id = target_user_id;
  delete from public.ezpass_shared_transactions
  where ledger_id in (
    select ledger.id from public.ezpass_ledgers as ledger
    where ledger.owner_user_id = target_user_id
  );
  delete from public.ezpass_ledger_members
  where user_id = target_user_id
     or ledger_id in (
       select ledger.id from public.ezpass_ledgers as ledger
       where ledger.owner_user_id = target_user_id
     );
  delete from public.ezpass_ledgers where owner_user_id = target_user_id;
  delete from public.analytics_daily where user_id = target_user_id;
  delete from public.app_state where user_id = target_user_id;
end;
$$;

revoke all on function public.purge_user_data(uuid) from public;
