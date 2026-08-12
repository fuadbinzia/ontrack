-- Multi-assignee checklist items: empty array = Anyone.

alter table public.todo_items
  add column if not exists assignee_user_ids uuid[] not null default '{}';

update public.todo_items
set assignee_user_ids = array[assignee_user_id]
where assignee_user_id is not null
  and cardinality(assignee_user_ids) = 0;

create or replace function public.todo_item_open_or_assigned_to(
  item public.todo_items,
  actor uuid
)
returns boolean
language sql
immutable
as $$
  select
    actor is not null
    and case
      when cardinality(coalesce(item.assignee_user_ids, '{}'::uuid[])) > 0
        then actor = any (item.assignee_user_ids)
      when item.assignee_user_id is not null
        then item.assignee_user_id = actor
      else true
    end;
$$;

create or replace function public.remove_user_from_todo_assignees(
  requested_list_id uuid,
  requested_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.todo_items
  set
    assignee_user_ids = array_remove(assignee_user_ids, requested_user_id),
    assignee_user_id = case
      when assignee_user_id = requested_user_id then (
        select remaining
        from unnest(array_remove(assignee_user_ids, requested_user_id)) as remaining
        limit 1
      )
      else assignee_user_id
    end,
    updated_at = now(),
    version = version + 1
  where list_id = requested_list_id
    and (
      assignee_user_id = requested_user_id
      or requested_user_id = any (assignee_user_ids)
    );
end;
$$;

create or replace function public.remove_todo_member(
  requested_list_id uuid,
  requested_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_todo_owner(requested_list_id) then
    raise exception 'Only the owner can remove members.';
  end if;
  if requested_user_id = auth.uid() then
    raise exception 'The owner cannot remove themselves.';
  end if;
  perform public.remove_user_from_todo_assignees(requested_list_id, requested_user_id);
  delete from public.todo_list_members
  where list_id = requested_list_id
    and user_id = requested_user_id
    and role in ('editor', 'member');
end;
$$;

create or replace function public.leave_todo_list(requested_list_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_todo_owner(requested_list_id) then
    raise exception 'Transfer ownership first, or delete the list instead.';
  end if;
  perform public.remove_user_from_todo_assignees(requested_list_id, auth.uid());
  delete from public.todo_list_members
  where list_id = requested_list_id and user_id = auth.uid();
end;
$$;

create or replace function public.apply_todo_mutation(
  mutation_id uuid,
  requested_list_id uuid,
  operation text,
  mutation_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  requested_task_id uuid;
  requested_recipe_id uuid;
  requested_assignee uuid;
  requested_assignees uuid[] := '{}'::uuid[];
  requested_completed boolean;
  existing_item public.todo_items;
  recipe_payload jsonb;
  editor_ops text[] := array[
    'add_task',
    'update_task',
    'delete_task',
    'set_assignee',
    'reorder_tasks',
    'clear_completed'
  ];
begin
  if actor is null or not public.is_todo_member(requested_list_id) then
    raise exception 'You no longer have access to this list.';
  end if;
  if exists (
    select 1 from public.todo_mutation_receipts as receipt
    where receipt.user_id = actor
      and receipt.mutation_id = apply_todo_mutation.mutation_id
  ) then
    return;
  end if;

  if operation = 'set_completion' then
    requested_task_id := (mutation_payload ->> 'taskId')::uuid;
    requested_completed := (mutation_payload ->> 'completed')::boolean;
    select * into existing_item
    from public.todo_items as item
    where item.id = requested_task_id and item.list_id = requested_list_id
    for update;

    if existing_item.id is null or (
      not public.is_todo_editor(requested_list_id)
      and not public.todo_item_open_or_assigned_to(existing_item, actor)
    ) then
      raise exception 'This item is assigned to someone else.';
    end if;

    update public.todo_items
    set completed = requested_completed,
      completed_by_user_id = case when requested_completed then actor else null end,
      completed_at = case when requested_completed then now() else null end,
      updated_at = now(),
      version = version + 1
    where id = requested_task_id and list_id = requested_list_id;
  elsif operation = 'set_tasks_completion' then
    requested_completed := (mutation_payload ->> 'completed')::boolean;
    update public.todo_items as item
    set completed = requested_completed,
      completed_by_user_id = case when requested_completed then actor else null end,
      completed_at = case when requested_completed then now() else null end,
      updated_at = now(),
      version = version + 1
    where item.list_id = requested_list_id
      and item.id in (
        select value::uuid
        from jsonb_array_elements_text(
          coalesce(mutation_payload -> 'taskIds', '[]'::jsonb)
        )
      )
      and (
        public.is_todo_editor(requested_list_id)
        or public.todo_item_open_or_assigned_to(item, actor)
      );
  else
    if operation = any (editor_ops) then
      if not public.is_todo_editor(requested_list_id) then
        raise exception 'Only an editor or owner can make that change.';
      end if;
    elsif not public.is_todo_owner(requested_list_id) then
      raise exception 'Only the list owner can make that change.';
    end if;

    if operation = 'rename_list' then
      update public.todo_lists
      set name = left(btrim(mutation_payload ->> 'name'), 80),
        updated_at = now()
      where id = requested_list_id;
    elsif operation = 'set_list_kind' then
      if mutation_payload ->> 'kind' not in ('checklist', 'grocery') then
        raise exception 'The list type is invalid.';
      end if;
      if mutation_payload ->> 'kind' = 'checklist'
        and exists (
          select 1 from public.todo_recipes
          where list_id = requested_list_id
        ) then
        raise exception 'Delete recipe groups before converting this list.';
      end if;
      update public.todo_lists
      set kind = mutation_payload ->> 'kind', updated_at = now()
      where id = requested_list_id;
    elsif operation = 'add_task' then
      insert into public.todo_items(
        id, list_id, position, title, completed, important, created_at, updated_at
      )
      values (
        (mutation_payload -> 'task' ->> 'id')::uuid,
        requested_list_id,
        nullif(mutation_payload -> 'task' ->> 'position', '')::double precision,
        left(btrim(mutation_payload -> 'task' ->> 'title'), 160),
        false,
        coalesce((mutation_payload -> 'task' ->> 'important')::boolean, false),
        now(),
        now()
      )
      on conflict (id) do nothing;
    elsif operation = 'add_recipe' then
      recipe_payload := mutation_payload -> 'recipe';
      requested_recipe_id := (recipe_payload ->> 'id')::uuid;
      if not exists (
        select 1 from public.todo_lists
        where id = requested_list_id and kind = 'grocery'
      ) then
        raise exception 'Recipes can only be added to Grocery lists.';
      end if;
      insert into public.todo_recipes(
        id, list_id, name, source_kind, source_url, source_image_path,
        original_servings, target_servings, position, created_at, updated_at
      )
      values (
        requested_recipe_id,
        requested_list_id,
        left(btrim(recipe_payload ->> 'name'), 80),
        case when recipe_payload ->> 'sourceKind' = 'image' then 'image' else 'url' end,
        nullif(left(btrim(recipe_payload ->> 'sourceUrl'), 2000), ''),
        nullif(left(btrim(recipe_payload ->> 'sourceImagePath'), 500), ''),
        nullif(recipe_payload ->> 'originalServings', '')::numeric,
        nullif(recipe_payload ->> 'targetServings', '')::numeric,
        nullif(recipe_payload ->> 'position', '')::double precision,
        coalesce((recipe_payload ->> 'createdAt')::timestamptz, now()),
        now()
      )
      on conflict (id) do nothing;

      insert into public.todo_items(
        id, list_id, recipe_id, ingredient_position, ingredient_name,
        canonical_key, quantity_value, quantity_text, unit, preparation,
        original_text, confidence, title, completed, important, created_at,
        updated_at
      )
      select
        (task ->> 'id')::uuid,
        requested_list_id,
        requested_recipe_id,
        nullif(task ->> 'ingredientPosition', '')::integer,
        nullif(left(btrim(task ->> 'ingredientName'), 100), ''),
        nullif(left(btrim(task ->> 'canonicalKey'), 120), ''),
        nullif(task ->> 'quantityValue', '')::numeric,
        nullif(left(btrim(task ->> 'quantityText'), 40), ''),
        nullif(left(btrim(task ->> 'unit'), 40), ''),
        nullif(left(btrim(task ->> 'preparation'), 80), ''),
        nullif(left(btrim(task ->> 'originalText'), 240), ''),
        nullif(task ->> 'confidence', '')::numeric,
        left(btrim(task ->> 'title'), 160),
        false,
        false,
        now(),
        now()
      from jsonb_array_elements(
        coalesce(mutation_payload -> 'tasks', '[]'::jsonb)
      ) as expanded(task)
      on conflict (id) do nothing;
    elsif operation = 'update_recipe' then
      recipe_payload := mutation_payload -> 'recipe';
      requested_recipe_id := (recipe_payload ->> 'id')::uuid;
      update public.todo_recipes
      set name = left(btrim(recipe_payload ->> 'name'), 80),
        source_url = nullif(left(btrim(recipe_payload ->> 'sourceUrl'), 2000), ''),
        source_image_path = coalesce(
          nullif(left(btrim(recipe_payload ->> 'sourceImagePath'), 500), ''),
          source_image_path
        ),
        original_servings = nullif(recipe_payload ->> 'originalServings', '')::numeric,
        target_servings = nullif(recipe_payload ->> 'targetServings', '')::numeric,
        updated_at = now()
      where id = requested_recipe_id and list_id = requested_list_id;
    elsif operation = 'delete_recipe' then
      delete from public.todo_recipes
      where id = (mutation_payload ->> 'recipeId')::uuid
        and list_id = requested_list_id;
    elsif operation = 'update_ingredient' then
      requested_task_id := (mutation_payload -> 'task' ->> 'id')::uuid;
      update public.todo_items
      set ingredient_name = nullif(left(btrim(mutation_payload -> 'task' ->> 'ingredientName'), 100), ''),
        canonical_key = nullif(left(btrim(mutation_payload -> 'task' ->> 'canonicalKey'), 120), ''),
        quantity_value = nullif(mutation_payload -> 'task' ->> 'quantityValue', '')::numeric,
        quantity_text = nullif(left(btrim(mutation_payload -> 'task' ->> 'quantityText'), 40), ''),
        unit = nullif(left(btrim(mutation_payload -> 'task' ->> 'unit'), 40), ''),
        preparation = nullif(left(btrim(mutation_payload -> 'task' ->> 'preparation'), 80), ''),
        original_text = nullif(left(btrim(mutation_payload -> 'task' ->> 'originalText'), 240), ''),
        confidence = nullif(mutation_payload -> 'task' ->> 'confidence', '')::numeric,
        title = left(btrim(mutation_payload -> 'task' ->> 'title'), 160),
        updated_at = now(),
        version = version + 1
      where id = requested_task_id
        and list_id = requested_list_id
        and recipe_id is not null;
    elsif operation = 'update_task' then
      requested_task_id := (mutation_payload ->> 'taskId')::uuid;
      update public.todo_items
      set title = case
          when mutation_payload ? 'title'
            then left(btrim(mutation_payload ->> 'title'), 160)
          else title
        end,
        important = case
          when mutation_payload ? 'important'
            then (mutation_payload ->> 'important')::boolean
          else important
        end,
        updated_at = now(),
        version = version + 1
      where id = requested_task_id and list_id = requested_list_id;
    elsif operation = 'delete_task' then
      requested_recipe_id := nullif(
        mutation_payload ->> 'deleteRecipeId', ''
      )::uuid;
      delete from public.todo_items
      where id = (mutation_payload ->> 'taskId')::uuid
        and list_id = requested_list_id;
      if requested_recipe_id is not null and not exists (
        select 1 from public.todo_items where recipe_id = requested_recipe_id
      ) then
        delete from public.todo_recipes
        where id = requested_recipe_id and list_id = requested_list_id;
      end if;
    elsif operation = 'set_assignee' then
      requested_task_id := (mutation_payload ->> 'taskId')::uuid;
      if jsonb_typeof(mutation_payload -> 'assigneeUserIds') = 'array' then
        select coalesce(array_agg(distinct value::uuid), '{}'::uuid[])
          into requested_assignees
        from jsonb_array_elements_text(
          coalesce(mutation_payload -> 'assigneeUserIds', '[]'::jsonb)
        ) as expanded(value)
        where nullif(value, '') is not null;
      else
        requested_assignee := nullif(
          mutation_payload ->> 'assigneeUserId', ''
        )::uuid;
        requested_assignees := case
          when requested_assignee is null then '{}'::uuid[]
          else array[requested_assignee]
        end;
      end if;
      if exists (
        select 1
        from unnest(requested_assignees) as assignee(user_id)
        where not exists (
          select 1 from public.todo_list_members as member
          where member.list_id = requested_list_id
            and member.user_id = assignee.user_id
        )
      ) then
        raise exception 'The assignee is not a member of this list.';
      end if;
      update public.todo_items
      set assignee_user_ids = requested_assignees,
        assignee_user_id = requested_assignees[1],
        updated_at = now(),
        version = version + 1
      where id = requested_task_id and list_id = requested_list_id;
    elsif operation = 'reorder_tasks' then
      update public.todo_items as item
      set position = ordered.position, updated_at = now()
      from (
        select value::uuid as id, ordinality - 1 as position
        from jsonb_array_elements_text(
          coalesce(mutation_payload -> 'orderedIds', '[]'::jsonb)
        ) with ordinality
      ) as ordered
      where item.id = ordered.id and item.list_id = requested_list_id;
    elsif operation = 'reorder_recipes' then
      update public.todo_recipes as recipe
      set position = ordered.position, updated_at = now()
      from (
        select value::uuid as id, ordinality - 1 as position
        from jsonb_array_elements_text(
          coalesce(mutation_payload -> 'orderedIds', '[]'::jsonb)
        ) with ordinality
      ) as ordered
      where recipe.id = ordered.id and recipe.list_id = requested_list_id;
    elsif operation = 'clear_completed' then
      delete from public.todo_items
      where list_id = requested_list_id and completed;
      delete from public.todo_recipes as recipe
      where recipe.list_id = requested_list_id
        and not exists (
          select 1 from public.todo_items as item
          where item.recipe_id = recipe.id
        );
    else
      raise exception 'Unsupported to-do mutation.';
    end if;
  end if;

  update public.todo_lists
  set updated_at = now()
  where id = requested_list_id;

  insert into public.todo_mutation_receipts(user_id, mutation_id, list_id)
  values (actor, mutation_id, requested_list_id);
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
        'important', item.important,
        'assigneeUserIds', to_jsonb(coalesce(item.assignee_user_ids, '{}'::uuid[])),
        'assigneeUserId', item.assignee_user_id,
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

revoke all on function public.todo_item_open_or_assigned_to(public.todo_items, uuid) from public;
revoke all on function public.remove_user_from_todo_assignees(uuid, uuid) from public;
