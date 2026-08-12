-- Keep reset/delete behavior in one audited transaction. `reset_own_data`
-- retains auth; `delete_own_account` purges the same graph before deleting it.

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

  -- User ids also appear in arrays and chat tables without auth foreign keys.
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

  -- Clinical rows can reference a user while the profile belongs to somebody else.
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

  -- Collaboration membership and owned roots.
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
  delete from public.profiles where user_id = target_user_id;

  -- Private/account-owned product data.
  delete from public.food_posts where author_id = target_user_id;
  delete from public.food_meal_plan_entries where owner_id = target_user_id;
  delete from public.food_pantry_items where owner_id = target_user_id;
  delete from public.food_recipes where owner_id = target_user_id;
  delete from public.food_profiles where user_id = target_user_id;
  delete from public.google_calendar_event_links where user_id = target_user_id;
  delete from public.google_calendar_connections where user_id = target_user_id;
  delete from public.partner_stay_packages where user_id = target_user_id;
  delete from public.partner_links where user_id = target_user_id;
  delete from public.partner_link_challenges where user_id = target_user_id;
  delete from public.plaid_items where user_id = target_user_id;
  delete from public.plaid_link_sessions where user_id = target_user_id;
  delete from public.analytics_daily where user_id = target_user_id;
  delete from public.app_state where user_id = target_user_id;
end;
$$;

revoke all on function public.purge_user_data(uuid) from public;

create or replace function public.reset_own_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  perform public.purge_user_data(uid);
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  perform public.purge_user_data(uid);
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.reset_own_data() from public;
revoke all on function public.delete_own_account() from public;
grant execute on function public.reset_own_data() to authenticated;
grant execute on function public.delete_own_account() to authenticated;

comment on function public.reset_own_data() is
  'Permanently deletes all data for the caller while retaining the auth account.';
comment on function public.delete_own_account() is
  'Permanently deletes all data for the caller and then deletes the auth account.';
