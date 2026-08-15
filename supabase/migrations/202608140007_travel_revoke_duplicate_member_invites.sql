-- Removing an accepted traveler must revoke every live invite membership for
-- that account on the trip. Otherwise an older accepted invite immediately
-- resurfaces as the same traveler after the newest invite is revoked.

create or replace function public.revoke_travel_invite(invite_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.travel_invites%rowtype;
begin
  select * into invite
  from public.travel_invites as candidate
  where candidate.code = invite_code
  limit 1;

  if invite.code is null then
    return;
  end if;

  if not (
    invite.inviter_user_id = auth.uid()
    or public.is_travel_trip_manager(invite.trip_id)
  ) then
    raise exception 'Only the trip host or a co-host can remove this invite.';
  end if;

  update public.travel_invites as candidate
  set revoked_at = coalesce(candidate.revoked_at, now())
  where candidate.code = invite.code
    or (
      invite.accepted_by_user_id is not null
      and candidate.trip_id = invite.trip_id
      and candidate.accepted_by_user_id = invite.accepted_by_user_id
      and candidate.revoked_at is null
    );

  if invite.accepted_by_user_id is not null then
    delete from public.travel_trip_cohosts
    where trip_id = invite.trip_id
      and user_id = invite.accepted_by_user_id;
  end if;
end;
$$;

revoke all on function public.revoke_travel_invite(text) from public;
grant execute on function public.revoke_travel_invite(text) to authenticated;
