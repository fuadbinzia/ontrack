create table if not exists public.teller_link_sessions (
  session_token_hash text primary key,
  user_id uuid not null references auth.users on delete cascade,
  nonce text not null,
  environment text not null check (environment in ('sandbox', 'development', 'production')),
  enrollment_id text,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.teller_enrollments (
  user_id uuid not null references auth.users on delete cascade,
  enrollment_id text not null,
  access_token_ciphertext text not null,
  institution_name text,
  environment text not null check (environment in ('sandbox', 'development', 'production')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, enrollment_id),
  unique (enrollment_id)
);

alter table public.teller_link_sessions enable row level security;
alter table public.teller_enrollments enable row level security;

revoke all on public.teller_link_sessions from anon, authenticated;
revoke all on public.teller_enrollments from anon, authenticated;

create index if not exists teller_link_sessions_user_idx
on public.teller_link_sessions (user_id, expires_at);

create or replace function public.complete_teller_link_session(
  p_session_token_hash text,
  p_enrollment_id text,
  p_access_token_ciphertext text,
  p_institution_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.teller_link_sessions%rowtype;
begin
  select * into session_row
  from public.teller_link_sessions
  where session_token_hash = p_session_token_hash
    and completed_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Teller session is missing, expired, or already used';
  end if;

  insert into public.teller_enrollments (
    user_id,
    enrollment_id,
    access_token_ciphertext,
    institution_name,
    environment,
    updated_at
  ) values (
    session_row.user_id,
    p_enrollment_id,
    p_access_token_ciphertext,
    nullif(p_institution_name, ''),
    session_row.environment,
    now()
  )
  on conflict (user_id, enrollment_id) do update set
    access_token_ciphertext = excluded.access_token_ciphertext,
    institution_name = excluded.institution_name,
    environment = excluded.environment,
    updated_at = now();

  update public.teller_link_sessions
  set enrollment_id = p_enrollment_id,
      completed_at = now()
  where session_token_hash = p_session_token_hash;
end;
$$;

revoke all on function public.complete_teller_link_session(text, text, text, text)
from public, anon, authenticated;
grant execute on function public.complete_teller_link_session(text, text, text, text)
to service_role;

-- Keep reset_own_data aligned with account deletion without duplicating the
-- complete audited purge function in every provider migration.
do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.purge_user_data(uuid)'::regprocedure) into definition;
  if position('delete from public.teller_enrollments' in definition) = 0 then
    definition := replace(
      definition,
      'delete from public.plaid_items where user_id = target_user_id;',
      'delete from public.teller_enrollments where user_id = target_user_id;' || E'\n  ' ||
      'delete from public.teller_link_sessions where user_id = target_user_id;' || E'\n  ' ||
      'delete from public.plaid_items where user_id = target_user_id;'
    );
    execute definition;
  end if;
end;
$$;
