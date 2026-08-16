create table if not exists public.google_drive_connections (
  user_id uuid primary key references auth.users on delete cascade,
  google_email text,
  refresh_token_ciphertext text not null,
  folder_id text,
  connected_at timestamptz not null default now(),
  last_backup_at timestamptz
);

alter table public.google_drive_connections enable row level security;

-- OAuth credentials are server-only. The authenticated app uses the backup API
-- routes, which verify its Supabase access token.
revoke all on public.google_drive_connections from anon, authenticated;

comment on table public.google_drive_connections is
  'Encrypted Google Drive OAuth credentials for user-owned onTrack backups.';

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.purge_user_data(uuid)'::regprocedure) into definition;
  if position('delete from public.google_drive_connections' in definition) = 0 then
    definition := replace(
      definition,
      'delete from public.google_calendar_connections where user_id = target_user_id;',
      'delete from public.google_drive_connections where user_id = target_user_id;' || E'\n  ' ||
      'delete from public.google_calendar_connections where user_id = target_user_id;'
    );
    execute definition;
  end if;
end;
$$;
