# Security audit

**Status:** DRAFT — REQUIRES LEGAL REVIEW  
**As of:** 17 August 2026  
Does not certify that the product is “secure” or “compliant.”

## TECHNICALLY VERIFIED

- Every public Supabase table reviewed in `supabase/migrations/` uses RLS. Collaboration is RPC-gated (`send_travel_chat_message`, checklist share RPCs, vehicle/E-ZPass share).
- Auth sessions persist in Expo SecureStore (`src/services/cloud/supabase.ts` + auth provider). OAuth uses PKCE.
- AI provider keys stay server-side. Client routes go through `src/app/api/**` + `src/app/**/+api.ts` and `authenticateApiRequest` / `gatePaidApiRequest` (`src/services/http/api-auth.ts`, `api-gate.ts`).
- `ALLOW_UNAUTHENTICATED_API=true` is ignored when `EXPO_PUBLIC_APP_ENV` / EAS profile is `production`, `preview`, `testflight`, or `device` (`isUnauthenticatedApiAllowed`).
- Account deletion calls `purge_user_data` then removes the auth user (`src/services/cloud/account.ts`). The 2026-08-17 migration also deletes `ezpass_*`, `user_blocks`, `content_reports`, Teller vault rows, and Drive connection rows.
- Profile avatars are no longer readable by every authenticated user. SELECT uses `can_read_profile_avatar` (owner / friend / trip-mate) in `supabase/migrations/202608170001_moderation_privacy_hardening.sql`.
- OpenAI `safety_identifier` is an HMAC-style SHA-256 prefix, not the raw `userId` (`src/services/ai/openai-safety-id.ts`).

## FIXED (2026-08-17)

- Public quota-burn routes (`/api/destination-cover*`, `/api/stay-brand`, `/api/vehicles/vin-decode`) now go through `gatePublicApiRequest` (60/hour `public` bucket).
- `/api/usage` requires a verified JWT.
- Chat push no longer puts the message body on the lock screen unless the device opted into previews.
- `travel_chat_devices` rows are bound to `auth.uid()`. Preview preference and push-token register reject another member’s `device_id`. Message load hides peer `sender_device_id` (`202608170002_travel_chat_device_ownership.sql`).

## PARTIALLY IMPLEMENTED

- Rate limits are **in-process memory** (`src/services/http/api-rate-limit.ts`). EAS Hosting is multi-instance, so global caps are not coordinated. **REQUIRES EXTERNAL CONFIGURATION** (Redis / Upstash or equivalent) for a distributed store.
- Chat content filter is a first-line denylist (`travel_chat_body_is_blocked`), not a classifier.

## REQUIRES EXTERNAL CONFIGURATION

- Supabase PITR / backup retention in the project dashboard — not verifiable from this repo.
- EAS secret inventory (OpenAI, Plaid, Teller, Resend, OAuth) — confirm no leftover personal inboxes or stale keys.
- Production `ALLOW_UNAUTHENTICATED_API` must stay unset.

## Residuals

- Drive backups the user already uploaded remain in that user’s Drive after disconnect or account delete.
- No WAF / bot score in-repo. Hosting platform defaults apply — UNKNOWN — INSUFFICIENT EVIDENCE.
