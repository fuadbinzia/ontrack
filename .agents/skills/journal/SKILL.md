---
name: journal
description: >-
  onTrack Journal add-on: dated private pages, typed blocks, dictate-to-text,
  local voice notes, and chips that open other sections. Use when editing
  src/features/journal/, src/store/journal.ts, or the Journal routes.
---

# Journal (onTrack)

## Start here

| Surface | Entry |
|---------|-------|
| Journal hub (today) | `src/features/journal/journal-hub.tsx` |
| Dated page | `src/features/journal/journal-page-screen.tsx` |
| Sensitive store | `src/store/journal.ts` |
| Dictate API | `src/services/journal/transcribe-server.ts` |

## Non-negotiables

- One page per `YYYY-MM-DD`. No cloud sync domain — `createSensitivePersistStorage` only.
- Voice notes stay in `Documents/journal-voice/`. Never persist recorder cache URIs.
- Dictate sends audio to onTrack AI only after first-use disclosure; then discard the take.
- Do not call `/travel/translator` or reuse `ontrack-voice-lists`.
- Stamp `ontrack.journal.*` on every interactive control.
- Composer is a full-width docked field above the tab bar with send in the pill; header is `Journal` + date with only prev/next on that line’s far right (`titleTrailing`); eyebrow is Undo, Redo, Edit, plus. Undo/redo text-block edits for the open day. Next is disabled on today.
- Trash shows only in Edit mode. Tap the text inside a block to edit — not the whole card. Text sits vertically centered in the row.
- Every block stamps `createdAt` / `updatedAt`; cards show those as a caption (Created, plus Updated when they differ). Earlier Pages is a grouped index under today — written days only, clock on the row, no Created pills.
- Prefer `./scripts/agent-ui.sh once --flow journal-demo` over hand-built pages.
