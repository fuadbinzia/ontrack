-- Fix ambiguous mutation_id in category mutation receipts (PL/pgSQL var vs column).
create or replace function public.apply_todo_category_mutations(mutations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  mutation jsonb;
  mutation_id uuid;
  target_list_id uuid;
  operation text;
  payload jsonb;
  category jsonb;
  results jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or jsonb_typeof(mutations) <> 'array' then
    raise exception 'Sign in to sync list changes.';
  end if;
  if jsonb_array_length(mutations) < 1 or jsonb_array_length(mutations) > 50 then
    raise exception 'Mutation batches must contain between 1 and 50 changes.';
  end if;

  for mutation in select value from jsonb_array_elements(mutations)
  loop
    mutation_id := (mutation ->> 'id')::uuid;
    target_list_id := (mutation ->> 'listId')::uuid;
    operation := mutation ->> 'operation';
    payload := coalesce(mutation -> 'payload', '{}'::jsonb);
    begin
      if not public.is_todo_editor(target_list_id) then
        raise exception 'Only an editor or owner can make that change.';
      end if;
      if exists (
        select 1 from public.todo_mutation_receipts as receipt
        where receipt.user_id = auth.uid()
          and receipt.mutation_id = apply_todo_category_mutations.mutation_id
      ) then
        results := results || jsonb_build_array(jsonb_build_object(
          'id', mutation_id, 'ok', true
        ));
        continue;
      end if;

      if operation = 'add_category' then
        category := payload -> 'category';
        insert into public.todo_categories(
          id, list_id, name, position, created_at, updated_at
        ) values (
          (category ->> 'id')::uuid,
          target_list_id,
          left(btrim(category ->> 'name'), 40),
          coalesce(nullif(category ->> 'position', '')::double precision, 0),
          coalesce((category ->> 'createdAt')::timestamptz, now()),
          now()
        ) on conflict (id) do nothing;
      elsif operation = 'delete_category' then
        delete from public.todo_categories
        where id = (payload ->> 'categoryId')::uuid
          and todo_categories.list_id = target_list_id;
      elsif operation = 'set_task_category' then
        update public.todo_items
        set category_id = nullif(payload ->> 'categoryId', '')::uuid,
          updated_at = now(), version = version + 1
        where id = (payload ->> 'taskId')::uuid
          and todo_items.list_id = target_list_id
          and (
            nullif(payload ->> 'categoryId', '') is null
            or exists (
              select 1 from public.todo_categories as existing_category
              where existing_category.id = (payload ->> 'categoryId')::uuid
                and existing_category.list_id = target_list_id
            )
          );
      else
        raise exception 'Unsupported category mutation.';
      end if;

      update public.todo_lists set updated_at = now() where id = target_list_id;
      insert into public.todo_mutation_receipts(user_id, mutation_id, list_id)
      values (
        auth.uid(),
        apply_todo_category_mutations.mutation_id,
        target_list_id
      );
      results := results || jsonb_build_array(jsonb_build_object(
        'id', mutation_id, 'ok', true
      ));
    exception when others then
      results := results || jsonb_build_array(jsonb_build_object(
        'id', mutation_id, 'ok', false, 'error', sqlerrm
      ));
    end;
  end loop;
  return results;
end;
$$;
