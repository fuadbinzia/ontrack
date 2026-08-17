# Health reference

## Data flow

- Apple Watch writes into Apple Health; onTrack never pairs directly with the Watch.
- `modules/ontrack-healthkit` returns 90 daily aggregate rows plus deduplicated workouts.
- The app refreshes on Health focus, foreground, and pull-to-refresh. No background delivery.
- `useHealth` stores encrypted device-only aggregates and Mind records under `ontrack/health/v1`.
- `services/cloud/sync.ts` must not register a `health` domain.

## Models

- `DailyHealthSummary`: steps, active energy, exercise, heart rate, resting heart rate, sleep.
- `MoodEntry`: mixed emotion/intensity ratings, factors, private note, optional Apple reference.
- `MoodFactor`: a reusable influence linked to feelings.
- `MoodPlaybook`: source feelings, desired feelings, ordered action steps.
- `MoodPlaybookRun`: completion and optional follow-up entry for non-causal outcome wording.

## State of Mind

- Gate all native APIs with `#available(iOS 18.0, *)`.
- Only Apple-supported labels and associations are written; custom values remain local.
- Attach `com.imtihoss.ontracknow.moodEntryId` metadata for deduplication.
- Delete from Apple Health only after verifying the sample was created by onTrack.

## Verification

- Simulator: unavailable/native-build fallback plus complete local Mind flow.
- Physical iPhone: permissions, partial access, 90-day metrics, State of Mind read/write/delete.
- Always run typecheck, focused Health tests, native iOS build, and simulator selector flow.
