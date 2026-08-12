-- Partner account links (StraiAway and future apps). Server-only; API routes
-- verify the caller's Supabase access token or a hashed partner refresh token.

create table if not exists public.partner_link_challenges (
  code_hash text primary key,
  user_id uuid not null references auth.users on delete cascade,
  code_challenge text not null,
  partner text not null check (partner in ('straiaway')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  pending_partner_user_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_links (
  user_id uuid not null references auth.users on delete cascade,
  partner text not null check (partner in ('straiaway')),
  partner_user_id text not null,
  partner_display_name text,
  scopes text[] not null default array['identity.link', 'stay.read', 'stay.write']::text[],
  inbound_token_hash text not null,
  outbound_token_ciphertext text not null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  primary key (user_id, partner)
);

create unique index if not exists partner_links_inbound_token_hash_idx
  on public.partner_links (inbound_token_hash);

create table if not exists public.partner_stay_packages (
  user_id uuid not null references auth.users on delete cascade,
  partner text not null check (partner in ('straiaway')),
  package_key text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, partner, package_key)
);

create index if not exists partner_link_challenges_user_idx
  on public.partner_link_challenges (user_id, partner);

alter table public.partner_link_challenges enable row level security;
alter table public.partner_links enable row level security;
alter table public.partner_stay_packages enable row level security;

revoke all on public.partner_link_challenges from anon, authenticated;
revoke all on public.partner_links from anon, authenticated;
revoke all on public.partner_stay_packages from anon, authenticated;
