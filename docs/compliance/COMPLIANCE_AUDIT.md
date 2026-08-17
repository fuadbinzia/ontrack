# Compliance audit snapshot

**Status:** DRAFT — REQUIRES LEGAL REVIEW  
**As of:** 17 August 2026  
Scores are **engineering readiness**, not legal grades.

| Domain | Score /10 | Notes |
|---|---|---|
| Auth & session | 8 | SecureStore, PKCE, SIWA. Guest mode is local-only. |
| Database / RLS | 8 | RPC-gated collab; avatar SELECT tightened; purge covers ezpass + moderation. PITR unknown. |
| API / secrets | 7 | JWT + buckets; unauth flag blocked in prod; limits are in-process only. |
| Privacy lifecycle | 7 | In-app delete, export, consent stamp, analytics default off. No DPO / DSR inbox SLA. |
| Health / journal | 8 | Encrypted local, no sync, backup opt-in, honest allergy label. HIPAA unknown. |
| UGC safety | 6 | Block/report/filter shipped; no staffed moderation SLA. |
| AI governance | 6 | Server keys, hashed safety id, `store:false` on shared helper. Act class unknown. |
| Accessibility | 7 | Dynamic Type raised, switch role, ring name. Needs device pass. |
| App Store | 6 | 1.2 controls in app; Connect forms + native permission binary still external. |
| Play | 6 | Web deletion page exists; Data Safety form external; fine-location plugin residual. |
| Children / age | 5 | 13+ text only. No gate. Regional ages unresolved. |
| Payments | n/a | No IAP / Stripe in source. |

## P0 residuals after this hardening

- Operator review loop for `content_reports` (business).
- Distributed API rate limit (infra).
- Native binary for permission / location manifest changes.
- Legal review of terms, age, health, AI, and store forms.
- Trip-chat device IDOR (preview flip / push hijack) closed in `202608170002_travel_chat_device_ownership.sql`.

## P1 residuals

- `expo-location` may re-add `ACCESS_FINE_LOCATION` at prebuild.
- Drive leftovers after delete.
- Chat denylist is not a classifier.
- Consent record is a version stamp, not a purpose-by-purpose log.

## Verify pass (17 August 2026)

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:code` | Pass |
| `npm test` | 3819 passed; 1 fail = `token-budget` on uncommitted `travel-map-screen.tsx` WIP (out of this change) |
| `supabase db push` | Applied `202608170001_moderation_privacy_hardening.sql` |
| Secret scan (`sk-live` / PEM / service_role JWT) | No secrets in source |
| `npm audit --omit=dev` | 27 transitive (uuid / Expo config-plugins). `npm audit fix --force` would downgrade Expo — not applied |

Adversarial re-audit (attacker / privacy / store): original P0s are closed in code. Remaining store-blocking items are native binary, Play/App Store console forms, live `/delete-account` on the hosting alias, and a staffed `content_reports` queue. `expo-image-picker` permission copy was aligned with Info.plist in this pass.

## Explicitly out of code scope

Distributed rate-limit store, Supabase PITR, store-console forms, vendor DPA/BAA verification, attorney review, DMCA agent, EU AI Act filing.
