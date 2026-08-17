# onTrack compliance documentation

**Status:** DRAFT — REQUIRES LEGAL REVIEW  
**As of:** 17 August 2026  
**These files do not claim legal compliance.** They record what the code and configuration actually do, with file-path evidence.

Use these statuses only:

| Status | Meaning |
|---|---|
| TECHNICALLY VERIFIED | Inspected in source / config; behavior matches the claim |
| FIXED | Gap found in the 2026-08-17 audit and closed in code |
| PARTIALLY IMPLEMENTED | Some of the control exists; residuals listed |
| NOT APPLICABLE | Product does not do this (with evidence) |
| REQUIRES LEGAL REVIEW | Attorney must decide wording / applicability |
| REQUIRES BUSINESS DECISION | Product / ops choice still open |
| REQUIRES EXTERNAL CONFIGURATION | Console, vendor, or infra setting outside this repo |
| REQUIRES MANUAL TESTING | Needs a human / device / store-console pass |
| BLOCKED | Cannot complete without an external dependency |
| UNKNOWN — INSUFFICIENT EVIDENCE | Not enough in-repo proof |

| File | Topic |
|---|---|
| [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) | Auth, RLS, API, secrets |
| [PRIVACY_DATA_INVENTORY.md](./PRIVACY_DATA_INVENTORY.md) | What is stored where |
| [COMPLIANCE_AUDIT.md](./COMPLIANCE_AUDIT.md) | Cross-cutting scored snapshot |
| [APP_STORE_READINESS.md](./APP_STORE_READINESS.md) | Apple reviewer Q&A + privacy mapping |
| [GOOGLE_PLAY_READINESS.md](./GOOGLE_PLAY_READINESS.md) | Play Data Safety + web deletion |
| [ACCESSIBILITY_AUDIT.md](./ACCESSIBILITY_AUDIT.md) | VoiceOver / Dynamic Type / roles |
| [AI_GOVERNANCE.md](./AI_GOVERNANCE.md) | Model calls, logging, safety ids |
| [HEALTH_DATA_GOVERNANCE.md](./HEALTH_DATA_GOVERNANCE.md) | Health / journal / HIPAA note |
| [DATA_PROCESSORS.md](./DATA_PROCESSORS.md) | Third-party processors |
| [DATA_RETENTION_POLICY.md](./DATA_RETENTION_POLICY.md) | What is kept and deleted |
| [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) | Engineering incident steps |
| [BREACH_RESPONSE.md](./BREACH_RESPONSE.md) | Suspected personal-data incident |
| [UGC_MODERATION_POLICY.md](./UGC_MODERATION_POLICY.md) | Block / report / filters |
| [REGIONAL_REQUIREMENTS.md](./REGIONAL_REQUIREMENTS.md) | Age, GDPR, US state, AI Act |
| [LEGAL_REVIEW_REQUIRED.md](./LEGAL_REVIEW_REQUIRED.md) | Attorney queue |
| [RELEASE_COMPLIANCE_CHECKLIST.md](./RELEASE_COMPLIANCE_CHECKLIST.md) | Ship-time gates |
