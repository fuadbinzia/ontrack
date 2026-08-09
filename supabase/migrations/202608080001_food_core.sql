-- Food module core tables: profile, recipes (+ ingredients/steps), pantry,
-- meal plan, community posts. All user-owned rows are owner-only via RLS.
-- food_posts intentionally carries NO allergy/health columns — health data
-- never enters the community payload (privacy defaults live client-side).

create table if not exists public.food_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dietary_preferences text[] not null default '{}',
  -- [{ id, allergen, severity: mild|moderate|severe, notes? }]
  allergies jsonb not null default '[]'::jsonb,
  intolerances text[] not null default '{}',
  avoided_ingredients text[] not null default '{}',
  cuisine_likes text[] not null default '{}',
  cuisine_dislikes text[] not null default '{}',
  nutrition_priorities text[] not null default '{}',
  -- Health sharing is opt-in: every flag defaults to false.
  share_allergies boolean not null default false,
  share_dietary_preferences boolean not null default false,
  share_meals boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  summary text,
  image_url text check (image_url is null or image_url ~* '^https://'),
  image_path text,
  servings numeric not null default 1 check (servings > 0),
  prep_minutes integer check (prep_minutes >= 0),
  cook_minutes integer check (cook_minutes >= 0),
  total_minutes integer check (total_minutes >= 0),
  nutrition jsonb,
  dietary_tags text[] not null default '{}',
  allergen_tags text[] not null default '{}',
  cuisine text,
  source jsonb,
  author_id uuid references auth.users(id) on delete set null,
  is_favorite boolean not null default false,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_recipes_owner_idx on public.food_recipes (owner_id);

create table if not exists public.food_recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.food_recipes(id) on delete cascade,
  name text not null,
  canonical_key text,
  quantity_value numeric,
  quantity_text text,
  unit text,
  preparation text,
  optional boolean not null default false,
  substitutes text[] not null default '{}',
  sort_order integer not null default 0
);

create index if not exists food_recipe_ingredients_recipe_idx
  on public.food_recipe_ingredients (recipe_id);

create table if not exists public.food_recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.food_recipes(id) on delete cascade,
  step_index integer not null check (step_index >= 0),
  instruction text not null,
  duration_minutes integer check (duration_minutes >= 0),
  image_path text,
  unique (recipe_id, step_index)
);

create index if not exists food_recipe_steps_recipe_idx
  on public.food_recipe_steps (recipe_id);

create table if not exists public.food_pantry_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  canonical_key text not null,
  display_label text not null,
  quantity_value numeric check (quantity_value >= 0),
  unit text,
  best_by_date date,
  source text not null default 'manual'
    check (source in ('manual', 'scan', 'receipt', 'recipe')),
  added_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_pantry_items_owner_idx
  on public.food_pantry_items (owner_id);

create table if not exists public.food_meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  meal_type text not null check (
    meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'pre-workout', 'post-workout')
  ),
  recipe_id uuid references public.food_recipes(id) on delete set null,
  freeform_title text,
  servings numeric not null default 1 check (servings > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_meal_plan_entries_owner_date_idx
  on public.food_meal_plan_entries (owner_id, plan_date);

create table if not exists public.food_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  caption text not null default '',
  media_paths text[] not null default '{}',
  recipe_id uuid references public.food_recipes(id) on delete set null,
  dietary_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists food_posts_created_idx
  on public.food_posts (created_at desc);

alter table public.food_profiles enable row level security;
alter table public.food_recipes enable row level security;
alter table public.food_recipe_ingredients enable row level security;
alter table public.food_recipe_steps enable row level security;
alter table public.food_pantry_items enable row level security;
alter table public.food_meal_plan_entries enable row level security;
alter table public.food_posts enable row level security;

create policy "own food profile" on public.food_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own food recipes" on public.food_recipes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own recipe ingredients" on public.food_recipe_ingredients
  for all using (
    exists (
      select 1 from public.food_recipes
      where id = recipe_id and owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.food_recipes
      where id = recipe_id and owner_id = auth.uid()
    )
  );

create policy "own recipe steps" on public.food_recipe_steps
  for all using (
    exists (
      select 1 from public.food_recipes
      where id = recipe_id and owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.food_recipes
      where id = recipe_id and owner_id = auth.uid()
    )
  );

create policy "own pantry items" on public.food_pantry_items
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own meal plan entries" on public.food_meal_plan_entries
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Community feed: any signed-in user can read; only the author can write.
create policy "food posts readable" on public.food_posts
  for select using (auth.uid() is not null);
create policy "authors create posts" on public.food_posts
  for insert with check (author_id = auth.uid());
create policy "authors update posts" on public.food_posts
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "authors delete posts" on public.food_posts
  for delete using (author_id = auth.uid());

create or replace function public.set_food_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists food_profiles_updated_at on public.food_profiles;
create trigger food_profiles_updated_at
before update on public.food_profiles
for each row execute function public.set_food_updated_at();

drop trigger if exists food_recipes_updated_at on public.food_recipes;
create trigger food_recipes_updated_at
before update on public.food_recipes
for each row execute function public.set_food_updated_at();

drop trigger if exists food_pantry_items_updated_at on public.food_pantry_items;
create trigger food_pantry_items_updated_at
before update on public.food_pantry_items
for each row execute function public.set_food_updated_at();

drop trigger if exists food_meal_plan_entries_updated_at on public.food_meal_plan_entries;
create trigger food_meal_plan_entries_updated_at
before update on public.food_meal_plan_entries
for each row execute function public.set_food_updated_at();

drop trigger if exists food_posts_updated_at on public.food_posts;
create trigger food_posts_updated_at
before update on public.food_posts
for each row execute function public.set_food_updated_at();
