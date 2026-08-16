-- Fail closed when a non-owner calls delete_todo_list instead of deleting zero rows.

create or replace function public.delete_todo_list(requested_list_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required.';
  end if;
  if not public.is_todo_owner(requested_list_id) then
    raise exception 'Only the owner can delete this list.';
  end if;
  delete from public.todo_lists
  where id = requested_list_id and owner_user_id = auth.uid();
  if not found then
    raise exception 'Only the owner can delete this list.';
  end if;
end;
$$;
