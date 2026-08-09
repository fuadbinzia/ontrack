-- Agent test accounts (agent_1…agent_4): dedicated per-device accounts so agent
-- verification never touches a real account's data.
--
-- The flag is the server-side gate: the app's dev-only agent sign-in refuses any
-- account whose agent_test is false, so a real account can never be driven by an
-- agent even if its credentials were configured by mistake.
--
-- Grants are service-role only (by user_id) — never an email allowlist here.

alter table public.account_flags
  add column if not exists agent_test boolean not null default false;

comment on column public.account_flags.agent_test is
  'Synthetic agent verification account (agent_1…agent_4). Dev builds only; never a real user.';

-- Agent accounts are for automation, not privileged product surfaces: keep the
-- analytics admin grant and the agent flag mutually exclusive.
alter table public.account_flags
  drop constraint if exists account_flags_agent_test_not_admin;
alter table public.account_flags
  add constraint account_flags_agent_test_not_admin
  check (not (agent_test and analytics_admin));

-- Read-only for the account itself (existing "users read own account_flags"
-- policy already covers the new column); clients still cannot self-grant.
