-- Private shared E-ZPass ledgers. Only normalized activity is shared; uploaded
-- documents and the owner's wider Finance snapshot never enter these tables.

create table public.ezpass_ledgers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ezpass_ledger_members (
  ledger_id uuid not null references public.ezpass_ledgers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'onTrack Member',
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (ledger_id, user_id)
);

create table public.ezpass_shared_transactions (
  ledger_id uuid not null references public.ezpass_ledgers(id) on delete cascade,
  transaction_id text not null check (char_length(transaction_id) between 1 and 200),
  activity_date date not null,
  activity_time time,
  merchant text not null check (char_length(merchant) between 1 and 240),
  amount numeric(14, 2) not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  activity text not null check (activity in ('expense', 'refund', 'transfer', 'adjustment')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ledger_id, transaction_id)
);

create index ezpass_members_user_idx on public.ezpass_ledger_members(user_id, ledger_id);
create index ezpass_transactions_ledger_date_idx
  on public.ezpass_shared_transactions(ledger_id, activity_date desc, activity_time desc);

alter table public.ezpass_ledgers enable row level security;
alter table public.ezpass_ledger_members enable row level security;
alter table public.ezpass_shared_transactions enable row level security;

revoke all on public.ezpass_ledgers from anon, authenticated;
revoke all on public.ezpass_ledger_members from anon, authenticated;
revoke all on public.ezpass_shared_transactions from anon, authenticated;

create or replace function public.is_ezpass_member(requested_ledger_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ezpass_ledger_members member
    where member.ledger_id = requested_ledger_id
      and member.user_id = auth.uid()
  );
$$;

create policy ezpass_ledgers_member_read on public.ezpass_ledgers
for select to authenticated using (public.is_ezpass_member(id));

create policy ezpass_members_member_read on public.ezpass_ledger_members
for select to authenticated using (public.is_ezpass_member(ledger_id));

create policy ezpass_transactions_member_read on public.ezpass_shared_transactions
for select to authenticated using (public.is_ezpass_member(ledger_id));

create or replace function public.ensure_ezpass_ledger()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ledger_id uuid;
  owner_name text;
begin
  if actor is null then raise exception 'Sign in required.'; end if;

  insert into public.ezpass_ledgers(owner_user_id)
  values (actor)
  on conflict (owner_user_id) do update set updated_at = now()
  returning id into ledger_id;

  select coalesce(nullif(btrim(profile.display_name), ''), 'You')
    into owner_name
  from public.profiles profile
  where profile.user_id = actor;

  insert into public.ezpass_ledger_members(ledger_id, user_id, display_name, role)
  values (ledger_id, actor, coalesce(owner_name, 'You'), 'owner')
  on conflict (ledger_id, user_id) do update
    set display_name = excluded.display_name, role = 'owner';
  return ledger_id;
end;
$$;

create or replace function public.add_ezpass_friend_members(requested_user_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ledger_id uuid;
  friend_id uuid;
  friend_name text;
begin
  if requested_user_ids is null or cardinality(requested_user_ids) = 0 then
    raise exception 'Pick at least one friend.';
  end if;
  ledger_id := public.ensure_ezpass_ledger();

  foreach friend_id in array requested_user_ids loop
    if friend_id is null or friend_id = actor then continue; end if;
    if not public.are_friends(actor, friend_id) then
      raise exception 'Only connected friends can join this E-ZPass ledger.';
    end if;
    select coalesce(nullif(btrim(profile.display_name), ''), 'onTrack Member')
      into friend_name from public.profiles profile where profile.user_id = friend_id;
    insert into public.ezpass_ledger_members(ledger_id, user_id, display_name, role)
    values (ledger_id, friend_id, coalesce(friend_name, 'onTrack Member'), 'member')
    on conflict (ledger_id, user_id) do update
      set display_name = excluded.display_name;
  end loop;
  return ledger_id;
end;
$$;

create or replace function public.remove_ezpass_member(requested_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ledger_id uuid;
begin
  select id into ledger_id from public.ezpass_ledgers where owner_user_id = actor;
  if ledger_id is null then raise exception 'Only the owner can remove members.'; end if;
  if requested_user_id is null or requested_user_id = actor then
    raise exception 'Pick a member to remove.';
  end if;
  update public.ezpass_shared_transactions
    set assigned_user_id = null, updated_at = now()
    where ezpass_shared_transactions.ledger_id = ledger_id
      and assigned_user_id = requested_user_id;
  delete from public.ezpass_ledger_members
    where ezpass_ledger_members.ledger_id = ledger_id
      and user_id = requested_user_id and role = 'member';
end;
$$;

create or replace function public.sync_ezpass_transactions(transactions_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ledger_id uuid;
  item jsonb;
  requested_assignee uuid;
  seen_ids text[] := array[]::text[];
begin
  if transactions_payload is null or jsonb_typeof(transactions_payload) <> 'array' then
    raise exception 'E-ZPass activity must be an array.';
  end if;
  if jsonb_array_length(transactions_payload) > 5000 then
    raise exception 'At most 5,000 E-ZPass activities can be shared at once.';
  end if;
  ledger_id := public.ensure_ezpass_ledger();

  for item in select value from jsonb_array_elements(transactions_payload) loop
    if coalesce(item->>'id', '') = '' then raise exception 'Each activity needs an id.'; end if;
    requested_assignee := nullif(item->>'assignedUserId', '')::uuid;
    if requested_assignee is not null and not exists (
      select 1 from public.ezpass_ledger_members member
      where member.ledger_id = ledger_id and member.user_id = requested_assignee
    ) then requested_assignee := null; end if;

    seen_ids := array_append(seen_ids, item->>'id');
    insert into public.ezpass_shared_transactions(
      ledger_id, transaction_id, activity_date, activity_time, merchant,
      amount, currency, activity, assigned_user_id
    ) values (
      ledger_id,
      left(item->>'id', 200),
      (item->>'date')::date,
      nullif(item->>'activityTime', '')::time,
      left(coalesce(nullif(btrim(item->>'merchant'), ''), 'E-ZPass Activity'), 240),
      (item->>'amount')::numeric,
      upper(coalesce(nullif(item->>'currency', ''), 'USD')),
      case when item->>'activity' in ('expense', 'refund', 'transfer', 'adjustment')
        then item->>'activity' else 'expense' end,
      requested_assignee
    )
    on conflict (ledger_id, transaction_id) do update set
      activity_date = excluded.activity_date,
      activity_time = excluded.activity_time,
      merchant = excluded.merchant,
      amount = excluded.amount,
      currency = excluded.currency,
      activity = excluded.activity,
      assigned_user_id = coalesce(
        public.ezpass_shared_transactions.assigned_user_id,
        excluded.assigned_user_id
      ),
      updated_at = now();
  end loop;

  delete from public.ezpass_shared_transactions activity_row
  where activity_row.ledger_id = ledger_id
    and not (activity_row.transaction_id = any(seen_ids));
  update public.ezpass_ledgers set updated_at = now() where id = ledger_id;
  return ledger_id;
end;
$$;

create or replace function public.tag_ezpass_transaction(
  requested_ledger_id uuid,
  requested_transaction_id text,
  requested_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  current_assignee uuid;
begin
  select role into actor_role from public.ezpass_ledger_members
  where ledger_id = requested_ledger_id and user_id = actor;
  if actor_role is null then raise exception 'You no longer have access to this E-ZPass ledger.'; end if;

  select assigned_user_id into current_assignee
  from public.ezpass_shared_transactions
  where ledger_id = requested_ledger_id and transaction_id = requested_transaction_id
  for update;
  if not found then raise exception 'That E-ZPass activity no longer exists.'; end if;

  if actor_role = 'owner' then
    if requested_user_id is not null and not exists (
      select 1 from public.ezpass_ledger_members member
      where member.ledger_id = requested_ledger_id and member.user_id = requested_user_id
    ) then raise exception 'Choose someone on this E-ZPass ledger.'; end if;
  elsif requested_user_id = actor then
    if current_assignee is not null and current_assignee <> actor then
      raise exception 'That activity is already tagged to someone else.';
    end if;
  elsif requested_user_id is null and current_assignee = actor then
    null;
  else
    raise exception 'Members can only tag or untag themselves.';
  end if;

  update public.ezpass_shared_transactions
  set assigned_user_id = requested_user_id, updated_at = now()
  where ledger_id = requested_ledger_id and transaction_id = requested_transaction_id;
  update public.ezpass_ledgers set updated_at = now() where id = requested_ledger_id;
end;
$$;

create or replace function public.ezpass_ledger_snapshots()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ledger.id,
    'ownerUserId', ledger.owner_user_id,
    'role', viewer.role,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', member.user_id,
        'displayName', member.display_name,
        'role', member.role
      ) order by member.role desc, member.display_name)
      from public.ezpass_ledger_members member where member.ledger_id = ledger.id
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', activity_row.transaction_id,
        'date', activity_row.activity_date,
        'activityTime', to_char(activity_row.activity_time, 'HH24:MI:SS'),
        'merchant', activity_row.merchant,
        'amount', activity_row.amount,
        'currency', activity_row.currency,
        'activity', activity_row.activity,
        'assignedUserId', activity_row.assigned_user_id,
        'assignedUserName', assignee.display_name,
        'updatedAt', activity_row.updated_at
      ) order by activity_row.activity_date desc, activity_row.activity_time desc nulls last)
      from public.ezpass_shared_transactions activity_row
      left join public.ezpass_ledger_members assignee
        on assignee.ledger_id = activity_row.ledger_id
       and assignee.user_id = activity_row.assigned_user_id
      where activity_row.ledger_id = ledger.id
    ), '[]'::jsonb)
  ) order by ledger.updated_at desc), '[]'::jsonb)
  from public.ezpass_ledgers ledger
  join public.ezpass_ledger_members viewer
    on viewer.ledger_id = ledger.id and viewer.user_id = auth.uid();
$$;

revoke all on function public.is_ezpass_member(uuid) from public;
revoke all on function public.ensure_ezpass_ledger() from public;
revoke all on function public.add_ezpass_friend_members(uuid[]) from public;
revoke all on function public.remove_ezpass_member(uuid) from public;
revoke all on function public.sync_ezpass_transactions(jsonb) from public;
revoke all on function public.tag_ezpass_transaction(uuid, text, uuid) from public;
revoke all on function public.ezpass_ledger_snapshots() from public;

grant execute on function public.is_ezpass_member(uuid) to authenticated;
grant execute on function public.ensure_ezpass_ledger() to authenticated;
grant execute on function public.add_ezpass_friend_members(uuid[]) to authenticated;
grant execute on function public.remove_ezpass_member(uuid) to authenticated;
grant execute on function public.sync_ezpass_transactions(jsonb) to authenticated;
grant execute on function public.tag_ezpass_transaction(uuid, text, uuid) to authenticated;
grant execute on function public.ezpass_ledger_snapshots() to authenticated;
grant select on public.ezpass_ledgers to authenticated;
grant select on public.ezpass_ledger_members to authenticated;
grant select on public.ezpass_shared_transactions to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.ezpass_ledgers;
  alter publication supabase_realtime add table public.ezpass_ledger_members;
  alter publication supabase_realtime add table public.ezpass_shared_transactions;
exception when duplicate_object then null;
end $$;
