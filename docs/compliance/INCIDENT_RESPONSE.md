# Incident response (engineering)

**Status:** DRAFT — REQUIRES BUSINESS DECISION for on-call roster  
**As of:** 17 August 2026  
This is an engineering runbook, not a legal playbook. Personal-data incidents continue in [BREACH_RESPONSE.md](./BREACH_RESPONSE.md).

## Severity

| Sev | Example |
|---|---|
| 1 | Auth bypass, RLS failure exposing other users’ rows, leaked provider key in a client bundle |
| 2 | Rate-limit hole burning paid quota, push body leaking chat text, avatar bucket world-readable |
| 3 | Single-user sync corruption, degraded AI provider |

## Immediate steps

1. Freeze deploys (`eas update` / hosting) if the defect is in JS already shipped.
2. Rotate the exposed secret in EAS + the vendor console. Do not write the secret into the repo.
3. For a database policy hole: ship a migration that tightens RLS, `supabase db push`, then audit `content_reports` / chat / finance tables for cross-account reads.
4. Capture time range, project ref, and affected RPCs. Do not download production dumps onto personal laptops.
5. If personal data of another user may have been visible, switch to BREACH_RESPONSE.

## Contacts — REQUIRES BUSINESS DECISION

Fill: engineering owner, Supabase org owner, Apple/Google account holder, legal counsel.

## Evidence in repo

- Operational failures: `reportOperationalFailure` / crash-report email path.
- Support inbox: `ONTRACK_SUPPORT_EMAIL` from `EXPO_PUBLIC_SUPPORT_EMAIL` (`src/constants/legal.ts`).
