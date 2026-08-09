# Guest account data

| | |
|---|---|
| **Status** | Accepted |
| **Last updated** | 2026-08-09 |
| **Audience** | Product + engineering |

## Summary

When someone uses onTrack as a **guest** and then creates or signs into an account, local plans must not silently wipe or replace cloud data. The app asks how to combine or discard device data. For an **existing** account, **cloud stays the source of truth**: merge adds device-only entities into the cloud graph, or the user discards device data and restores cloud. For a **new** (empty) account, the user keeps guest data (upload) or starts fresh.

## Scenarios

1. **Friend used my phone as guest** — Owner signs into their existing account. Device has guest trips/lists. Prompt: **merge** (keep cloud + add device-only items) or **use cloud only** (drop guest data). Never replace the whole cloud dataset with the guest phone.
2. **I used guest, then created my account** — Cloud has no `app_state` rows yet. Prompt: **keep device data** (upload) or **start fresh** (wipe synced local domains, empty account).
3. **Returning signed-in user, no dirty guest upgrade** — No chooser. Empty cloud → upload; else restore cloud.

## Decision table

Triggered only when this sign-in is a **guest upgrade** with dirty guest data (`authUpgradePending` + `guestEnabled` + `guestDataDirty`) and meaningful local data.

| Cloud `app_state` | Chooser | Primary | Secondary | Tertiary |
|---|---|---|---|---|
| Empty (new account) | New account | Keep device data → upload | Start fresh → reset synced local domains | Cancel → sign out, keep guest |
| Has rows (existing) | Existing account | Merge with cloud | Use cloud only (discard device) | Cancel → sign out, keep guest |

Outside a dirty guest upgrade: empty cloud → silent upload; otherwise restore cloud.

## Merge rules (existing account)

1. Apply cloud payloads as the base (`applyRemote`).
2. Snapshot local domain JSON **before** apply.
3. For entity arrays / maps, append **device-only** entries whose `id` (or map key) is **absent** from cloud.
4. On id clash, **cloud wins** (device copy is dropped).
5. Push the merged graph so cloud remains SoT including newly joined device-only entities.
6. Preferences / addons: cloud wins synced scalars; device-only preference fields (e.g. home location / avatar not in `app_state`) keep today’s preserve behavior.

**Domains in merge union:** schedule (activities, meals, workouts, …), plants, travel plans, private todos (lists / tasks / recipes), vision board categories/items, private vehicles, agent installations/conversations (device-only keys).

**Out of scope for merge until synced:** Food module guest stores (not `app_state` domains yet).

## What we never do

- Silently upload device data over an existing cloud account.
- Offer “replace entire cloud with this device” for existing accounts.
- Treat cancel as deleting guest data (cancel signs out and leaves guest data on device).

## Key code

| Concern | Location |
|---|---|
| Ownership decision | `src/services/cloud/data-ownership.ts` — `decideAccountData` |
| First sync / resolve | `src/services/cloud/sync.ts` — `prepareAccountSync`, `resolveAccountSync`, merge helper |
| Guest dirty + upgrade gate | `src/features/auth/auth-provider.tsx` — `canConflict`; `auth-guest-dirty.ts` |
| Chooser UI | `src/app/auth/data-choice.tsx` (`/auth/data-choice`, phase `resolving-data`) |
| Choice type | `src/features/auth/auth-context.ts` — `DataResolution` |

## Related

- [AUTH_SETUP.md](../AUTH_SETUP.md) — SSO providers and env
- [ADDONS.md](../ADDONS.md) — sync domain registration pattern
