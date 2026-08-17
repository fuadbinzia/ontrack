# Google Play readiness

**Status:** DRAFT — REQUIRES LEGAL REVIEW + REQUIRES EXTERNAL CONFIGURATION  
**As of:** 17 August 2026  
Application id: `com.imtihoss.ontracknow`.

## Data Safety form (engineering mapping)

| Play category | Collected? | Shared with third parties? | Evidence |
|---|---|---|---|
| Name | Yes (profile) | No ad networks | Preferences / SSO display name |
| Email | Yes (SSO) | Auth vendor (Apple/Google/Supabase) | Supabase Auth |
| Photos | Yes, user-picked | OpenAI when user runs meal/OCR/vision | EXIF stripped on AI path |
| Health | On-device; not uploaded for sync | No | Encrypted MMKV |
| Financial info | Yes if user links Plaid/Teller or enters ledgers | Plaid/Teller as processors | Finance services |
| Location | Approximate (coarse) | Weather / geocoding hosts | `ACCESS_COARSE_LOCATION` only in `app.json` (plugin may still add FINE until next binary audit) |
| Messages | Trip chat | Push provider if previews on | Default generic push |
| App activity | Optional usage analytics | First-party only when enabled | Default off |

**REQUIRES EXTERNAL CONFIGURATION:** paste this mapping into Play Console. This file is not the submitted form.

## Account deletion (Play policy)

- In-app: Profile → Delete Account — TECHNICALLY VERIFIED
- Web: `/delete-account` (`src/app/delete-account.tsx`) on `https://ontrack.expo.app/delete-account` — FIXED
- Declare that URL in Play Console — REQUIRES EXTERNAL CONFIGURATION

## Permissions

- Fine location removed from the explicit Android permission list. `expo-location` may still merge `ACCESS_FINE_LOCATION` at prebuild. **REQUIRES MANUAL TESTING** of the next APK’s merged manifest.
- Camera / photos / motion copy updated in `app.json` (native binary required).

## Residuals

- No Play Data Safety form is stored in git (correct).
- Data Safety “encrypted in transit” is TLS via platform + Supabase — TECHNICALLY VERIFIED for those hops; not a full encryption-at-rest audit of every vendor.
