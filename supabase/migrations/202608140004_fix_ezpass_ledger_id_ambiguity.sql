create or replace function public.ensure_ezpass_ledger()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_ledger_id uuid;
  owner_name text;
begin
  if actor is null then raise exception 'Sign in required.'; end if;

  insert into public.ezpass_ledgers(owner_user_id)
  values (actor)
  on conflict (owner_user_id) do update set updated_at = now()
  returning id into target_ledger_id;

  select coalesce(nullif(btrim(profile.display_name), ''), 'You')
    into owner_name
  from public.profiles profile
  where profile.user_id = actor;

  insert into public.ezpass_ledger_members(ledger_id, user_id, display_name, role)
  values (target_ledger_id, actor, coalesce(owner_name, 'You'), 'owner')
  on conflict (ledger_id, user_id) do update
    set display_name = excluded.display_name, role = 'owner';
  return target_ledger_id;
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
  target_ledger_id uuid;
  friend_id uuid;
  friend_name text;
begin
  if requested_user_ids is null or cardinality(requested_user_ids) = 0 then
    raise exception 'Pick at least one friend.';
  end if;
  target_ledger_id := public.ensure_ezpass_ledger();

  foreach friend_id in array requested_user_ids loop
    if friend_id is null or friend_id = actor then continue; end if;
    if not public.are_friends(actor, friend_id) then
      raise exception 'Only connected friends can join this E-ZPass ledger.';
    end if;
    select coalesce(nullif(btrim(profile.display_name), ''), 'onTrack Member')
      into friend_name from public.profiles profile where profile.user_id = friend_id;
    insert into public.ezpass_ledger_members(ledger_id, user_id, display_name, role)
    values (target_ledger_id, friend_id, coalesce(friend_name, 'onTrack Member'), 'member')
    on conflict (ledger_id, user_id) do update
      set display_name = excluded.display_name;
  end loop;
  return target_ledger_id;
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
  target_ledger_id uuid;
begin
  select ledger.id
    into target_ledger_id
  from public.ezpass_ledgers ledger
  where ledger.owner_user_id = actor;
  if target_ledger_id is null then raise exception 'Only the owner can remove members.'; end if;
  if requested_user_id is null or requested_user_id = actor then
    raise exception 'Pick a member to remove.';
  end if;
  update public.ezpass_shared_transactions
    set assigned_user_id = null, updated_at = now()
    where ezpass_shared_transactions.ledger_id = target_ledger_id
      and assigned_user_id = requested_user_id;
  delete from public.ezpass_ledger_members
    where ezpass_ledger_members.ledger_id = target_ledger_id
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
  target_ledger_id uuid;
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
  target_ledger_id := public.ensure_ezpass_ledger();

  for item in select value from jsonb_array_elements(transactions_payload) loop
    if coalesce(item->>'id', '') = '' then raise exception 'Each activity needs an id.'; end if;
    requested_assignee := nullif(item->>'assignedUserId', '')::uuid;
    if requested_assignee is not null and not exists (
      select 1 from public.ezpass_ledger_members member
      where member.ledger_id = target_ledger_id and member.user_id = requested_assignee
    ) then requested_assignee := null; end if;

    seen_ids := array_append(seen_ids, item->>'id');
    insert into public.ezpass_shared_transactions(
      ledger_id, transaction_id, activity_date, activity_time, merchant,
      amount, currency, activity, assigned_user_id
    ) values (
      target_ledger_id,
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
  where activity_row.ledger_id = target_ledger_id
    and not (activity_row.transaction_id = any(seen_ids));
  update public.ezpass_ledgers set updated_at = now() where id = target_ledger_id;
  return target_ledger_id;
end;
$$;
