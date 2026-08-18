---
name: health
description: >-
  onTrack Health add-on: device-only Apple Health summaries, mood check-ins,
  contributing factors, private action playbooks, follow-ups, and State of Mind.
  Use when editing src/features/health/, src/store/health.ts, the Health routes,
  or modules/ontrack-healthkit/.
---

# Health (onTrack)

## Start here

| Surface | Entry |
|---------|-------|
| Health tab | `src/features/health/health-screen.tsx` |
| Mood editors | `src/features/health/*-screen.tsx` |
| Sensitive store | `src/store/health.ts` |
| Apple bridge | `modules/ontrack-healthkit/` |
| AI actions | `src/services/health/action-suggestions.ts` |

Read [reference.md](reference.md) for models and native behavior.

## Non-negotiables

- Keep Health summaries, mood entries, notes, factors, and playbooks out of cloud sync.
- Persist with `createSensitivePersistStorage`; never fall back to unencrypted native storage.
- Call the user-facing service **Apple Health**, not HealthKit.
- Read permissions are privacy-obscured: never claim a particular read type was denied.
- State of Mind requires iOS 18+; local Mind tools remain available without it.
- Never send notes, Apple Health data, history, or identifiers to mood-suggestion AI.
- Suggestions are optional and editable, and must not diagnose, prescribe, or promise an outcome.
- Add `ontrack.health.*` testIDs to every interactive control.
- Prefer `./scripts/agent-ui.sh once --flow health-demo` / `health-demo-mood` (stable `factor-agent-ui-demo-work` / `mood-agent-ui-demo-calm`) over hand-building Mind data.
