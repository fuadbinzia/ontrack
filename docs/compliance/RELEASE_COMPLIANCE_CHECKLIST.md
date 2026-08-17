# Release compliance checklist

**Status:** DRAFT — engineering gates only  
**As of:** 17 August 2026

Use before `npm run ship:push` when the change touches privacy, auth, UGC, health, or store metadata.

## In-repo (do these)

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test` (or focused + contract tests for the touched area)
- [ ] New interactive controls have `ontrack.*` testIDs + map + flow if it is a new journey
- [ ] Glass / Title Case / no personal identifiers
- [ ] New Supabase migration applied (`supabase db push`)
- [ ] Privacy/Terms dates updated if user-facing legal meaning changed
- [ ] No secrets in the diff (`sk-`, `service_role`, private keys)

## External (do not claim from git)

- [ ] App Store Connect privacy answers match [PRIVACY_DATA_INVENTORY.md](./PRIVACY_DATA_INVENTORY.md)
- [ ] Play Data Safety + deletion URL `https://ontrack.expo.app/delete-account`
- [ ] EAS env: `ALLOW_UNAUTHENTICATED_API` unset in production
- [ ] Supabase PITR on
- [ ] Someone is reading `content_reports`
- [ ] Native binary queued if `app.json` permission strings or Android permissions changed
- [ ] Counsel signed off items on [LEGAL_REVIEW_REQUIRED.md](./LEGAL_REVIEW_REQUIRED.md) for that storefront / country
