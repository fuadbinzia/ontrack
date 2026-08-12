-- Local PL/pgSQL vars cannot be function-qualified; rename to avoid column clash.
create or replace function public.apply_todo_category_mutations(mutations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  mutation jsonb;
  v_mutation_id uuid;
  v_list_id uuid;
  v_operation text;
  v_payload jsonb;
  v_category jsonb;
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
    v_mutation_id := (mutation ->> 'id')::uuid;
    v_list_id := (mutation ->> 'listId')::uuid;
    v_operation := mutation ->> 'operation';
    v_payload := coalesce(mutation -> 'payload', '{}'::jsonb);
    begin
      if not public.is_todo_editor(v_list_id) then
        raise exception 'Only an editor or owner can make that change.';
      end if;
      if exists (
        select 1 from public.todo_mutation_receipts as receipt
        where receipt.user_id = auth.uid()
          and receipt.mutation_id = v_mutation_id
      ) then
        results := results || jsonb_build_array(jsonb_build_object(
          'id', v_mutation_id, 'ok', true
        ));
        continue;
      end if;

      if v_operation = 'add_category' then
        v_category := v_payload -> 'category';
        insert into public.todo_categories(
          id, list_id, name, position, created_at, updated_at
        ) values (
          (v_category ->> 'id')::uuid,
          v_list_id,
          left(btrim(v_category ->> 'name'), 40),
          coalesce(nullif(v_category ->> 'position', '')::double precision, 0),
          coalesce((v_category ->> 'createdAt')::timestamptz, now()),
          now()
        ) on conflict (id) do nothing;
      elsif v_operation = 'delete_category' then
        delete from public.todo_categories
        where id = (v_payload ->> 'categoryId')::uuid
          and todo_categories.list_id = v_list_id;
      elsif v_operation = 'set_task_category' then
        update public.todo_items
        set category_id = nullif(v_payload ->> 'categoryId', '')::uuid,
          updated_at = now(), version = version + 1
        where id = (v_payload ->> 'taskId')::uuid
          and todo_items.list_id = v_list_id
          and (
            nullif(v_payload ->> 'categoryId', '') is null
            or exists (
              select 1 from public.todo_categories as existing_category
              where existing_category.id = (v_payload ->> 'categoryId')::uuid
                and existing_category.list_id = v_list_id
            )
          );
      else
        raise exception 'Unsupported category mutation.';
      end if;

      update public.todo_lists set updated_at = now() where id = v_list_id;
      insert into public.todo_mutation_receipts(user_id, mutation_id, list_id)
      values (auth.uid(), v_mutation_id, v_list_id);
      results := results || jsonb_build_array(jsonb_build_object(
        'id', v_mutation_id, 'ok', true
      ));
    exception when others then
      results := results || jsonb_build_array(jsonb_build_object(
        'id', v_mutation_id, 'ok', false, 'error', sqlerrm
      ));
    end;
  end loop;
  return results;
end;
$$;
