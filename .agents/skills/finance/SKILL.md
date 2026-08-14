---
name: finance
description: >-
  onTrack Finance add-on: spending ledger, bills/subscriptions, savings buckets,
  businesses/properties, investments/401k, credit-score tracking, tax prep export,
  money coach, and File-elsewhere handoff.
  Use when editing src/features/finance/, src/store/finance.ts, finance routes,
  or src/services/finance/.
---

# Finance (onTrack)

## Start here

| Surface | Entry |
|---------|--------|
| Hub | `src/features/finance/finance-screen.tsx` → `/(tabs)/finance` |
| Expense form | `finance-expense-screen.tsx` |
| Bills / subs | `finance-bills-screen.tsx` |
| Buckets | `finance-buckets-screen.tsx` |
| Entities | `finance-entities-screen.tsx` |
| Accounts / providers | `finance-accounts-screen.tsx` + `services/finance/teller.ts` / `plaid.ts` |
| Credit score | `finance-credit-sheet.tsx` + hub card (manual + provider links) |
| Tax prep / handoff | `finance-tax-screen.tsx` + `tax-handoff.ts` |
| Store | `src/store/finance.ts` |
| Create helpers | `create.ts` (re-exported from the store for entity/transaction) |
| Categories / tax buckets | `categories.ts` |

## Non-negotiables

- Product chrome is glass (`Card` / `GlassPlate` defaults) — no paper fills.
- Tax: prep + export + **File elsewhere** chooser only — never scrape IRS / claim in-app e-file.
- Teller: bank/card balances + transactions through signed Connect sessions and the Cloudflare mTLS gateway; access tokens stay in the encrypted server vault.
- Plaid: investments only through Hosted Link; access tokens stay in the encrypted server vault.
- Credit score: manual track + official HTTPS deep links only — never scrape Credit Karma/Chase.
- Money coach: local rate-aware heuristics + optional AI polish (`/api/finance/coach`).
- Tips are educational, not personalized financial advice.
- Stamp `ontrack.finance.*` testIDs on interactive controls.
- Prefer `./scripts/agent-ui.sh once --flow finance` over dumps.
