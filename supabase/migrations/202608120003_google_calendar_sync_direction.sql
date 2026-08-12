alter table public.google_calendar_connections
add column if not exists sync_direction text not null default 'two_way'
check (sync_direction in ('two_way', 'to_google', 'from_google'));
