# Privacy data inventory

**Status:** DRAFT — REQUIRES LEGAL REVIEW  
**As of:** 17 August 2026

| Domain | Where it lives | Cloud sync | Backup default | Notes |
|---|---|---|---|---|
| Auth session | SecureStore | Supabase Auth | n/a | Apple / Google SSO |
| Profile name, goal, locations, theme, analytics flag, legal consent | Zustand + preferences domain | Yes (`sync-domains.ts`) | Included | Avatar meta is device-only in the preferences payload |
| Schedule, plants, travel, todos, finance, vehicles, vision board, add-ons | Zustand + `app_state` | Yes when signed in | Included | Collaboration copies follow share RPCs |
| Trip chat | `travel_chat_messages` | Yes | Not in local backup archive | Hidden from blocked senders |
| Friends / blocks / reports | `friends`, `user_blocks`, `content_reports` | Yes | Blocks/reports purged on delete | |
| Health summaries, mood, playbooks | Encrypted MMKV (`store/health.ts`) | **No** | **Excluded** unless “Include Health & Journal” | Apple Health is read-only on device |
| Journal pages / voice | Encrypted MMKV | **No** | **Excluded** unless opted in | Voice files are local |
| Food profile / allergies | Local + optional sync of non-health food stores | Food profile is local-first | Included (allergies are in food profile) | Ingredient badge no longer says “Safe” |
| Usage analytics | Local counters; optional cloud rollup | Only if toggle on and signed in | Preferences flag only | **Default off** for new installs |
| Push tokens | `travel_chat_devices` | Yes | Purged on delete | `show_previews` default false |
| Profile photos | `profile-avatars` bucket | Yes | Local avatar meta in backup | SELECT limited to owner/friend/trip-mate |
| Google Drive backup file | User’s Drive | User-controlled | User-created | Unencrypted JSON; Health/Journal opt-in |
| Data export | Share sheet JSON | No | n/a | Includes Health/Journal; unencrypted; user-initiated |

## Lawful-basis / notice

In-app Privacy Policy: `src/features/account/privacy-policy-content.ts`, route `/privacy`.  
Terms: `src/features/account/terms-of-use-content.ts`, route `/terms`.  
Consent stamp: `legalConsent` on preferences (version strings + `acceptedAt`) at first-run and sign-in.

**REQUIRES LEGAL REVIEW:** whether this notice + stamp is a valid consent / contract record in each launch country.

## Children

Terms require 13+. Auth fine print: “By continuing you confirm you are 13 or older.”  
No age-gate UI, no parental-consent flow, no COPPA design. See [REGIONAL_REQUIREMENTS.md](./REGIONAL_REQUIREMENTS.md).
