# Regional requirements

**Status:** DRAFT — REQUIRES LEGAL REVIEW + REQUIRES BUSINESS DECISION  
**As of:** 17 August 2026

## AGE_POLICY

| Region | Typical digital-consent age (not legal advice) | In product today |
|---|---|---|
| United States (COPPA) | 13 | Terms + auth fine print say 13+. No age collection UI. |
| GDPR / most EU | 16 unless member state lowers to 13 | Same 13+ clause — **may be insufficient** |
| UK | 13 | Same clause |
| South Korea / others | Often 14+ with parental consent | **NOT IMPLEMENTED** |

**REQUIRES BUSINESS DECISION:** launch country list and whether to collect date of birth.  
**REQUIRES LEGAL REVIEW:** whether a checkbox / fine-print line is enough.

Code: `terms-of-use-content.ts` (Accounts and Guest Use), `auth-screen.tsx` (`ontrack.auth.ageConfirm`).

## GDPR / UK GDPR

| Control | Status |
|---|---|
| Privacy notice | TECHNICALLY VERIFIED (`/privacy`) |
| Access / portability | FIXED — Download My Data JSON |
| Erasure | TECHNICALLY VERIFIED in-app delete + `/delete-account` |
| Consent for analytics | FIXED — default off; toggle on Profile |
| Consent record | PARTIALLY IMPLEMENTED — version + timestamp, not a per-purpose log |
| DPO / EU representative | REQUIRES BUSINESS DECISION |
| SCCs / transfer map | REQUIRES LEGAL REVIEW (US vendors) |

## US state privacy (CCPA/CPRA and similar)

No “Do Not Sell” signal because there is no ad graph in source — TECHNICALLY VERIFIED absence of ad SDKs. “Sale/share” legal meaning is **REQUIRES LEGAL REVIEW**.

## EU AI Act

Classification of nutrition / mood / finance-coach features: **REQUIRES LEGAL REVIEW**. See [AI_GOVERNANCE.md](./AI_GOVERNANCE.md).

## Store country launch

Do not treat “ships on TestFlight” as worldwide legal clearance. Country enablement in App Store Connect / Play Console is **REQUIRES BUSINESS DECISION**.
