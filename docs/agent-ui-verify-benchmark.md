# Agent-UI verify hang benchmark

Living tracker for **why verify looks hung**, what we fixed, and warm/cold dual-open timings on the **headless agent pool** (not the user’s headed Simulator / Galaxy).

**Agents:** when Rocky complains about Simulator / emulator / verify hang / slowness / pool thrash — **read this file first** (then agent-ui skill + `stuck-check-config.mdc`). Wired from `ontrack-core.mdc`, agent-ui skill, stuck-check, and prompt-enrich.

**Run log (append-only):** [`agent-ui-verify-benchmark.tsv`](./agent-ui-verify-benchmark.tsv)  
**Runner:** `./scripts/agent-ui-benchmark-open.sh` (records a TSV row).

Related chats (2026-08-07 → 2026-08-09):

| Chat | Focus |
|---|---|
| [Hanging issue](3a6f4853-6961-4724-a1fe-fbe44127759b) | `| tail` buffers progress |
| [Slow steps issue](4e176503-de59-4769-becb-dbdfcdee15dc) | pipe + cold pool + `/travel` false skip |
| [Itinerary text visibility](6e9ba74e-a72d-42f8-8bcc-0a2fcd1d7a8b) | Agent unpark / `simctl io` hang |
| [Itinerary page light mode](61f7cf46-6617-4aa4-b9df-c3f5161831b5) | enrich: never `| tail` |
| [Glass UI removal](4ca7ce07-c0e2-4d5f-9c27-a0eb1aabadd0) | pipe refuse, soft-first Android, heartbeats, epilogue parse |
| [Travel home smoke](282e4242-112e-4ae5-8540-1185a969e0b7) | H18 empty guest `/travel` assert; warm travel-home ~21s |

---

## Targets (agent pool, `AGENT_UI_SKIP_HEADED_HANDOFF=1`)

| Scenario | Good | Warn | Bad |
|---|---|---|---|
| Dual open Today (warm iOS+Android) | ≤45s | ≤90s | >120s |
| Dual open Today (cold Android ensure) | ≤120s | ≤180s | >300s |
| Dual travel-demo (warm) | ≤75s | ≤120s | >240s |
| Dual travel-home (warm) | ≤45s | ≤75s | >120s |

`verify-both` runs iOS + Android **in parallel** by default (`AGENT_UI_VERIFY_SERIAL=1` → old sequential). Warm wall-clock should track `max(ios, android)`, not the sum.

“Open” baseline command (does **not** hand off to headed Pro/Galaxy):

```bash
./scripts/agent-ui-benchmark-open.sh
# same as:
# AGENT_UI_SKIP_HEADED_HANDOFF=1 ONTRACK_ANDROID_KEEP_HEADED=0 \
#   ./scripts/agent-ui-verify-both.sh --route / --flow today \
#   --exists ontrack.today.addActivity --exists ontrack.today.nextDay
```

Travel Home smoke (empty guest has no `yourTrips` / `newTrip.open` — seed via named flow):

```bash
./scripts/agent-ui-verify-both.sh --route /travel --flow travel-home \
  --exists travel.list.section.yourTrips --exists travel.newTrip.open
```

---

## Hang classes → fixes (keep these)

| ID | Symptom | Root cause | Fix (code / habit) | Status |
|---|---|---|---|---|
| H1 | Cursor “Running…” blank for minutes | `2>&1 \| tail`/`head` buffers until exit | Hard refuse before lease (`agent_ui_refuse_piped_head_tail`); escape `AGENT_UI_ALLOW_PIPED_TAIL=1`; use bare invoke or `tee` | shipped |
| H2 | Piped refuse kills innocent `agent-ui` | Sibling `jest \| tail && script` matched | Match only `entry … \| head\|tail` (pipe **after** entry) | shipped |
| H3 | `--help` / `once --help` “hangs” | `source agent-ui-host.sh` auto-leases pool | Help exits **before** sourcing host | shipped |
| H4 | Stuck after iOS passed | Sticky `android-headed.keep` → Galaxy adopt + kill Agent_* | Pool verify-both forces `ONTRACK_ANDROID_KEEP_HEADED=0` unless explicit `=1` | shipped |
| H5 | Multi-minute quiet after Galaxy kill | Peer `emu kill` **before** soft reconnect | Soft bridge/reconnect first; kill peers only on cold ensure (or after warm ok) | shipped |
| H6 | Quiet packager reconnect looks frozen | No progress while `ensure-packager` runs | Heartbeats every 5s (`still ensuring…`, bridge wait beats) | shipped |
| H7 | Fake `syntax error near fi` / `(` after pass | Bash re-reads script after long work; mid-edit shifts offsets | Define `finish_verify_both` **before** `run_ios`/`run_android`; don’t edit scripts mid-run | shipped |
| H8 | Hang on “unparking agent window” | Unbounded `simctl io screenshot`; reaper vs unpark race; orphan `simctl io` | Capture lock + killpg timeouts; Agent-pool alert OCR soft-skip; Booted preflight | shipped |
| H9 | Cold pool 3–6+ min | Mass `emu kill` / shutdown before verify | Never mass-kill before routine verify; reclaim warm Agent N | habit + skill |
| H10 | Re-run `open-new-trip` forever | `/travel/trip-…` matched as `/travel` | Exact `route_matches`; named flow never skipped | shipped |
| H11 | Android `route=?` / Galaxy spoof | Bare adb hits Galaxy while Agent is target | Pin Agent serial; process+route checks; pool stays on Agent AVD | shipped |
| H12 | Headed Pro polluted after agent verify | Auto `agent_ui_headed_viewer_handoff` | Handoff removed entirely — agents never boot/repoint a non-agent device | shipped (see H16) |
| H13 | Dual verify always feels 2× long | Sequential iOS→Android paid `sum(wall)` | Parallel `run_ios`/`run_android` (daemon `platform:slot`); `AGENT_UI_VERIFY_SERIAL=1` escape | shipped |
| H14 | “adopting Galaxy” then “handoff skipped” after every verify | Stale `.cursor/android-headed.keep` after Galaxy closed / pool-killed; handoff adopted then refused cold-boot | `want_keep_headed` only while GUI headed (GC stale keep); handoff ready-check before adopt | shipped |
| H15 | Headed Galaxy “Saving state…” / turns off alone | Pool `verify-both` forced `KEEP_HEADED=0` → `shutdown_others` `emu kill` on live GUI while Agent_* ran | Never kill `android_emu_avd_is_headed`; live GUI → adopt (`KEEP=1`); sticky-only keep ignored when GUI closed | shipped |
| H16 | Agents queue 5 min, thrash devices, or land on the user's Pro/Galaxy | Pool allowed 5 slots + 300s wait + headed handoff/adopt | 2 slots per platform (hard cap), single claim sweep → exit 3 “stop without testing”, agent-only bind guard, orphan reap, 30s launch budget (`AGENT_UI_DEVICE_LAUNCH_BUDGET_SECS`) | shipped |
| H17 | Android `bridge quiet` / `reconnect timed out` while unslotted `send` works | App never learns pool slot (pin unread, deep link = onNewIntent, shared Build.MODEL); Metro `/__agent_ui` erased the slot | Slot = host port `8191+N` via `adb reverse`; no Metro proxy / pin deep-link / mid-load VIEW on Android | shipped |
| H18 | `/travel` goto+wait ok, then `yourTrips` / `newTrip.open` assert fails (both platforms) | Empty guest Travel Home — section + FAB only mount after trips/seed; bare `--route /travel` is not a smoke | `--route /travel --flow travel-home --exists travel.list.section.yourTrips` (+ optional `travel.newTrip.open`); empty chrome → `travel.list.empty.create` | habit + skill |
| H19 | Agent sims/AVDs still Booted after verify (“didn’t shut down”) | Lease release parked warm (`KEEP_IOS`/`KEEP_ANDROID=1` was default) | Default is now **safe shutdown** on EXIT (`KEEP_*=0`); Android saves `default_boot` before kill for fast reload; orphans reaped on claim. Park-warm escape: `KEEP_*=1` / `KEEP_DEVICES=1` | shipped |
| H20 | iOS assert passes, Android misses brand-new `ontrack.*` / label after src edit | Warm Android bridge answers on a **stale JS bundle** (“already connected”); iOS cold-reconnects and gets Fast Refresh. Bridge liveness ≠ bundle freshness | Status carries `hmrBeacon`; `verify` / `verify-both` bump+wait the Metro beacon and soft-reconnect when the app lags (`ensure_js_fresh`); ensure-packager no longer trusts “already connected” alone. Escape: `AGENT_UI_SKIP_JS_FRESH=1` | shipped |
| H21 | “Checking app install…” then ~40–60s quiet / reconnect timeout every turn | (1) H19 shutdown → cold boot every lease; (2) install check is cheap but logged every boot; (3) ensure-packager reconnect waited full deadline while app process was **dead**, then host launched anyway | Cold `ensure_app_up` uses `AGENT_UI_PACKAGER_SKIP_RECONNECT=1` (boot only → launch next); iOS reconnect re-launches when process dead + fail-fast ~12s; quieter install logs. Habit: one `verify-both` per close-out; park-warm with `KEEP_DEVICES=1` only for multi-step debug | shipped |
| H22 | Agent iOS `JS stale` / `bridge quiet` after `packager:ensure:start` | Non-pool Metro heal preferred Pro and `ios_sim_shutdown_others` killed Agent N; HMR socket died; native agent binary can also lag (`1.0.68` vs JS `1.0.103`) | Never shut down Pro or `onTrack Agent *` from `ios_sim_shutdown_others`; refresh agent sims with `ios:update-simulators` / agent-only install — do not adopt Pro | shipped |
| H23 | Verify / packager tests a warm sim/emu that still has an old native client | `ensure_app_up` treated “installed + bridge up” as ready; clone-if-missing never replaced a stale `.app`/APK, so Agent N could stay on `1.0.68` after a newer local debug build | `ensure_app_up` / `ensure-packager` install the latest local debug client onto the **current** device (stamp vs artifact identity) **and** sidecar-install onto `onTrack iPhone 17 Pro` + `Galaxy_S26` (never adopt them for verify; Galaxy only if already running). Rebuild only when native sources outpace the artifact. iOS clone prefers `ios/build/…/onTrack.app`. Escape: `AGENT_UI_SKIP_NATIVE_FRESH=1` | shipped |

---

## Key files

| Area | Path |
|---|---|
| Pipe refuse + bridge heartbeats | `scripts/lib/agent-ui-host.sh` |
| Soft-first Android + finish epilogue | `scripts/agent-ui-verify-both.sh` |
| Screenshot / unpark bounds | `scripts/lib/agent_ui_color.py`, `scripts/lib/ios-simulator.sh` |
| Device policy: slots, fail-fast, orphan reap | `scripts/lib/agent-ui-pool.sh` |
| 30s launch budget | `scripts/lib/device-launch-budget.sh` |
| Agent accounts (agent_1…agent_4) | `scripts/agent-accounts-setup.sh`, `scripts/agent-ui-login.sh` |
| Native freshness (H23) | `scripts/lib/native-build-freshness.js`, `scripts/lib/virtual-device-build.sh` |
| Contracts | `scripts/__tests__/agent-ui-host-contract.test.ts`, `metro-launch-contract.test.ts`, `native-build-freshness.test.ts` |
| Agent skill | `.cursor/skills/agent-ui/SKILL.md` |
| Enrich one-liners | `~/.cursor/prompt-enrich.md` (Findings) |

---

## How to append a run

Prefer the runner (parses slot, warm/cold, exits, elapsed):

```bash
./scripts/agent-ui-benchmark-open.sh
./scripts/agent-ui-benchmark-open.sh --label "after-metro-restart"
```

Manual TSV row (tab-separated):

```
date_iso	elapsed_s	ios_exit	android_exit	slot	path	label	notes
```

`path` = `warm` \| `cold` \| `mixed` (Android soft-first vs packager ensure).

---

## Baseline samples (2026-08-08)

| When | elapsed_s | path | notes |
|---|---|---|---|
| Glass chat warm Notes/Transport | ~53 | warm | first `Android warm path ok` |
| Glass chat warm Notes/Transport | ~66 | warm | clean `ios_exit=0 android_exit=0`, no syntax noise |
| Agent-only Today open | ~74 | warm | `SKIP_HEADED_HANDOFF=1` |
| Agent-only Today open (this bench seed) | ~118 | cold | heartbeats 5–55s during packager ensure; still green |
| Travel-home smoke (H18) | ~21 | warm | `travel-home` + yourTrips + newTrip.open; bare goto alone failed |
