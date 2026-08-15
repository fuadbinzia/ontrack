alter table public.ezpass_ledger_members
  drop constraint ezpass_ledger_members_role_check;

alter table public.ezpass_ledger_members
  add constraint ezpass_ledger_members_role_check
  check (role in ('owner', 'cohost', 'member'));

create or replace function public.is_ezpass_host(requested_ledger_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ezpass_ledger_members member
    where member.ledger_id = requested_ledger_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'cohost')
  );
$$;

create or replace function public.add_ezpass_ledger_members(
  requested_ledger_id uuid,
  requested_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  friend_id uuid;
  friend_name text;
begin
  if not public.is_ezpass_host(requested_ledger_id) then
    raise exception 'Only E-ZPass hosts can add friends.';
  end if;
  if requested_user_ids is null or cardinality(requested_user_ids) = 0 then
    raise exception 'Pick at least one friend.';
  end if;

  foreach friend_id in array requested_user_ids loop
    if friend_id is null or friend_id = actor then continue; end if;
    if not public.are_friends(actor, friend_id) then
      raise exception 'Only connected friends can join this E-ZPass ledger.';
    end if;
    select coalesce(nullif(btrim(profile.display_name), ''), 'onTrack Member')
      into friend_name
    from public.profiles profile
    where profile.user_id = friend_id;

    insert into public.ezpass_ledger_members(ledger_id, user_id, display_name, role)
    values (
      requested_ledger_id,
      friend_id,
      coalesce(friend_name, 'onTrack Member'),
      'member'
    )
    on conflict (ledger_id, user_id) do update
      set display_name = excluded.display_name;
  end loop;
  return requested_ledger_id;
end;
$$;

create or replace function public.set_ezpass_member_role(
  requested_ledger_id uuid,
  requested_user_id uuid,
  requested_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  owner_id uuid;
begin
  if not public.is_ezpass_host(requested_ledger_id) then
    raise exception 'Only E-ZPass hosts can manage co-hosts.';
  end if;
  if requested_role is null or requested_role not in ('cohost', 'member') then
    raise exception 'Choose member or co-host access.';
  end if;
  select ledger.owner_user_id
    into owner_id
  from public.ezpass_ledgers ledger
  where ledger.id = requested_ledger_id;
  if requested_user_id is null or requested_user_id = owner_id then
    raise exception 'The E-ZPass owner cannot be changed.';
  end if;
  if requested_user_id = actor then
    raise exception 'Hosts cannot change their own access.';
  end if;

  update public.ezpass_ledger_members member
  set role = requested_role
  where member.ledger_id = requested_ledger_id
    and member.user_id = requested_user_id
    and member.role <> 'owner';
  if not found then raise exception 'That E-ZPass member no longer exists.'; end if;
end;
$$;

create or replace function public.remove_ezpass_ledger_member(
  requested_ledger_id uuid,
  requested_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  owner_id uuid;
begin
  if not public.is_ezpass_host(requested_ledger_id) then
    raise exception 'Only E-ZPass hosts can remove members.';
  end if;
  select ledger.owner_user_id
    into owner_id
  from public.ezpass_ledgers ledger
  where ledger.id = requested_ledger_id;
  if requested_user_id is null or requested_user_id = owner_id then
    raise exception 'The E-ZPass owner cannot be removed.';
  end if;
  if requested_user_id = actor then
    raise exception 'Hosts cannot remove themselves.';
  end if;

  update public.ezpass_shared_transactions activity_row
  set assigned_user_id = null, updated_at = now()
  where activity_row.ledger_id = requested_ledger_id
    and activity_row.assigned_user_id = requested_user_id;
  delete from public.ezpass_ledger_members member
  where member.ledger_id = requested_ledger_id
    and member.user_id = requested_user_id
    and member.role <> 'owner';
  if not found then raise exception 'That E-ZPass member no longer exists.'; end if;
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
  select member.role
    into actor_role
  from public.ezpass_ledger_members member
  where member.ledger_id = requested_ledger_id and member.user_id = actor;
  if actor_role is null then
    raise exception 'You no longer have access to this E-ZPass ledger.';
  end if;

  select activity_row.assigned_user_id
    into current_assignee
  from public.ezpass_shared_transactions activity_row
  where activity_row.ledger_id = requested_ledger_id
    and activity_row.transaction_id = requested_transaction_id
  for update;
  if not found then raise exception 'That E-ZPass activity no longer exists.'; end if;

  if actor_role in ('owner', 'cohost') then
    if requested_user_id is not null and not exists (
      select 1 from public.ezpass_ledger_members member
      where member.ledger_id = requested_ledger_id
        and member.user_id = requested_user_id
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

  update public.ezpass_shared_transactions activity_row
  set assigned_user_id = requested_user_id, updated_at = now()
  where activity_row.ledger_id = requested_ledger_id
    and activity_row.transaction_id = requested_transaction_id;
  update public.ezpass_ledgers ledger
  set updated_at = now()
  where ledger.id = requested_ledger_id;
end;
$$;

revoke all on function public.is_ezpass_host(uuid) from public;
revoke all on function public.add_ezpass_ledger_members(uuid, uuid[]) from public;
revoke all on function public.set_ezpass_member_role(uuid, uuid, text) from public;
revoke all on function public.remove_ezpass_ledger_member(uuid, uuid) from public;

grant execute on function public.is_ezpass_host(uuid) to authenticated;
grant execute on function public.add_ezpass_ledger_members(uuid, uuid[]) to authenticated;
grant execute on function public.set_ezpass_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_ezpass_ledger_member(uuid, uuid) to authenticated;
