create table if not exists public.plaid_link_sessions (
  link_token_hash text primary key,
  user_id uuid not null references auth.users on delete cascade,
  purpose text not null check (purpose in ('transactions', 'investments')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.plaid_items (
  user_id uuid not null references auth.users on delete cascade,
  item_id text not null,
  access_token_ciphertext text not null,
  purpose text not null check (purpose in ('transactions', 'investments')),
  institution_id text,
  institution_name text,
  transactions_cursor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id),
  unique (item_id)
);

alter table public.plaid_link_sessions enable row level security;
alter table public.plaid_items enable row level security;

-- Plaid credentials and Link ownership records are server-only. App clients
-- reach them exclusively through authenticated API routes.
revoke all on public.plaid_link_sessions from anon, authenticated;
revoke all on public.plaid_items from anon, authenticated;

create index if not exists plaid_link_sessions_user_idx
on public.plaid_link_sessions (user_id, expires_at);

