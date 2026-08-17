-- Bind chat device rows to auth.uid() so trip mates cannot flip another
-- person's lock-screen previews or steal their Expo push token.
-- Hide other members' sender_device_id on message load.
-- Keep users_are_blocked internal to SECURITY DEFINER functions.

alter table public.travel_chat_devices
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

update public.travel_chat_devices as device
set user_id = (
  select message.sender_user_id
  from public.travel_chat_messages as message
  where message.trip_id = device.trip_id
    and message.sender_device_id = device.device_id
    and message.sender_user_id is not null
  order by message.created_at desc
  limit 1
)
where device.user_id is null;

create index if not exists travel_chat_devices_user_trip_idx
  on public.travel_chat_devices (user_id, trip_id);

create or replace function public.register_travel_chat_device(
  chat_access_code text,
  chat_device_id uuid,
  chat_expo_push_token text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  chat_trip_id text;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Sign in to join trip notifications.';
  end if;
  chat_trip_id := public.travel_chat_trip_id(chat_access_code);
  if chat_trip_id is null
    or chat_expo_push_token !~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'This device could not join trip notifications.';
  end if;

  if exists (
    select 1
    from public.travel_chat_devices as device
    where device.trip_id = chat_trip_id
      and device.device_id = chat_device_id
      and device.user_id is not null
      and device.user_id <> actor
  ) then
    raise exception 'This device could not join trip notifications.';
  end if;

  delete from public.travel_chat_devices
  where trip_id = chat_trip_id
    and user_id = actor
    and expo_push_token = chat_expo_push_token
    and device_id <> chat_device_id;

  insert into public.travel_chat_devices (
    device_id,
    trip_id,
    expo_push_token,
    access_code,
    user_id,
    updated_at
  )
  values (
    chat_device_id,
    chat_trip_id,
    chat_expo_push_token,
    chat_access_code,
    actor,
    now()
  )
  on conflict (device_id, trip_id) do update
  set expo_push_token = excluded.expo_push_token,
      access_code = excluded.access_code,
      user_id = excluded.user_id,
      updated_at = now()
  where public.travel_chat_devices.user_id is null
     or public.travel_chat_devices.user_id = actor;
end;
$$;

revoke all on function public.register_travel_chat_device(text, uuid, text) from public, anon;
grant execute on function public.register_travel_chat_device(text, uuid, text) to authenticated;

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
  actor uuid := auth.uid();
  updated_count integer;
begin
  if actor is null then
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
    and device_id = chat_device_id
    and user_id = actor;
  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'This device could not update chat alerts.';
  end if;
end;
$$;

revoke all on function public.set_travel_chat_preview_preference(text, uuid, boolean) from public;
grant execute on function public.set_travel_chat_preview_preference(text, uuid, boolean) to authenticated;

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
      case
        when message.sender_user_id is not distinct from auth.uid()
          then message.sender_device_id
        else null
      end as sender_device_id,
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

revoke all on function public.users_are_blocked(uuid, uuid) from public, anon, authenticated;
