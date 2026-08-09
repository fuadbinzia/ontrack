# Agent-UI verify hang benchmark

Living tracker for **why verify looks hung**, what we fixed, and warm/cold dual-open timings on the **headless agent pool** (not the user’s headed Simulator / Galaxy).

**Agents:** when Rocky complains about Simulator / emulator / verify hang / slowness / pool thrash — **read this file first** (then agent-ui skill + `stuck-check-config.mdc`). Wired from `ontrack-core.mdc`, agent-ui skill, stuck-check, and prompt-enrich.

**Run log (append-only):** [`agent-ui-verify-benchmark.tsv`](./agent-ui-verify-benchmark.tsv)  
**Runner:** `./scripts/agent-ui-benchmark-open.sh` (records a TSV row).

Related chats (2026-08-07 → 2026-08-08):

| Chat | Focus |
|---|---|
| [Hanging issue](3a6f4853-6961-4724-a1fe-fbe44127759b) | `| tail` buffers progress |
| [Slow steps issue](4e176503-de59-4769-becb-dbdfcdee15dc) | pipe + cold pool + `/travel` false skip |
| [Itinerary text visibility](6e9ba74e-a72d-42f8-8bcc-0a2fcd1d7a8b) | Agent unpark / `simctl io` hang |
| [Itinerary page light mode](61f7cf46-6617-4aa4-b9df-c3f5161831b5) | enrich: never `| tail` |
| [Glass UI removal](4ca7ce07-c0e2-4d5f-9c27-a0eb1aabadd0) | pipe refuse, soft-first Android, heartbeats, epilogue parse |

---

## Targets (agent pool, `AGENT_UI_SKIP_HEADED_HANDOFF=1`)

| Scenario | Good | Warn | Bad |
|---|---|---|---|
| Dual open Today (warm iOS+Android) | ≤45s | ≤90s | >120s |
| Dual open Today (cold Android ensure) | ≤120s | ≤180s | >300s |
| Dual travel-demo (warm) | ≤75s | ≤120s | >240s |

`verify-both` runs iOS + Android **in parallel** by default (`AGENT_UI_VERIFY_SERIAL=1` → old sequential). Warm wall-clock should track `max(ios, android)`, not the sum.

“Open” baseline command (does **not** hand off to headed Pro/Galaxy):

```bash
./scripts/agent-ui-benchmark-open.sh
# same as:
# AGENT_UI_SKIP_HEADED_HANDOFF=1 ONTRACK_ANDROID_KEEP_HEADED=0 \
#   ./scripts/agent-ui-verify-both.sh --route / --flow today \
#   --exists ontrack.today.addActivity --exists ontrack.today.nextDay
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
| H12 | Headed Pro polluted after agent verify | Auto `agent_ui_headed_viewer_handoff` | `AGENT_UI_SKIP_HEADED_HANDOFF=1` for agent-only opens | escape / bench default |
| H13 | Dual verify always feels 2× long | Sequential iOS→Android paid `sum(wall)` | Parallel `run_ios`/`run_android` (daemon `platform:slot`); `AGENT_UI_VERIFY_SERIAL=1` escape | shipped |
| H14 | “adopting Galaxy” then “handoff skipped” after every verify | Stale `.cursor/android-headed.keep` after Galaxy closed / pool-killed; handoff adopted then refused cold-boot | `want_keep_headed` only while GUI headed (GC stale keep); handoff ready-check before adopt | shipped |
| H15 | Headed Galaxy “Saving state…” / turns off alone | Pool `verify-both` forced `KEEP_HEADED=0` → `shutdown_others` `emu kill` on live GUI while Agent_* ran | Never kill `android_emu_avd_is_headed`; live GUI → adopt (`KEEP=1`); sticky-only keep ignored when GUI closed | shipped |

---

## Key files

| Area | Path |
|---|---|
| Pipe refuse + bridge heartbeats | `scripts/lib/agent-ui-host.sh` |
| Soft-first Android + finish epilogue | `scripts/agent-ui-verify-both.sh` |
| Screenshot / unpark bounds | `scripts/lib/agent_ui_color.py`, `scripts/lib/ios-simulator.sh` |
| Contracts | `scripts/__tests__/agent-ui-host-contract.test.ts`, `metro-launch-contract.test.ts` |
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
