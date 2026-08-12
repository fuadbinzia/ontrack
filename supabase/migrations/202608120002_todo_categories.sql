-- User-defined checklist categories and per-item category assignment.
create table public.todo_categories (
  id uuid primary key,
  list_id uuid not null references public.todo_lists(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index todo_categories_list_name_idx
  on public.todo_categories(list_id, lower(btrim(name)));
create index todo_categories_list_position_idx
  on public.todo_categories(list_id, position, created_at);

alter table public.todo_items
  add column category_id uuid references public.todo_categories(id) on delete set null;
create index todo_items_category_idx
  on public.todo_items(category_id) where category_id is not null;

alter table public.todo_categories enable row level security;
revoke all on public.todo_categories from anon, authenticated;
create policy "members read todo categories"
on public.todo_categories for select to authenticated
using (public.is_todo_member(list_id));
grant select on public.todo_categories to authenticated;

create trigger todo_categories_broadcast
after insert or update or delete on public.todo_categories
for each row execute function public.broadcast_todo_change();

create or replace function public.set_todo_categories(
  requested_list_id uuid,
  categories_payload jsonb,
  assignments_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_todo_owner(requested_list_id) then
    raise exception 'Only the list owner can publish categories.';
  end if;

  insert into public.todo_categories(
    id, list_id, name, position, created_at, updated_at
  )
  select
    (category ->> 'id')::uuid,
    requested_list_id,
    left(btrim(category ->> 'name'), 40),
    coalesce(nullif(category ->> 'position', '')::double precision, 0),
    coalesce((category ->> 'createdAt')::timestamptz, now()),
    coalesce((category ->> 'updatedAt')::timestamptz, now())
  from jsonb_array_elements(coalesce(categories_payload, '[]'::jsonb))
    as expanded(category)
  on conflict (id) do nothing;

  update public.todo_items as item
  set category_id = assignment.category_id
  from (
    select
      (value ->> 'taskId')::uuid as task_id,
      (value ->> 'categoryId')::uuid as category_id
    from jsonb_array_elements(coalesce(assignments_payload, '[]'::jsonb))
  ) as assignment
  where item.id = assignment.task_id
    and item.list_id = requested_list_id
    and exists (
      select 1 from public.todo_categories as category
      where category.id = assignment.category_id
        and category.list_id = requested_list_id
    );
end;
$$;

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

create or replace function public.todo_list_snapshot(requested_list_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_todo_member(requested_list_id) then jsonb_build_object(
    'list', jsonb_build_object(
      'id', list.id, 'name', list.name, 'kind', list.kind, 'mode', 'shared',
      'role', current_member.role, 'ownerUserId', list.owner_user_id,
      'ownerName', owner_member.display_name, 'createdAt', list.created_at,
      'updatedAt', list.updated_at
    ),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', category.id, 'listId', category.list_id, 'name', category.name,
        'position', category.position, 'createdAt', category.created_at,
        'updatedAt', category.updated_at
      ) order by category.position, category.created_at)
      from public.todo_categories as category where category.list_id = list.id
    ), '[]'::jsonb),
    'recipes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', recipe.id, 'listId', recipe.list_id, 'name', recipe.name,
        'sourceKind', recipe.source_kind, 'sourceUrl', recipe.source_url,
        'sourceImageUri', case when recipe.source_image_path is null then null
          else 'ontrack-todo-recipe-media:' || recipe.source_image_path end,
        'sourceImagePath', recipe.source_image_path,
        'originalServings', recipe.original_servings,
        'targetServings', recipe.target_servings, 'position', recipe.position,
        'createdAt', recipe.created_at, 'updatedAt', recipe.updated_at
      ) order by recipe.position nulls last, recipe.created_at desc)
      from public.todo_recipes as recipe where recipe.list_id = list.id
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', item.id, 'listId', item.list_id, 'position', item.position,
        'categoryId', item.category_id, 'recipeId', item.recipe_id,
        'ingredientPosition', item.ingredient_position,
        'ingredientName', item.ingredient_name, 'canonicalKey', item.canonical_key,
        'quantityValue', item.quantity_value, 'quantityText', item.quantity_text,
        'unit', item.unit, 'preparation', item.preparation,
        'originalText', item.original_text, 'confidence', item.confidence,
        'title', item.title, 'completed', item.completed,
        'important', item.important, 'assigneeUserId', item.assignee_user_id,
        'completedByUserId', item.completed_by_user_id,
        'completedAt', item.completed_at, 'version', item.version,
        'createdAt', item.created_at, 'updatedAt', item.updated_at
      ) order by item.recipe_id nulls last, item.ingredient_position nulls last,
        item.position nulls last, item.created_at desc)
      from public.todo_items as item where item.list_id = list.id
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'listId', member.list_id, 'userId', member.user_id,
        'displayName', member.display_name, 'role', member.role,
        'joinedAt', member.joined_at
      ) order by member.role, member.joined_at)
      from public.todo_list_members as member where member.list_id = list.id
    ), '[]'::jsonb)
  ) else null end
  from public.todo_lists as list
  join public.todo_list_members as current_member
    on current_member.list_id = list.id and current_member.user_id = auth.uid()
  join public.todo_list_members as owner_member
    on owner_member.list_id = list.id and owner_member.user_id = list.owner_user_id
  where list.id = requested_list_id;
$$;

revoke all on function public.set_todo_categories(uuid, jsonb, jsonb) from public;
revoke all on function public.apply_todo_category_mutations(jsonb) from public;
grant execute on function public.set_todo_categories(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.apply_todo_category_mutations(jsonb) to authenticated;
