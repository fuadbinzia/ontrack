-- Ingredient knowledge reference data (shared, curated).
-- Authenticated users read; writes are service-role / admin only so the app
-- can never author regulatory claims. Every jurisdiction row must carry a
-- source_url and last_reviewed_at — an unsourced claim is unrepresentable.

create table if not exists public.ingredient_knowledge (
  canonical_key text primary key check (length(btrim(canonical_key)) between 1 and 200),
  name text not null,
  aliases text[] not null default '{}',
  functional_purpose text,
  concerns text[] not null default '{}',
  allergen_tags text[] not null default '{}',
  -- { "<dietary-preference>": "compatible" | "incompatible" | "depends" }
  dietary_compatibility jsonb not null default '{}'::jsonb,
  alternatives text[] not null default '{}',
  last_reviewed_at timestamptz not null,
  -- [{ title, url, accessedAt? }]
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingredient_jurisdiction_status (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null
    references public.ingredient_knowledge(canonical_key) on delete cascade,
  country_code text not null check (length(btrim(country_code)) between 2 and 3),
  country_name text not null,
  status text not null check (
    status in ('allowed', 'restricted', 'not-approved-for-use', 'banned')
  ),
  reason text,
  source_url text not null check (source_url ~* '^https://'),
  last_reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canonical_key, country_code)
);

create index if not exists ingredient_jurisdiction_status_key_idx
  on public.ingredient_jurisdiction_status (canonical_key);

alter table public.ingredient_knowledge enable row level security;
alter table public.ingredient_jurisdiction_status enable row level security;

-- Reference data is read-only for the app; belt-and-suspenders revoke so a
-- future permissive policy cannot silently open writes to clients.
revoke insert, update, delete on public.ingredient_knowledge from anon, authenticated;
revoke insert, update, delete on public.ingredient_jurisdiction_status from anon, authenticated;

create policy "ingredient knowledge readable" on public.ingredient_knowledge
  for select using (auth.uid() is not null);

create policy "jurisdiction status readable" on public.ingredient_jurisdiction_status
  for select using (auth.uid() is not null);

-- Curated writes: verified admins only (service role bypasses RLS).
create policy "admins manage ingredient knowledge" on public.ingredient_knowledge
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admins manage jurisdiction status" on public.ingredient_jurisdiction_status
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists ingredient_knowledge_updated_at on public.ingredient_knowledge;
create trigger ingredient_knowledge_updated_at
before update on public.ingredient_knowledge
for each row execute function public.set_food_updated_at();

drop trigger if exists ingredient_jurisdiction_status_updated_at
  on public.ingredient_jurisdiction_status;
create trigger ingredient_jurisdiction_status_updated_at
before update on public.ingredient_jurisdiction_status
for each row execute function public.set_food_updated_at();
