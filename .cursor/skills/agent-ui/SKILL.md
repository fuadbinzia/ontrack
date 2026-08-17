---
name: agent-ui
description: >-
  onTrack simulator verification: testIDs, navigation decision tree, assert-first
  proof, dual iOS/Android close-out (headless by default), screenshot triage,
  stuck config, hang benchmark. Use before any app UI change, agent-ui script,
  screenshot bug, Metro/simulator handoff, or when the user complains about
  Simulator/emulator/verify hang or slowness.
---

# Agent UI & verify (onTrack)

Read this **before** exercising the simulator or shipping app UI. Full map: `docs/agent-ui-map.md`, routes: `docs/agent-routes.md`.

## Stamp testIDs (authoring)

When you create/edit an interactive control, same change:

1. Constant in `src/utils/agent-ui/ids.ts` → `ontrack.<feature>.<surface>.<control>`
2. **`AgentTestId` or `useAgentUiTarget`** (registry) — bare `testID=` on `Pressable`/`View` does **not** register for tap/dump/assert
3. Row in `docs/agent-ui-map.md`

Also stamp layout anchors (`AgentTestId` without `onPress`) on major sections: `ontrack.<feature>.<surface>.section.<name>`. Sheets: stamp `.close` / `.done` so land flows can `dismiss` them.

Missing id = defect. Never tap by screenshot coordinates.

Travel weather/currency: assert on **plan detail tools** (`travel-demo` / `travel-demo-hub` → `/travel/<id>`) via `travel.list.tripWeather.<id>` / `travel.list.currency.<id>` — not Travel Home and not unused `planDetail.weather` / `planDetail.currency`.

## Navigation decision tree (stop at first match)

0. **Stuck / hang complaint?** → read `docs/agent-ui-verify-benchmark.md` first (H1–H12), then config triage below (sticky `AGENT_UI_PLATFORM`, wrong width, Android on `/`, iOS system sheet).
1. **App up** — `once` / `verify` / `flow` / `assert` / `open` call `agent_ui_ensure_app_up` (also clears iOS Apple Account sheets). Android waits for `sys.boot_completed` + real route (`ok` + path) before tests — not bare `adb get-state`. Dead app → `./scripts/ensure-packager.sh --start` (+ `--android` for emu). Pin platform when both devices are up.
2. **User explicitly requested device testing in this task** → `./scripts/agent-ui-verify-both.sh --route <path> [--flow <name>] --exists …`; otherwise skip all device/simulator/emulator testing.
3. **Already on surface?** → `verify --route <path> …` (skip re-flow when route matches). Bare `--route` **auto-gotos** when you’re on another screen — do not grind assert-only retries or re-add `--open` just to land.
4. **Else named flow** → `once --flow <name>` / `agent-ui-flow.sh` (`--list` for names). Prefer seeds (`travel-demo`, …) when fixtures are required (flows are never skipped just because the route matches).
5. **Else open/batch** → `agent-ui-open.sh` / `agent-ui-batch.sh`
6. **Else known id** → `agent-ui-tap.sh` (JS paths: `travel.planDetail.transportSection`, factories: `travel.timelineItem.<id>.default`)
7. **Unknown id** → **one** `agent-ui-dump.sh --prefix ontrack.<feature>` — then **retire that dump** (below). Never dump twice for the same gap.
8. **Screenshot bug** → triage: `agent-ui-source.sh` / `--label` → `agent-ui-hit.sh` → `agent-ui-overlay.sh on` → edit resolved file. Never broad-grep `src/features/`.
9. **Proof** → assert / `--color` then **STOP**. Screenshot only for visual/layout claims (not icon orientation).

## Dump = debt (retire in the same turn)

A dump means the map/flows were incomplete. **Do not leave discovery debt.** After ≤1 dump:

1. Identify what you needed (control, section, sheet, dynamic row, land path).
2. **Same change**, pick the lasting fix (smallest that makes the next run dump-free):
   - Missing control/section → stamp `ontrack.*` + `ids.ts` + `docs/agent-ui-map.md` (factories for dynamic rows).
   - Reachable only via guesswork → named `flow` / seed / `open` alias in `docs/agent-routes.md`.
   - Id existed but wrong key → fix map/`ids.ts` aliases; prefer stable demo ids (`trip-agent-ui-demo`, …).
3. Re-prove with `verify` / `assert` / `tap` on the **new known id** — no second dump.
4. Goal: each dump permanently removes one reason agents dump. Keep refining until dumps are rare/zero.

Dump is for discovery only. `exists` / `wait` / `route` / map / `agent-ui-source.sh` cover everything else.

Off-screen: `agent-ui-scroll.sh` / `once --scroll` — never host mouse / CGEvent on Simulator.

## Assert-first

```bash
# Default dual close-out (named flow when not already on the route)
./scripts/agent-ui-verify-both.sh --route /travel/trip-agent-ui-demo --flow travel-demo \
  --exists travel.planDetail.transportSection \
  --color travel.planDetail.transportSection '#2474A8'

# Travel Home smoke — empty guest has no yourTrips/newTrip; seed via travel-home (H18)
./scripts/agent-ui-verify-both.sh --route /travel --flow travel-home \
  --exists travel.list.section.yourTrips --exists travel.newTrip.open

# New Trip sheet (overlay on /travel) — named flow always runs (never skipped)
./scripts/agent-ui-verify-both.sh --route /travel --flow open-new-trip \
  --exists travel.newTrip.cancel --exists travel.newTrip.create

# Single-platform only when already pinned / user-scoped
./scripts/agent-ui.sh verify --route /travel/trip-agent-ui-demo --flow travel-demo \
  --exists travel.planDetail.transportSection
```

- Assert: `./scripts/agent-ui-assert.sh` / `once --assert-*` — route, exists/absent, prefix, `--contains` (label or Input value), `--color` (accent in frame).
- Prefer named `--flow` / seeds over hand-built `--goto` / `--wait` chains.
- **H18:** bare `--route /travel` + `yourTrips` fails on empty guest — use `--flow travel-home` (see `docs/agent-ui-verify-benchmark.md`).
- No mid-flow screenshots. No ritual handoff screenshot after a passing assert.
- Budget (warm): ≤1 dump (must retire same turn), ≤1 screenshot (visual only), 0 prophylactic `ensure-packager`, 0 force-stop / `--force-reconnect`, 0 tab-hops when flow/open fits.
- `verify` before re-`flow` when already on route. One shell chain. Typecheck/tests in parallel with UI.
- **Never `| tail` / `| head` on `verify-both` / `once` / `verify`** — pipes buffer until exit (looks hung). Scripts **refuse** that pattern (`agent_ui_refuse_piped_head_tail`, exit 2; escape `AGENT_UI_ALLOW_PIPED_TAIL=1`). Use bare invoke or `tee logfile` (no trailing `tail`). `--help` exits before device lease.
- **Never `adb … emu kill` / mass `simctl shutdown` before verify** — that forces a cold pool boot (Android often 3–6+ min). Reuse Metro + let the pool reclaim warm iOS/Android slots (`KEEP_IOS`/`KEEP_ANDROID=1`).

## Dev Mode sandbox (off by default)

Dev Mode stays **off by default**. Seeds/flows call `ensureDevModeSandboxSync` (source=`agent`) so mock fixtures never sync to the live account.

- Need mock data → `once --flow …` / `seed` (auto-on) or `./scripts/agent-ui.sh devmode on`
- Done with mock data → `./scripts/agent-ui.sh devmode release` (agent-only) or `devmode off`
- **`verify-both` auto-releases** agent sandboxes on both platforms after asserts
- Cold start exits leftover sandboxes (agent and Developer Hub) so Dev Mode stays off by default

Do not leave Dev Mode on after a turn that only needed fixtures for verify.

## Dual-platform close-out (opt-in only)

Never run device, simulator, emulator, or dual-platform UI verification unless the user explicitly asks for device testing in the current task. When requested for app-affecting JS/UI, prove on **both** iOS (`onTrack Agent N`, latest iOS runtime) and Android (`onTrack_Agent_N`) via **`agent-ui-verify-both.sh`** (iOS + Android **in parallel** by default — wall-clock ≈ slower side; `AGENT_UI_VERIFY_SERIAL=1` only for debug). Pin Android; clear sticky `AGENT_UI_PLATFORM=android` before iOS (`verify-both` clears for you). Width ~402 iOS / ~384 Android. **One** verify-both per requested close-out — do not grind retries / `SKIP_LEASE` / Galaxy cold boots after a warm pool fail; fix the assert or device then re-run once.

Metro: reuse if `/status` 200 + Watchman attached. Agents: `npm run packager:ensure:start` only — never `npm start` in agent shells. Node 24 (`.nvmrc`). Prefer Fast Refresh; do **not** terminate / force-stop / `--force-reconnect` after routine edits.

Android viewport is short (~384×832): expand collapsible rows, then `--scroll` / flow `scroll` before tapping below-the-fold controls. Travel land flows start with `dismiss` so leftover sheets do not swallow taps.

## Hang benchmark (mandatory on sim/emu complaints)

**Whenever the user complains about Simulator, emulator, verify hang, “takes forever”, pool thrash, or device timeouts:** read [`docs/agent-ui-verify-benchmark.md`](../../../docs/agent-ui-verify-benchmark.md) **first** — match H1–H23, check `docs/agent-ui-verify-benchmark.tsv` timings, then triage. Do not invent a new hang theory until the catalog is checked.

**H20 (iOS green / Android misses brand-new `ontrack.*`):** warm Android bridge ≠ fresh JS. `verify` / `verify-both` bump+wait the Metro `hmrBeacon` and soft-reconnect when the app lags — do not re-diagnose as guest/session. Escape: `AGENT_UI_SKIP_JS_FRESH=1`.

**H23 (stale native on a warm sim/emu):** `verify` / `ensure-packager` install the latest local debug `.app`/APK onto the current agent device, then sidecar-install the same build onto `onTrack iPhone 17 Pro` and `Galaxy_S26` (install only — never verify/adopt those). Galaxy is updated only when already running. Rebuild only when native sources are newer than that artifact. Escape: `AGENT_UI_SKIP_NATIVE_FRESH=1`.

Append a dual-open run when proving a fix: `./scripts/agent-ui-benchmark-open.sh` (agent pool only).

## Headless by default (user override only)

Agent verify runs on **headless** iOS (`simctl boot`) and Android (`-no-window` qemu). Dump/tap/assert/screenshot work without Simulator.app or an emulator GUI.

- Defaults: `ONTRACK_IOS_SIMULATOR_WINDOW=0`, `ONTRACK_ANDROID_EMULATOR_WINDOW=0` (see `scripts/lib/ios-simulator.sh`, `scripts/lib/android-emulator.sh`).
- **Never** open a headed window for routine verify:
  - Do not set `ONTRACK_IOS_SIMULATOR_WINDOW=1`
  - Do not run `ensure-android-emulator.sh --window` / `android:ensure:window` / `android:run`
  - Do not `open -a Simulator` to “watch” the run
- Agent iOS pool runs in the background via `simctl`. Your headed Simulator.app may stay open — Apple attaches agent windows too, so we auto-minimize `onTrack Agent *` (never close = shutdown; never quit your Simulator.app). If you explicitly open/restore an agent window, it stays pinned headed (Dock restore or `ios_sim_open_agent_headed <slot>`).
- **No headed handoff.** Verify never boots, repoints, lands on, or adopts a non-agent device. `onTrack iPhone 17 Pro` and `Galaxy_S26` belong to the user — leave them exactly as they were. Agent devices **safe-shutdown on lease EXIT** by default (H19; Android `default_boot` snapshot first). Park-warm only with `AGENT_UI_KEEP_IOS=1` / `KEEP_ANDROID=1` / `KEEP_DEVICES=1`.
- **iOS screenshot / alert OCR (no hang):** every `simctl io screenshot` is hard-capped (`AGENT_UI_IOS_SCREENSHOT_SECS` / `ONTRACK_SIMCTL_TIMEOUT_SECS`, default 10) with a heal budget (`AGENT_UI_IOS_SCREENSHOT_HEAL_SECS`, default 35). Capture takes `ios-capture.lock` so the Agent GUI reaper cannot re-minimize mid-unpark. Alert OCR soft-skips on true headless **or** headless Agent-pool leases (Agent N minimized while the user’s Pro keeps Simulator.app open). Headed verify (`ONTRACK_IOS_SIMULATOR_WINDOW=1`) still hard-fails if surfaces stay unavailable (never green-blind).
- **Headed layout (user-invoked runs only):** Android emulator GUI **left**, iOS Simulator **right** (`android_emu_place_window left` / `ios_sim_place_window_named … right`). Do not center or swap sides.
- Assert / `--color` / route / exists are enough. Host screenshots use `simctl io` / bridge capture — no window required.
- Open headed Simulator/AVD **only** when the user explicitly asks (e.g. “headed”, “open Simulator”, “show the emulator”, “with window”). Then:
  - iOS: `ONTRACK_IOS_SIMULATOR_WINDOW=1` (or ensure-packager with that env)
  - Android: `./scripts/ensure-android-emulator.sh --window` (restarts a headless qemu — does not reuse it). Before “Emulator ready”, `android_emu_ensure_app_surface` relaunches the app after window restart and fails handoff if the SurfaceView stays blank/white (bridge-ok ≠ painted).
- **16GB host rule:** headed `Galaxy_S26` (~8GB) must not share the machine with any `onTrack_Agent_*` (~4GB). Sticky `.cursor/android-headed.keep` is honored **only while the Galaxy GUI is actually headed** (stale keep after close/pool-kill is auto-cleared — H14). **Live headed GUI always wins** — Android work adopts Galaxy and kills agent AVDs; pool verify-both must **never** `emu kill` a visible window (“Saving state…” = H15). When Galaxy is closed, pool uses Agent AVD (`KEEP_HEADED=0` ignores sticky-only keep). Force Galaxy: `ONTRACK_ANDROID_KEEP_HEADED=1` or `android:ensure:window`.

## Agent device policy (2 iOS + 2 Android, agent-only)

One agent = one device slot. Agents never share a device and never touch a
non-agent device.

| Slot | iOS | Android AVD | Agent account |
|------|-----|-------------|---------------|
| 1 | `onTrack Agent 1` | `onTrack_Agent_1` | `agent_1` (iOS) / `agent_3` (Android) |
| 2 | `onTrack Agent 2` | `onTrack_Agent_2` | `agent_2` (iOS) / `agent_4` (Android) |

- **Cap: 2 per platform (4 devices total)** — `AGENT_UI_POOL_HARD_MAX=2`, not env-overridable. `AGENT_UI_POOL_MAX` can only lower it.
- **No slot free → stop.** One claim sweep, then exit **3** (`AGENT_UI_NO_SLOT_EXIT`) with `no free agent device slot … stopping without UI verify`. Report the skip and finish the turn: do not queue, do not retry, never fall back to `onTrack iPhone 17 Pro` / `Galaxy_S26`. Waiting is debug-only (`AGENT_UI_LOCK_WAIT_SECS>0`).
- **Agent-only guard:** while a lease is held, any bound device that is not `onTrack Agent N` / `onTrack_Agent_N` is a hard failure (`agent_ui_assert_agent_device_bound`) — a stale pin must never type into the user's device.
- **Silent devices:** headless by default; agent AVDs pass `-no-audio` even when a window is requested.
- **Launch budget 30s** (`AGENT_UI_DEVICE_LAUNCH_BUDGET_SECS`): every iOS boot / Android `boot_completed` / adb attach logs elapsed time and shouts when over budget. Over budget = a defect to diagnose (hang catalog), not a slow day.
- **Claim order:** preferred pin → **warm orphan** (iOS Booted and/or Android `boot_completed`, lock free) → cold free slot (`reclaiming warm slot`, `devices already up — skipping`).
- **No orphans:** `EXIT/INT/TERM/HUP` release the lease; `agent_ui_pool_reap_orphans` shuts down (or idle-stamps when `KEEP_*=1`) devices whose owner died or whose slot is above the cap. Never leave agent devices orphaned.
- Nested children inherit `AGENT_UI_SLOT`; `verify-both` holds one slot for the whole dual run.
- On lease release: **safe shutdown** by default (`AGENT_UI_KEEP_IOS=0`, `AGENT_UI_KEEP_ANDROID=0` — H19). Android saves `default_boot` before `emu kill` so the next agent reloads fast. Park warm: `KEEP_IOS=1` / `KEEP_ANDROID=1` / `KEEP_DEVICES=1` (idle GC via `AGENT_UI_*_IDLE_SECS`, default 1800).
- Agent AVD boots use `-no-snapshot-save` (kill-safe); after a successful cold boot, `android_emu_regenerate_default_snapshot` heals `default_boot`.
- Creates missing sims/AVDs on demand; clones the app onto a new iOS slot from any sim that already has it.
- Daemon commands are routed by `platform:slot` so parallel agents do not steal ops.
- Escape: `AGENT_UI_SKIP_LEASE=1` or `AGENT_UI_USE_POOL=0` (legacy single lock — do not use for normal close-out).

## Agent accounts (agent_1…agent_4)

Each device signs into its **own** account so agents never collide with each other or with the user's data. Index = `(android ? 2 : 0) + slot`.

```bash
./scripts/agent-accounts-setup.sh        # once per machine (needs SUPABASE_SERVICE_ROLE_KEY)
./scripts/agent-ui.sh login              # dismiss prompts + sign this device into its agent_N account
./scripts/agent-ui.sh login --guest      # credential-free: clear prompts + continue as guest
./scripts/agent-ui.sh login --status     # is the auth gate up?
```

- `login` also clears blocking system sheets and leftover in-app sheets first (`--dismiss`).
- Credentials only in gitignored `.env.local`; password travels env → daemon body (never argv / deep link / status). Prefer `./scripts/agent-accounts-setup.sh`. Optional override: `ONTRACK_AGENT_LOGIN_EMAIL` + `ONTRACK_AGENT_LOGIN_PASSWORD` (still needs `account_flags.agent_test`). Never commit personal emails into source.
- Sign-in is **dev-only** and requires `account_flags.agent_test` (else signs back out). Guest is the default for plain verify.
- Daemon binds `0.0.0.0:8191` (`/next` unauthenticated — don't verify on an untrusted LAN). Loopback bind breaks `adb reverse`.

### Android slot routing (H17 — do not "simplify")

iOS: pin file + deep-link. Android: host port `8191+N` via `adb reverse` (daemon ports follow `AGENT_UI_POOL_HARD_MAX`).

- No Metro `/__agent_ui`, pin writes, or slot deep-link on Android (`agent_ui_pin_slot` / `write_slot_pin` no-op).
- Reconnect prelude: `android_emu_prepare_metro_dev_client` (reverse + wedge force-stop).
- Slot change must `adb reverse --remove` first.

## Stuck config triage

1. Print sticky pins (`AGENT_UI_PLATFORM`, `AGENT_UI_SLOT`, …). Pool wait → see device pool section above.
2. `route` with explicit pin; fix device if width ≠ pin.
3. Android after reconnect often on `/` — `verify` auto-lands (goto if no `--flow`), waits for route, retries land once; `verify-both` force-lands when on `/`.
4. iOS Apple Account / system sheet / “Open in onTrack?” / location / Expo developer-menu intro → schemes pre-approved on boot (`ios_sim_approve_url_schemes`); sheets auto-cleared in `ensure_app_up` / reconnect (Apple Account / password → **Not Now** — never Escape; Open-in → **Open**; location → **Allow While Using App**; Expo intro → **Continue**). Manual: `./scripts/agent-ui-ios-alerts.sh ensure`. Bypass: `AGENT_UI_SKIP_IOS_ALERTS=1`.
5. Health: Metro `:8081/status`, daemon `:8191/health`. Android: `adb reverse` for 8081/8191.

### Device timeout protocol

If boot / simctl / bridge / wait / reconnect **times out**, do not retry blind. Classify the error, take one health snapshot, recover just enough to proceed, then **fix the cause** (host script, pool bind, scheme sheet, flaky wait, wedge recovery) so the same timeout class does not repeat. Full checklist: `.cursor/rules/stuck-check-config.mdc`.

**Auto-restart:** if the preferred sim/emu (or its bridge) does not answer within `AGENT_UI_DEVICE_RESPOND_SECS` (default **10**), `agent_ui_ensure_app_up` assumes the device went down and restarts it once (`agent_ui_restart_device`), then relaunches the app. `ONTRACK_SIMCTL_TIMEOUT_SECS` defaults to 10. Escape: `AGENT_UI_SKIP_DEVICE_RESTART=1`.

## Screenshot evidence (only when needed)

One final screenshot; every visual claim must be in that image. Prefer testID + `--color` / `--contains` over vision. Host `--screenshot` / `--color` settle ~450ms after in-app ops (sheet paint).

### Glyph / icon orientation → source (not screenshots)

Tiny glyphs and icon direction are **not** verify targets for screenshot loops.

- Fix from source: `Symbol`, `src/design-system/icons.ts` platform maps, transforms — then Fast Refresh + assert route/id.
- Do **not** force-reconnect, crop screenshots, or run vision captions to “prove” nose/wing direction.
- If the image does not clearly settle a *layout* claim → say **not sure** and stop. Do not invent a defect.
- Never escalate an uncertain visual impression into a fix loop without user confirmation.

## Do not

Dump “just to be sure”; leave a dump without retiring it (id/map/flow); dump twice for the same gap; re-flow to re-assert; coordinate taps; ship interactive UI without `ontrack.*` ids; kill Metro / `--clear` / force-stop / `--force-reconnect` after routine edits; end on iOS-only for app UI; ritual handoff screenshots; guess icon orientation / micro-glyph defects from screenshots; grind verify under an iOS system sheet; open Simulator.app / emulator `--window` unless the user explicitly asked for headed; pipe `verify-both` through `tail`/`head`; mass-kill emulators before a routine verify; re-run `once --flow open-new-trip` after `verify-both --flow open-new-trip` already passed (named flows are not skipped).
