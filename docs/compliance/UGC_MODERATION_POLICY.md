# UGC moderation policy

**Status:** DRAFT — REQUIRES LEGAL REVIEW  
**As of:** 17 August 2026

Live user-generated surfaces: trip chat, friend graph, shared lists / trips / vehicles, food community posts (session fixture + report hook).

## FIXED (Apple 1.2 controls)

| Control | Evidence |
|---|---|
| Block | RPC `block_user` / `unblock_user` / `list_blocked_users`; UI in chat message menu, Social friend row, Profile → Blocked Users |
| Report | RPC `report_content` (20/hour); reasons in `src/features/account/report-content.ts`; chat, friends, food `ReportContentSheet` |
| Filter | `travel_chat_body_is_blocked` denylist on send; blocked senders hidden in `travel_chat_messages` policy |
| Terms | Zero-tolerance paragraph in `terms-of-use-content.ts` (harassment, CSAM, threats, scams, doxxing) |

Client service: `src/services/moderation/index.ts`.

## What this is not

- Not 24/7 human moderation. Reports land in `content_reports` for operators to read in Supabase.
- Not a complete language/image classifier.
- Food community remains largely fixture/session-local; reports persist when signed in.

## Operator loop — REQUIRES BUSINESS DECISION

1. Who reviews `content_reports`?
2. SLA for hiding content / banning accounts?
3. Appeal path?

Until those are staffed, App Store 1.2 is **PARTIALLY IMPLEMENTED** from an operations standpoint even though the in-app buttons exist.

## CSAM / NCMEC

No on-device CSAM scanner. **REQUIRES LEGAL REVIEW** for reporting duties if the product is offered in the US at scale.
