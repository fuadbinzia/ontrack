# Health data governance

**Status:** DRAFT — REQUIRES LEGAL REVIEW  
**As of:** 17 August 2026

## TECHNICALLY VERIFIED

- Health and journal stores use encrypted MMKV and are omitted from `domains` cloud sync (`src/store/health.ts`, `src/store/journal.ts`, `src/services/cloud/sync-domains.ts`).
- Apple Health is queried on-device through `src/services/health/apple-health.ts`. Summaries are not uploaded through onTrack cloud sync.
- Mood suggestion API hashes the safety identifier (`src/app/health/action-suggestions+api.ts` + `openai-safety-id.ts`). Prompts must not include raw note text as a durable vendor log — OpenAI calls use `store: false` where the shared vision/responses helper is used. **REQUIRES MANUAL TESTING** to confirm every health prompt path sets `store:false`.
- Backups omit health/journal unless the user enables “Include Health & Journal” and sees an unencrypted-file warning (`backup-archive.ts`, `backup-screen.tsx`).
- Download My Data includes health/journal because they exist only on device, and the screen warns the file is unencrypted (`download-data-screen.tsx`).
- Health hub links to the Privacy Policy (`health-screen.tsx`, `ontrack.health.privacy`).

## HIPAA applicability

**REQUIRES LEGAL / BUSINESS DETERMINATION.**

Evidence that onTrack is **not obviously** a covered entity in code:

- No treatment, payment, or health-care operations workflows.
- No clinic, insurer, or provider accounts.
- Copy on Health and Terms says the tools are not medical care (`terms-of-use-content.ts`, 988 card on `health-screen.tsx`).

That is **not** a HIPAA exemption. A covered-entity or BAA analysis is out of repo scope. Do not market the Health add-on as HIPAA compliant.

## Residuals

- Ingredient scanner language is “No Conflicts Found”, not “Safe” (`ingredient-safety-row.tsx`). Still not a medical clearance.
- Playbooks and mood notes never leave the device except via user export/backup opt-in — TECHNICALLY VERIFIED for sync; export is user-initiated.
