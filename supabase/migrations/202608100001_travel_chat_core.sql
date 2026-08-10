-- Trip chat core: reply/edit/delete, reactions, read watermarks, voice,
-- and private Realtime broadcasts (replace client polling).

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.travel_chat_messages
  add column if not exists kind text not null default 'text',
  add column if not exists reply_to_id uuid references public.travel_chat_messages (id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists media_path text,
  add column if not exists media_duration_ms integer;

alter table public.travel_chat_messages
  drop constraint if exists travel_chat_messages_body_check;

alter table public.travel_chat_messages
  alter column body set default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'travel_chat_messages_kind_check'
  ) then
    alter table public.travel_chat_messages
      add constraint travel_chat_messages_kind_check
      check (kind in ('text', 'voice'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'travel_chat_messages_media_duration_check'
  ) then
    alter table public.travel_chat_messages
      add constraint travel_chat_messages_media_duration_check
      check (
        media_duration_ms is null
        or (media_duration_ms > 0 and media_duration_ms <= 60000)
      );
  end if;
end $$;

create index if not exists travel_chat_messages_trip_created_alive_idx
  on public.travel_chat_messages (trip_id, created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Reactions
-- ---------------------------------------------------------------------------
create table if not exists public.travel_chat_reactions (
  message_id uuid not null references public.travel_chat_messages (id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id),
  constraint travel_chat_reactions_emoji_check
    check (emoji in ('👍', '❤️', '😂', '😮', '😢', '🙏'))
);

create index if not exists travel_chat_reactions_message_idx
  on public.travel_chat_reactions (message_id);

alter table public.travel_chat_reactions enable row level security;
revoke all on public.travel_chat_reactions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Read watermarks (group ticks = any other member past created_at)
-- ---------------------------------------------------------------------------
create table if not exists public.travel_chat_reads (
  trip_id text not null,
  user_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

alter table public.travel_chat_reads enable row level security;
revoke all on public.travel_chat_reads from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Membership helper for Realtime RLS
-- ---------------------------------------------------------------------------
create or replace function public.is_travel_chat_member(requested_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.travel_invites as invite
    where invite.trip_id = requested_trip_id
      and invite.accepted_at is not null
      and invite.revoked_at is null
      and invite.expires_at > now()
      and auth.uid() is not null
      and (
        invite.inviter_user_id = auth.uid()
        or invite.accepted_by_user_id = auth.uid()
      )
  );
$$;

revoke all on function public.is_travel_chat_member(text) from public;
grant execute on function public.is_travel_chat_member(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Broadcast helpers
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_travel_chat_event(
  chat_trip_id text,
  payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    payload,
    'changed',
    'travel-chat:trip:' || chat_trip_id,
    true
  );
exception
  when others then
    null;
end;
$$;

create or replace function public.broadcast_travel_chat_message_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.travel_chat_messages;
  op text := tg_op;
begin
  row := coalesce(new, old);
  perform public.broadcast_travel_chat_event(
    row.trip_id,
    jsonb_build_object(
      'type', 'message',
      'op', op,
      'id', row.id,
      'trip_id', row.trip_id
    )
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists travel_chat_message_broadcast on public.travel_chat_messages;
create trigger travel_chat_message_broadcast
after insert or update on public.travel_chat_messages
for each row execute function public.broadcast_travel_chat_message_change();

create or replace function public.broadcast_travel_chat_reaction_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg public.travel_chat_messages;
  target_id uuid := coalesce(new.message_id, old.message_id);
begin
  select * into msg from public.travel_chat_messages where id = target_id;
  if msg.id is null then
    return coalesce(new, old);
  end if;
  perform public.broadcast_travel_chat_event(
    msg.trip_id,
    jsonb_build_object(
      'type', 'reaction',
      'op', tg_op,
      'message_id', target_id,
      'trip_id', msg.trip_id
    )
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists travel_chat_reaction_broadcast on public.travel_chat_reactions;
create trigger travel_chat_reaction_broadcast
after insert or update or delete on public.travel_chat_reactions
for each row execute function public.broadcast_travel_chat_reaction_change();

create or replace function public.broadcast_travel_chat_read_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.broadcast_travel_chat_event(
    new.trip_id,
    jsonb_build_object(
      'type', 'read',
      'op', 'UPSERT',
      'trip_id', new.trip_id,
      'user_id', new.user_id,
      'last_read_at', new.last_read_at
    )
  );
  return new;
end;
$$;

drop trigger if exists travel_chat_read_broadcast on public.travel_chat_reads;
create trigger travel_chat_read_broadcast
after insert or update on public.travel_chat_reads
for each row execute function public.broadcast_travel_chat_read_change();

-- ---------------------------------------------------------------------------
-- Push: voice-friendly body
-- ---------------------------------------------------------------------------
create or replace function public.notify_travel_chat_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notifications jsonb;
  preview text;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  preview := case
    when new.kind = 'voice' then 'Voice message'
    when length(btrim(coalesce(new.body, ''))) = 0 then 'New message'
    when length(new.body) > 140 then left(new.body, 137) || '...'
    else new.body
  end;
  select jsonb_agg(
    jsonb_build_object(
      'to', device.expo_push_token,
      'title', new.sender_name,
      'body', preview,
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
    and invite.expires_at > now();

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
-- Load messages (+ reactions, reply preview, peer read watermark)
-- ---------------------------------------------------------------------------
drop function if exists public.travel_chat_messages(text);

create function public.travel_chat_messages(chat_access_code text)
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

-- ---------------------------------------------------------------------------
-- Send (text / voice + optional reply)
-- ---------------------------------------------------------------------------
drop function if exists public.send_travel_chat_message(text, uuid, text, text);

create function public.send_travel_chat_message(
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

  if chat_reply_to_id is not null then
    select message.trip_id into reply_trip
    from public.travel_chat_messages as message
    where message.id = chat_reply_to_id;
    if reply_trip is distinct from chat_trip_id then
      raise exception 'This trip chat is unavailable.';
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
-- Edit / delete (sender only)
-- ---------------------------------------------------------------------------
create or replace function public.edit_travel_chat_message(
  chat_access_code text,
  chat_message_id uuid,
  chat_body text
)
returns public.travel_chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  chat_trip_id text;
  actor uuid := auth.uid();
  updated public.travel_chat_messages;
  cleaned_body text := btrim(coalesce(chat_body, ''));
begin
  if actor is null then
    raise exception 'Sign in to edit trip chat messages.';
  end if;
  chat_trip_id := public.travel_chat_trip_id(chat_access_code);
  if chat_trip_id is null or length(cleaned_body) not between 1 and 2000 then
    raise exception 'This message could not be edited.';
  end if;

  update public.travel_chat_messages as message
  set
    body = cleaned_body,
    edited_at = now()
  where message.id = chat_message_id
    and message.trip_id = chat_trip_id
    and message.sender_user_id = actor
    and message.deleted_at is null
    and message.kind = 'text'
  returning * into updated;

  if updated.id is null then
    raise exception 'This message could not be edited.';
  end if;
  return updated;
end;
$$;

revoke all on function public.edit_travel_chat_message(text, uuid, text) from public, anon;
grant execute on function public.edit_travel_chat_message(text, uuid, text) to authenticated;

create or replace function public.delete_travel_chat_message(
  chat_access_code text,
  chat_message_id uuid
)
returns public.travel_chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  chat_trip_id text;
  actor uuid := auth.uid();
  updated public.travel_chat_messages;
begin
  if actor is null then
    raise exception 'Sign in to delete trip chat messages.';
  end if;
  chat_trip_id := public.travel_chat_trip_id(chat_access_code);
  if chat_trip_id is null then
    raise exception 'This message could not be deleted.';
  end if;

  update public.travel_chat_messages as message
  set
    deleted_at = now(),
    body = '',
    media_path = null,
    media_duration_ms = null
  where message.id = chat_message_id
    and message.trip_id = chat_trip_id
    and message.sender_user_id = actor
    and message.deleted_at is null
  returning * into updated;

  if updated.id is null then
    raise exception 'This message could not be deleted.';
  end if;
  return updated;
end;
$$;

revoke all on function public.delete_travel_chat_message(text, uuid) from public, anon;
grant execute on function public.delete_travel_chat_message(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reactions
-- ---------------------------------------------------------------------------
create or replace function public.set_travel_chat_reaction(
  chat_access_code text,
  chat_message_id uuid,
  chat_emoji text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  chat_trip_id text;
  actor uuid := auth.uid();
  msg_trip text;
  existing text;
begin
  if actor is null then
    raise exception 'Sign in to react to trip chat messages.';
  end if;
  chat_trip_id := public.travel_chat_trip_id(chat_access_code);
  if chat_trip_id is null
    or chat_emoji not in ('👍', '❤️', '😂', '😮', '😢', '🙏') then
    raise exception 'This reaction could not be saved.';
  end if;

  select message.trip_id into msg_trip
  from public.travel_chat_messages as message
  where message.id = chat_message_id
    and message.deleted_at is null;
  if msg_trip is distinct from chat_trip_id then
    raise exception 'This reaction could not be saved.';
  end if;

  select reaction.emoji into existing
  from public.travel_chat_reactions as reaction
  where reaction.message_id = chat_message_id
    and reaction.user_id = actor;

  if existing is not distinct from chat_emoji then
    delete from public.travel_chat_reactions
    where message_id = chat_message_id
      and user_id = actor;
  else
    insert into public.travel_chat_reactions (message_id, user_id, emoji)
    values (chat_message_id, actor, chat_emoji)
    on conflict (message_id, user_id)
    do update set emoji = excluded.emoji, created_at = now();
  end if;
end;
$$;

revoke all on function public.set_travel_chat_reaction(text, uuid, text) from public, anon;
grant execute on function public.set_travel_chat_reaction(text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Read watermark
-- ---------------------------------------------------------------------------
create or replace function public.mark_travel_chat_read(
  chat_access_code text,
  chat_read_at timestamptz default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  chat_trip_id text;
  actor uuid := auth.uid();
  stamp timestamptz := coalesce(chat_read_at, now());
begin
  if actor is null then
    raise exception 'Sign in to update chat read state.';
  end if;
  chat_trip_id := public.travel_chat_trip_id(chat_access_code);
  if chat_trip_id is null then
    raise exception 'This trip chat is unavailable.';
  end if;

  insert into public.travel_chat_reads (trip_id, user_id, last_read_at)
  values (chat_trip_id, actor, stamp)
  on conflict (trip_id, user_id)
  do update set last_read_at = greatest(
    public.travel_chat_reads.last_read_at,
    excluded.last_read_at
  );

  return stamp;
end;
$$;

revoke all on function public.mark_travel_chat_read(text, timestamptz) from public, anon;
grant execute on function public.mark_travel_chat_read(text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime RLS (private topic travel-chat:trip:{tripId})
-- ---------------------------------------------------------------------------
drop policy if exists "travel chat members receive private broadcasts"
  on realtime.messages;
create policy "travel chat members receive private broadcasts"
on realtime.messages for select to authenticated
using (
  split_part(realtime.topic(), ':', 1) = 'travel-chat'
  and split_part(realtime.topic(), ':', 2) = 'trip'
  and public.is_travel_chat_member(split_part(realtime.topic(), ':', 3))
);

drop policy if exists "travel chat members can send private broadcasts"
  on realtime.messages;
create policy "travel chat members can send private broadcasts"
on realtime.messages for insert to authenticated
with check (
  split_part(realtime.topic(), ':', 1) = 'travel-chat'
  and split_part(realtime.topic(), ':', 2) = 'trip'
  and public.is_travel_chat_member(split_part(realtime.topic(), ':', 3))
);
