create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users on delete cascade,
  google_email text,
  refresh_token_ciphertext text not null,
  calendar_id text not null default 'primary',
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz
);

create table if not exists public.google_calendar_event_links (
  user_id uuid not null references auth.users on delete cascade,
  calendar_id text not null,
  google_event_id text not null,
  activity_id text not null,
  origin text not null check (origin in ('google', 'ontrack')),
  google_updated_at timestamptz,
  local_updated_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, calendar_id, google_event_id),
  unique (user_id, activity_id)
);

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_event_links enable row level security;

-- OAuth credentials and provider mappings are server-only. The authenticated
-- app uses the calendar API routes, which verify its Supabase access token.
revoke all on public.google_calendar_connections from anon, authenticated;
revoke all on public.google_calendar_event_links from anon, authenticated;

create index if not exists google_calendar_event_links_user_activity_idx
on public.google_calendar_event_links (user_id, activity_id);
