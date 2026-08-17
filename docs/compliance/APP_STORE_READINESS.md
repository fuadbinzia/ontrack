# App Store readiness

**Status:** DRAFT — REQUIRES LEGAL REVIEW + REQUIRES EXTERNAL CONFIGURATION  
**As of:** 17 August 2026  
Bundle id: `com.imtihoss.ontracknow` (`app.json`).

## Guideline mapping (engineering evidence only)

| Topic | Status | Evidence |
|---|---|---|
| 1.2 User-generated content | FIXED in code / PARTIALLY IMPLEMENTED in ops | Block, report, filter, terms zero-tolerance. Operator SLA open. |
| 2.1 / 2.3 Accurate metadata | REQUIRES MANUAL TESTING | Screenshots and review notes must match current Travel / Health / Finance. |
| 4.8 Sign in with Apple | TECHNICALLY VERIFIED | `auth-screen.tsx` Apple + Google |
| 5.1.1 Data collection | PARTIALLY IMPLEMENTED | Privacy Policy + permission strings updated. App Store Connect privacy answers not in repo. |
| 5.1.2 Permission strings | FIXED (OTA-staged) | Camera/photos list E-ZPass, confirmations, tax docs, avatars. Motion string is specific. **Needs next native binary.** |
| Kids category / 1.3 | NOT APPLICABLE | 13+ terms; not a kids app |
| 3.1 IAP | NOT APPLICABLE | No StoreKit / IAP packages |
| ATT / 5.1.2(i) | NOT APPLICABLE | No `NSUserTrackingUsageDescription`, no ad SDK |
| HealthKit | TECHNICALLY VERIFIED | Read summaries; not diagnosis |

## Reviewer Q&A (draft — not a submission)

**Demo account:** use an `agent_N` / reviewer account provisioned outside source. Never commit personal emails (`no-personal-identifiers.mdc`).

**How do I delete?** Profile → Delete Account, or https://ontrack.expo.app/delete-account

**How do I block/report chat?** Open a trip chat message → Report or Block. Profile → Blocked Users.

**Does chat show on the lock screen?** Default: “Trip Chat” / generic new-message text. Opt-in: Chat settings → Show Message Previews.

**Health data?** On-device Apple Health summaries + mood tools. Not cloud-synced. Privacy Policy from the Health screen.

## Privacy nutrition labels — REQUIRES EXTERNAL CONFIGURATION

Map App Store Connect answers from [PRIVACY_DATA_INVENTORY.md](./PRIVACY_DATA_INVENTORY.md). Do not mark Health/Journal as “synced to our servers.” Contact Info is collected at Apple/Google sign-in (email via the IdP). Product Interaction is collected only if Usage Analytics is on.

## Residuals

- Permission string changes (Info.plist + `expo-image-picker` plugin) do not apply until a new native binary.
- Operator review of `content_reports` is still a business gap.
