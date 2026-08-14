import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8');
}

function runBridge(args: string[]): string {
  return execFileSync(
    'python3',
    [join(root, 'scripts/lib/agent_ui_bridge.py'), ...args],
    { encoding: 'utf8', env: { ...process.env, AGENT_UI_ROOT: root } },
  ).trim();
}

describe('agent-ui host scripts contract', () => {
  it('ships shared host lib and fast-path scripts', () => {
    expect(existsSync(join(root, 'scripts/lib/agent-ui-host.sh'))).toBe(true);
    expect(existsSync(join(root, 'scripts/lib/agent_ui_bridge.py'))).toBe(true);
    expect(existsSync(join(root, 'scripts/lib/agent_ui_daemon.py'))).toBe(true);
    for (const script of [
      'scripts/agent-ui.sh',
      'scripts/agent-ui-assert.sh',
      'scripts/agent-ui-verify.sh',
      'scripts/agent-ui-dump.sh',
      'scripts/agent-ui-tap.sh',
      'scripts/agent-ui-open.sh',
      'scripts/agent-ui-wait.sh',
      'scripts/agent-ui-exists.sh',
      'scripts/agent-ui-route.sh',
      'scripts/agent-ui-goto.sh',
      'scripts/agent-ui-batch.sh',
      'scripts/agent-ui-seed.sh',
      'scripts/agent-ui-flow.sh',
      'scripts/agent-ui-devmode.sh',
    ]) {
      expect(existsSync(join(root, script))).toBe(true);
      if (script !== 'scripts/agent-ui.sh') {
        expect(read(script)).toContain('agent-ui-host.sh');
      }
    }
    expect(existsSync(join(root, 'scripts/lib/agent_ui_ids.py'))).toBe(true);
    expect(existsSync(join(root, 'scripts/lib/agent_ui_color.py'))).toBe(true);
  });

  it('resolves AgentUiIds key paths to wire testIDs', () => {
    expect(runBridge(['resolve-id', 'travel.planDetail.transportSection'])).toBe(
      'ontrack.travel.planDetail.section.transport',
    );
    expect(
      runBridge(['resolve-id', 'AgentUiIds.travel.planDetail.transportSection']),
    ).toBe('ontrack.travel.planDetail.section.transport');
    // Factory / parameterized ids aren't static leaves — still get ontrack. prefix.
    expect(
      runBridge([
        'resolve-id',
        'travel.timelineItem.trip-item-ms5dgy44-8.default',
      ]),
    ).toBe('ontrack.travel.timelineItem.trip-item-ms5dgy44-8.default');
    expect(
      runBridge([
        'resolve-id',
        'travel.flight.openConfirmation.trip-item-ms5dgy44-8',
      ]),
    ).toBe('ontrack.travel.flight.openConfirmation.trip-item-ms5dgy44-8');
    expect(
      runBridge([
        'resolve-id',
        'ontrack.travel.timelineItem.trip-item-ms5dgy44-8.default',
      ]),
    ).toBe('ontrack.travel.timelineItem.trip-item-ms5dgy44-8.default');
    const ops = JSON.parse(
      runBridge([
        'batch-args',
        '--',
        '--assert-exists',
        'travel.planDetail.transportSection',
        '--assert-prefix',
        'travel.planDetail.',
        '--tap',
        'travel.timelineItem.item-agent-ui-demo-flight.default',
      ]),
    );
    expect(ops).toEqual([
      {
        op: 'assert',
        id: 'ontrack.travel.planDetail.section.transport',
      },
      { op: 'assert', prefix: 'ontrack.travel.planDetail.' },
      {
        op: 'tap',
        id: 'ontrack.travel.timelineItem.item-agent-ui-demo-flight.default',
      },
    ]);
  });

  it('open prefers batch goto+wait and heals only after failure', () => {
    const open = read('scripts/agent-ui-open.sh');
    const wait = read('scripts/agent-ui-wait.sh');
    expect(open).toContain('agent_ui_send_op batch');
    expect(open).toContain('agent_ui_apply_wait_budget');
    expect(open).toContain('agent_ui_heal_packager');
    expect(open).toContain('batch open failed');
    // No happy-path soft heal / cold probe before the batch.
    expect(open).not.toContain('agent_ui_bridge_is_warm');
    expect(open).not.toMatch(/agent-ui-dump\.sh/);
    expect(wait).toContain('agent_ui_send_op wait');
    expect(wait).toContain('--id');
    expect(wait).toContain('--prefix');
    expect(wait).toContain('--route');
    expect(wait).not.toContain('agent_ui_send_op exists');
    expect(wait).not.toMatch(/agent-ui-dump\.sh/);
  });

  it('host lib uses daemon bridge with warm fail-fast budgets', () => {
    const host = read('scripts/lib/agent-ui-host.sh');
    const bridge = read('scripts/lib/agent_ui_bridge.py');
    const daemon = read('scripts/lib/agent_ui_daemon.py');
    const metro = read('metro.config.js');
    expect(host).toContain('agent_ui_bridge.py');
    expect(host).toContain('agent_ui_bridge_is_warm');
    expect(host).toContain('agent_ui_apply_wait_budget');
    expect(host).toContain('AGENT_UI_WARM_WAIT_SECS');
    expect(host).toContain('agent_ui_heal_packager');
    expect(host).toContain('agent_ui_ensure_app_up');
    expect(host).toContain('agent_ui_app_process_running');
    expect(host).toContain('agent_ui_bridge_answers');
    expect(host).toContain('ensure-packager.sh');
    expect(host).toContain('agent-ui-route.sh');
    expect(bridge).toContain('agent-ui-data-dir');
    expect(bridge).toContain('send_via_daemon');
    expect(bridge).toContain('batch-args');
    expect(bridge).toContain('run_once');
    expect(bridge).toContain('"assert"');
    expect(daemon).toContain('agent-ui.sock');
    expect(daemon).toContain('/next');
    expect(metro).toContain('/__agent_ui');
    expect(metro).toContain('8191');
  });

  it('routes Android to its pool slot by daemon host port (H17)', () => {
    const pool = read('scripts/lib/agent-ui-pool.sh');
    expect(pool).toContain('export AGENT_UI_POOL_HARD_MAX');

    const daemon = read('scripts/lib/agent_ui_daemon.py');
    expect(daemon).toContain('AGENT_UI_POOL_HARD_MAX');
    expect(daemon).toContain('def _slot_port_count(');
    expect(daemon).toContain('_slot_port_count()');
    expect(daemon).toContain('def slot_from_port(');
    expect(daemon).toContain('slot = self.slot_from_port() or slot');

    const android = read('scripts/lib/android-emulator.sh');
    expect(android).toContain('daemon_host_port=$((daemon_port + AGENT_UI_SLOT))');
    expect(android).toContain('reverse --remove');
    expect(android).toContain('android_emu_force_stop_if_wedged');
    expect(android).toContain('android_emu_prepare_metro_dev_client');

    const host = read('scripts/lib/agent-ui-host.sh');
    expect(host).toContain('agent-ui-dev-client.sh');
    expect(host).toContain('android_emu_prepare_metro_dev_client');
    expect(host).toMatch(
      /agent_ui_pin_slot\(\)[\s\S]*?agent_ui_is_android && return 0/,
    );
    expect(host).toMatch(
      /agent_ui_write_slot_pin\(\)[\s\S]*?agent_ui_is_android && return 0/,
    );
    expect(host).not.toMatch(/Android run-as files/);

    const ensure = read('scripts/ensure-packager.sh');
    expect(ensure).toContain('agent-ui-dev-client.sh');
    expect(ensure).toContain('agent_ui_dev_client_metro_url');
    expect(ensure).toContain('android_emu_prepare_metro_dev_client');
    expect(ensure).not.toContain('declare -F agent_ui_write_slot_pin');

    const bridgePy = read('scripts/lib/agent_ui_bridge.py');
    expect(bridgePy).not.toContain('write_android_slot_pin_file');
    expect(bridgePy).toMatch(
      /def write_slot_pin_file[\s\S]*?android[\s\S]*?return True/,
    );
    expect(bridgePy).not.toContain('Android files');

    const bridge = read('src/utils/agent-ui/http-bridge.ts');
    expect(bridge).not.toContain('10.0.2.2');
    expect(bridge).toMatch(/Platform\.OS !== 'android'[\s\S]*?__agent_ui/);
    expect(bridge).toMatch(/Platform\.OS === 'android' \|\| getAgentUiSlot/);
  });

  it('claims a dedicated agent device pool slot (max 2/platform) across entry points', () => {
    const host = read('scripts/lib/agent-ui-host.sh');
    const pool = read('scripts/lib/agent-ui-pool.sh');
    const ensure = read('scripts/ensure-packager.sh');
    expect(host).toContain('agent-ui-pool.sh');
    expect(host).toContain('agent_ui_ensure_lease');
    expect(pool).toContain('agent_ui_release_lease');
    expect(pool).toContain('agent_ui_pool_shutdown_slot');
    expect(pool).toContain('agent_ui_pool_slot_devices_up');
    expect(pool).toContain('agent_ui_pool_try_claim_slot');
    expect(pool).toContain('devices already up — skipping');
    expect(pool).toContain('reclaiming slot');
    expect(pool).toContain('reclaiming warm slot');
    expect(pool).toContain('ios_sim_shutdown_agent_named');
    expect(pool).toContain('android_emu_shutdown_named');
    expect(pool).toContain('AGENT_UI_KEEP_DEVICES');
    expect(pool).toContain('AGENT_UI_KEEP_IOS:=0');
    expect(pool).toContain('AGENT_UI_KEEP_ANDROID:=0');
    expect(pool).toContain('agent_ui_pool_keep_ios');
    expect(pool).toContain('agent_ui_pool_keep_android');
    expect(pool).toContain('shutting down orphaned');
    expect(pool).toContain('agent_ui_pool_gc_idle_ios');
    expect(pool).toContain('agent_ui_pool_gc_idle_android');
    expect(pool).toContain('agent_ui_pool_slot_ios_warm');
    expect(pool).toContain('agent_ui_pool_slot_warm');
    expect(pool).toContain('AGENT_UI_IOS_IDLE_SECS');
    expect(pool).toContain('AGENT_UI_ANDROID_IDLE_SECS');
    expect(pool).toContain('keeping');
    expect(pool).toContain('agent-ui-slots');
    expect(pool).toContain('AGENT_UI_POOL_MAX');
    expect(pool).toContain('onTrack Agent');
    expect(pool).toContain('onTrack_Agent_');
    // Policy: 2 iOS + 2 Android agent devices, hard-capped and not overridable.
    expect(pool).toContain('AGENT_UI_POOL_HARD_MAX=2');
    expect(pool).toContain('AGENT_UI_POOL_MAX:=2');
    // No free slot → stop without testing (never queue, never a user device).
    expect(pool).toContain('AGENT_UI_LOCK_WAIT_SECS:=0}');
    expect(pool).toContain('AGENT_UI_NO_SLOT_EXIT=3');
    expect(pool).toContain('stopping without UI verify');
    expect(pool).toContain('never fall back to a non-agent device');
    // Agent-only binding guard + orphan reaping + graceful shutdown.
    expect(pool).toContain('agent_ui_assert_agent_device_bound');
    expect(pool).toContain('agent_ui_pool_reap_orphans');
    expect(pool).toMatch(/trap 'agent_ui_release_lease' EXIT INT TERM HUP/);
    expect(host).toContain('agent_ui_assert_agent_device_bound');
    expect(host).toContain('AGENT_UI_POOL_MAX:=2');
    expect(host).toContain('AGENT_UI_LOCK_WAIT_SECS:=0}');
    expect(host).toContain('AGENT_UI_DEVICE_LAUNCH_BUDGET_SECS:=30');
    expect(host).toContain('AGENT_UI_SKIP_LEASE');
    expect(host).toContain('AGENT_UI_LOCK_WAIT_SECS');
    expect(host).toContain('AGENT_UI_LOCK_DIR');
    expect(host).toMatch(
      /if \[\[ "\$\{AGENT_UI_SKIP_LEASE:-0\}" != "1" \]\]; then[\s\S]*?agent_ui_ensure_lease/,
    );
    // Fresh pool slots: heal may boot without install — fall through to clone.
    expect(host).toContain('agent_ui_pool_ensure_app_installed');
    expect(host).toContain('Fall through to clone/launch');
    // H21: cold boot must not burn ensure-packager reconnect before launch.
    expect(host).toContain('AGENT_UI_PACKAGER_SKIP_RECONNECT=1');
    expect(host).toContain('booting device');
    expect(host).toContain('agent_ui_soft_reconnect_dev_client');
    expect(host).toContain('agent_ui_device_host_responds');
    expect(host).toContain('agent_ui_restart_device');
    expect(host).toContain('AGENT_UI_DEVICE_RESPOND_SECS');
    expect(host).toContain('AGENT_UI_ANDROID_BRIDGE_WAIT_SECS');
    expect(host).toContain('AGENT_UI_ANDROID_WARM_BRIDGE_WAIT_SECS');
    expect(host).toContain('AGENT_UI_IOS_WARM_BRIDGE_WAIT_SECS');
    expect(host).toContain('Android app running but bridge quiet');
    expect(host).toContain('iOS app running but bridge quiet');
    expect(host).toContain('iOS bridge quiet but recently ok');
    expect(host).toContain('assuming down, restarting');
    expect(host).toContain('agent_ui_write_slot_pin');
    expect(host).toContain('agent_ui_pin_android_serial');
    expect(host).toContain('never talk to Galaxy_S26');
    expect(pool).toContain('agent_ui_pool_clone_ios_app');
    // Untimed install wedges when orphaned simctl io owns CoreSimulator.
    expect(pool).toContain('ios_simctl_timed 90 install');
    expect(pool).not.toMatch(/^\s*xcrun simctl install /m);
    expect(pool).toContain('agent_ui_pool_clone_android_app');
    // A stale release APK starts but cannot mount the dev-only agent bridge.
    // Pool checks must require a debuggable app and replace only the agent AVD.
    expect(host).toMatch(
      /agent_ui_app_installed\(\)[\s\S]*?pm path[\s\S]*?run-as "\$BUNDLE_ID" true/,
    );
    expect(ensure).toMatch(
      /app_installed\(\)[\s\S]*?pm path[\s\S]*?run-as "\$BUNDLE_ID" true/,
    );
    expect(pool).toContain('android/app/build/outputs/apk/debug/app-debug.apk');
    expect(pool).toContain('installing local debug client');
    expect(pool).toMatch(
      /src_serial="\$\([\s\S]*?run-as "\$BUNDLE_ID" true/,
    );
    expect(pool).toContain('-s "$target_serial" uninstall "$BUNDLE_ID"');
    expect(pool).toContain('no debuggable ${BUNDLE_ID} build is available');
    // ensure-packager sources pool.sh without host — clone must resolve ROOT alone.
    expect(pool).toContain('agent_ui_pool_repo_root');

    const verifyBoth = read('scripts/agent-ui-verify-both.sh');
    expect(verifyBoth).toContain('agent-ui-host.sh');
    expect(verifyBoth).toContain('AGENT_UI_LOCK_HELD');
    expect(verifyBoth).toContain('AGENT_UI_SLOT');
    expect(verifyBoth).toContain('AGENT_UI_SKIP_LEASE');
    // H20: shared HMR beacon bump before parallel iOS/Android verify.
    expect(verifyBoth).toContain('ensure-js-fresh --bump-only');
    expect(verifyBoth).toContain('AGENT_UI_EXPECTED_HMR_BEACON');
    // Android side must wait for a fully booted emulator before verify.
    expect(verifyBoth).toContain('android_emu_ensure_ready');
    expect(verifyBoth).toContain('ensuring Android emulator is up and ready');
    expect(verifyBoth).toContain('soft reconnect');
    expect(verifyBoth).toContain('iOS app up but bridge quiet');
    expect(verifyBoth).not.toMatch(/ensure-packager\.sh" --start --android \|\| true/);
    expect(verifyBoth).toMatch(
      /proof_flow_requires_account\(\)[\s\S]*?open-developer/,
    );
    expect(verifyBoth).toContain('requires agent account access');
    expect(verifyBoth).toContain('scripts/agent-ui-login.sh');
    expect(verifyBoth).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    // Cleanup follows a passing proof, so it must not recursively heal/relaunch
    // each platform. A bounded direct release keeps batch close-out finite.
    expect(verifyBoth).toMatch(
      /AGENT_UI_PLATFORM=android[\s\S]*?AGENT_UI_SKIP_APP_UP=1[\s\S]*?AGENT_UI_SKIP_HEAL=1[\s\S]*?WAIT_SECS=5[\s\S]*?agent-ui-devmode\.sh" release/,
    );
    expect(verifyBoth).toMatch(
      /AGENT_UI_PLATFORM=ios[\s\S]*?AGENT_UI_SKIP_APP_UP=1[\s\S]*?AGENT_UI_SKIP_HEAL=1[\s\S]*?WAIT_SECS=5[\s\S]*?agent-ui-devmode\.sh" release/,
    );
    // Agents never touch the user's devices: no headed viewer handoff anywhere,
    // and no adopting a live headed Galaxy for an agent run.
    for (const script of [
      'scripts/agent-ui-verify-both.sh',
      'scripts/agent-ui-verify.sh',
      'scripts/lib/agent-ui-host.sh',
    ]) {
      expect(read(script)).not.toContain('agent_ui_headed_viewer_handoff');
      expect(read(script)).not.toContain('agent_ui_headed_ios_handoff');
      expect(read(script)).not.toContain('agent_ui_headed_android_handoff');
      expect(read(script)).not.toContain('agent_ui_arrange_headed_device_windows');
    }
    expect(verifyBoth).not.toContain('AGENT_UI_SKIP_HEADED_HANDOFF');
    expect(verifyBoth).not.toContain('android_emu_adopt_android_for_headed_host');
    expect(verifyBoth).toContain('No headed viewer handoff');
    // Headed WINDOW=1 still hard-fails alert OCR; headless Agent pool soft-continues.
    expect(host).toContain(
      'iOS system-alert clear failed while headed Simulator is required',
    );
    expect(host).toContain('ONTRACK_IOS_SIMULATOR_WINDOW');
    expect(host).toContain('continuing (bridge is up)');
    const simLib = read('scripts/lib/ios-simulator.sh');
    expect(simLib).toContain('ios_sim_place_window_named');
    expect(simLib).toContain('onTrack\\ Agent*|onTrack_Agent*');
    // Launch budget: 30s, instrumented on both boot waits.
    const launchBudget = read('scripts/lib/device-launch-budget.sh');
    expect(launchBudget).toContain('AGENT_UI_DEVICE_LAUNCH_BUDGET_SECS:=30');
    expect(launchBudget).toContain('device_launch_timer_report');
    expect(simLib).toContain('device-launch-budget.sh');
    expect(simLib).toContain('device_launch_timer_report');

    const emu = read('scripts/lib/android-emulator.sh');
    // Pool kills must be fast (no 20s snapshot save) and peers stay up.
    expect(emu).toContain('ANDROID_EMULATOR_WAIT_TIME_BEFORE_KILL=0');
    expect(emu).toContain('Leaving agent emulator up');
    expect(emu).toContain('Leaving unidentified emulator up (pool)');
    expect(emu).toContain('Shutting down non-agent emulator (pool)');
    expect(emu).toContain('android_emu_discard_default_snapshot');
    expect(emu).toContain('android_emu_regenerate_default_snapshot');
    expect(emu).toContain('went offline before boot_completed');
    expect(emu).toContain('hw.gpu.mode=host');
    expect(emu).toContain('ONTRACK_ANDROID_AGENT_RAM_MB');
    expect(emu).toContain('Shutting down agent emulator (headed');
    expect(emu).toContain('headed ${headed_name} keep needs RAM/GPU');
    expect(emu).toContain('Leaving headed emulator up (user window)');
    expect(emu).toContain('Leaving headed emulator up (live GUI)');
    expect(emu).toContain('android_emu_live_headed_galaxy_name');
    expect(emu).toContain('android-headed.keep');
    expect(emu).toContain('clearing stale headed keep');
    expect(emu).toContain('not running headed');
    expect(emu).toContain('cannot run agent beside GUI');
    expect(emu).toContain('NEVER run agents');
    expect(emu).toContain('Never kill a live headed GUI');
    // Agent AVDs stay silent even if a window is requested.
    expect(emu).toContain('EMU_AGENT');
    expect(emu).toContain('Agent devices stay silent');
    // Adoption of the user's Galaxy is refused while a pool lease is held.
    expect(emu).toMatch(/pool lease[\s\S]*?never adopt|never adopt[\s\S]*?pool/i);
    expect(emu).toContain('device_launch_timer_report');

    // Galaxy must not spoof android bridge status for an Agent AVD.
    expect(host).toContain('agent_ui_app_process_running || return 1');
    expect(verifyBoth).toContain('Android still quiet');
    expect(verifyBoth).toContain('agent_ui_bridge_answers');
    expect(verifyBoth).toContain('ensuring Android emulator is up and ready');

    const bridge = read('scripts/lib/agent_ui_bridge.py');
    expect(bridge).toContain('has_flow_land');
    expect(bridge).toContain('and not has_flow_land');
    expect(bridge).toContain('write-slot-pin');
    // iOS pin file only — Android uses host-port routing (H17).
    expect(bridge).toContain('Documents');
    expect(bridge).toContain('agent-ui-pin.json');
    expect(bridge).not.toContain('write_android_slot_pin_file');

    expect(ensure).toContain('AGENT_UI_SKIP_LEASE=1');
    expect(ensure).toContain('packager_pool_clone_app_if_needed');
    expect(ensure).toContain('Installed ${BUNDLE_ID} onto pool');
    expect(ensure).toContain('packager_write_slot_pin');

    const daemon = read('scripts/lib/agent_ui_daemon.py');
    expect(daemon).toContain('queue_key');
    expect(daemon).toContain('normalize_slot');

    // Functional: two slots can be held at once; a 3rd waits when max=2.
    const script = `
set -euo pipefail
ROOT=${JSON.stringify(root)}
export AGENT_UI_ROOT="$ROOT"
export AGENT_UI_POOL_DIR="$ROOT/.cursor/agent-ui-pool-test"
export AGENT_UI_POOL_MAX=2
export AGENT_UI_LOCK_WAIT_SECS=1
export AGENT_UI_USE_POOL=1
export AGENT_UI_POOL_BIND_DEVICES=0
rm -rf "$AGENT_UI_POOL_DIR"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/agent-ui-host.sh"
test "\${AGENT_UI_LOCK_ACQUIRED:-0}" = "1"
test -n "\${AGENT_UI_SLOT:-}"
test -d "$AGENT_UI_POOL_DIR/\${AGENT_UI_SLOT}.lockdir"
SLOT1="$AGENT_UI_SLOT"
# Nested inherit must not block or steal release duty.
AGENT_UI_POOL_DIR="$AGENT_UI_POOL_DIR" AGENT_UI_POOL_MAX=2 AGENT_UI_POOL_BIND_DEVICES=0 \
AGENT_UI_SLOT="$SLOT1" \
AGENT_UI_LOCK_DIR="$AGENT_UI_LOCK_DIR" AGENT_UI_LOCK_HELD=1 AGENT_UI_LOCK_ACQUIRED=0 \
AGENT_UI_LOCK_WAIT_SECS=1 \
  bash -c 'source "'"$ROOT"'/scripts/lib/agent-ui-host.sh"'
# Sibling claims the other free slot and holds it briefly.
env -u AGENT_UI_SLOT \
  AGENT_UI_POOL_DIR="$AGENT_UI_POOL_DIR" AGENT_UI_POOL_MAX=2 AGENT_UI_USE_POOL=1 \
  AGENT_UI_POOL_BIND_DEVICES=0 \
  AGENT_UI_LOCK_HELD=0 AGENT_UI_LOCK_ACQUIRED=0 AGENT_UI_LOCK_WAIT_SECS=1 \
  bash -c 'source "'"$ROOT"'/scripts/lib/agent-ui-host.sh"; printf %s "$AGENT_UI_SLOT" >"$AGENT_UI_POOL_DIR/slot2"; sleep 2' &
child=$!
sleep 0.3
test -f "$AGENT_UI_POOL_DIR/slot2"
# Hold both slots busy: parent still holds SLOT1; child holds SLOT2.
# Third waiter must fail after LOCK_WAIT_SECS=1.
set +e
env -u AGENT_UI_SLOT \
  AGENT_UI_POOL_DIR="$AGENT_UI_POOL_DIR" AGENT_UI_POOL_MAX=2 AGENT_UI_USE_POOL=1 \
  AGENT_UI_POOL_BIND_DEVICES=0 \
  AGENT_UI_LOCK_HELD=0 AGENT_UI_LOCK_ACQUIRED=0 AGENT_UI_LOCK_WAIT_SECS=1 \
  bash -c 'source "'"$ROOT"'/scripts/lib/agent-ui-host.sh"' 2>/tmp/agent-ui-pool-wait.err
rc=$?
set -e
wait "$child" || true
test "$rc" -ne 0
grep -qE 'agent device slot|device slots are busy' /tmp/agent-ui-pool-wait.err
`;
    execFileSync('bash', ['-c', script], { encoding: 'utf8', timeout: 30_000 });
  });

  it('signs each agent device into its own agent_N account (dev-only, env creds)', () => {
    const creds = read('scripts/lib/agent-credentials.sh');
    const login = read('scripts/agent-ui-login.sh');
    const setup = read('scripts/agent-accounts-setup.sh');
    const bridge = read('scripts/lib/agent_ui_bridge.py');
    const host = read('scripts/lib/agent-ui-host.sh');

    expect(existsSync(join(root, 'scripts/lib/agent_accounts_setup.py'))).toBe(true);
    expect(setup).toContain('agent_accounts_setup.py');
    expect(creds).toContain('agent_creds_account_index');
    expect(creds).toContain('agent_creds_load_account');
    expect(creds).toContain('ONTRACK_AGENT_ACCOUNT_');
    expect(creds).toContain('.env.local');
    expect(login).toContain('agent_creds_load_account');
    expect(login).toContain('agent_ui_send_op login');
    expect(login).toContain('--guest');
    expect(host).toContain('ONTRACK_AGENT_ACCOUNT_PASSWORD_RESOLVED');
    // Passwords only travel by env — never argv (ps / shell history leak).
    expect(bridge).toContain('ONTRACK_AGENT_ACCOUNT_PASSWORD_RESOLVED');
    expect(bridge).not.toContain('"--password"');
    // Synthetic addresses only (no personal identifiers in source).
    for (const text of [creds, login, setup, read('scripts/lib/agent_accounts_setup.py')]) {
      expect(text).not.toMatch(/@(gmail|icloud|outlook|hotmail|yahoo)\./i);
    }

    // Functional: index = (android ? 2 : 0) + slot, and the default email follows.
    const script = `
set -euo pipefail
ROOT=${JSON.stringify(root)}
export AGENT_UI_ROOT="$ROOT"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/agent-credentials.sh"
AGENT_UI_SLOT=1 test "$(AGENT_UI_SLOT=1 agent_creds_account_index ios)" = 1
test "$(AGENT_UI_SLOT=2 agent_creds_account_index ios)" = 2
test "$(AGENT_UI_SLOT=1 agent_creds_account_index android)" = 3
test "$(AGENT_UI_SLOT=2 agent_creds_account_index android)" = 4
# Unleased device resolves no account at all.
if AGENT_UI_SLOT= agent_creds_account_index ios 2>/dev/null; then exit 1; fi
# Shared password fallback + default synthetic email.
(
  export AGENT_UI_SLOT=2 ONTRACK_AGENT_ACCOUNT_PASSWORD=test-only
  agent_creds_load_account android
  test "$ONTRACK_AGENT_ACCOUNT_INDEX" = 4
  test "$ONTRACK_AGENT_ACCOUNT_EMAIL" = "agent_4@example.com"
)
# No password anywhere → caller must skip sign-in, not fail hard.
if ( export AGENT_UI_SLOT=1; unset ONTRACK_AGENT_ACCOUNT_PASSWORD; agent_creds_load_account ios ); then
  exit 1
fi
echo "agent account creds ok"
`;
    const out = execFileSync('bash', ['-c', script], {
      encoding: 'utf8',
      timeout: 30_000,
      env: { ...process.env, HOME: '/tmp' },
    });
    expect(out).toContain('agent account creds ok');
  });

  it('verification entry points gate on app-up before bridge work', () => {
    for (const script of [
      'scripts/agent-ui.sh',
      'scripts/agent-ui-verify.sh',
      'scripts/agent-ui-assert.sh',
      'scripts/agent-ui-flow.sh',
      'scripts/agent-ui-open.sh',
      'scripts/agent-ui-batch.sh',
      'scripts/agent-ui-seed.sh',
    ]) {
      expect(read(script)).toContain('agent_ui_ensure_app_up');
    }
    // Low-level probes must not recurse through app-up (heal/preflight uses them).
    for (const script of [
      'scripts/agent-ui-route.sh',
      'scripts/agent-ui-tap.sh',
      'scripts/agent-ui-exists.sh',
      'scripts/agent-ui-dump.sh',
      'scripts/agent-ui-wait.sh',
      'scripts/agent-ui-goto.sh',
    ]) {
      expect(read(script)).not.toContain('agent_ui_ensure_app_up');
    }
  });

  it('Android readiness requires boot_completed and a real route (not allow_fail timeout)', () => {
    const emu = read('scripts/lib/android-emulator.sh');
    const host = read('scripts/lib/agent-ui-host.sh');
    const route = read('scripts/agent-ui-route.sh');
    const packager = read('scripts/ensure-packager.sh');
    expect(emu).toContain('android_emu_is_ready');
    expect(emu).toContain('android_emu_ensure_ready');
    expect(emu).toContain('sys.boot_completed');
    expect(host).toContain('android_emu_is_ready');
    expect(host).toContain('android_emu_ensure_ready');
    expect(host).toContain('Android emulator not ready');
    expect(host).toContain('Requires ok=true + non-empty route');
    expect(route).toContain('d.get("ok") and route');
    expect(route).toContain('allow_fail');
    expect(packager).toContain('android_emu_is_ready');
  });

  it('batch/flow/seed/assert/once scripts support fixtures and asserts', () => {
    const batch = read('scripts/agent-ui-batch.sh');
    const flow = read('scripts/agent-ui-flow.sh');
    const seed = read('scripts/agent-ui-seed.sh');
    const assertScript = read('scripts/agent-ui-assert.sh');
    const once = read('scripts/agent-ui.sh');
    expect(batch).toContain('batch-args');
    expect(batch).toContain('agent_ui_send_op batch');
    expect(batch).toContain('agent_ui_apply_wait_budget');
    expect(batch).not.toMatch(/python3 -c.*goto/);
    expect(flow).toContain('agent_ui_send_op flow');
    expect(flow).toContain('agent_ui_apply_wait_budget');
    expect(flow).toContain('travel-demo');
    expect(seed).toContain('agent_ui_send_op seed');
    expect(assertScript).toContain('batch-args');
    expect(assertScript).toContain('--assert-route');
    expect(assertScript).toContain('--color');
    expect(assertScript).toContain("passed' if ok else 'failed");
    expect(once).toContain('once');
    expect(once).toContain('verify');
    expect(once).toContain('agent_ui_bridge.py');
    expect(once).toContain('agent-ui-assert.sh');
    expect(once).toContain('agent-ui-verify.sh');
    const verify = read('scripts/agent-ui-verify.sh');
    const bridgePy = read('scripts/lib/agent_ui_bridge.py');
    expect(verify).toContain('verify');
    expect(verify).toContain('skippedLand');
    expect(bridgePy).toContain('run_verify');
    expect(bridgePy).toContain('assert-color');
    expect(bridgePy).toContain('resolve_test_id');
    const idsPy = read('scripts/lib/agent_ui_ids.py');
    expect(idsPy).toContain('_canonicalize_travel_home_namespace');
    expect(idsPy).toContain('travel.home.');
    expect(idsPy).toContain('travel.list.');
    // Colloquial Travel Home asserts must resolve to stamped list wire ids.
    const resolveHome = [
      'import importlib.util, sys',
      `spec = importlib.util.spec_from_file_location("ids", ${JSON.stringify(
        `${root}/scripts/lib/agent_ui_ids.py`,
      )})`,
      'm = importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(m)',
      `root = ${JSON.stringify(root)}`,
      'from pathlib import Path',
      'r = Path(root)',
      'assert m.resolve_test_id("travel.home.section.yourTrips", root=r) == "ontrack.travel.list.section.yourTrips"',
      'assert m.resolve_test_id("ontrack.travel.home.section.yourTrips", root=r) == "ontrack.travel.list.section.yourTrips"',
      'assert m.resolve_test_id("travel.home.sectionYourTrips", root=r) == "ontrack.travel.list.section.yourTrips"',
      'print("travel.home resolve ok")',
    ].join('\n');
    const resolveHomeOut = execFileSync('python3', ['-c', resolveHome], {
      encoding: 'utf8',
    }).trim();
    expect(resolveHomeOut).toContain('travel.home resolve ok');
    // Android cold boot wakes on `/` — auto-land + one retry, never assert-only.
    // Any platform on the wrong surface with bare --route also auto-gotos (no thrash).
    expect(bridgePy).toContain('_android_cold_root');
    expect(bridgePy).toContain('auto-landing via goto');
    expect(bridgePy).toContain('auto-landed via goto');
    expect(bridgePy).toContain('auto_land');
    expect(bridgePy).toContain('retrying land');
    expect(bridgePy).toContain('AGENT_UI_ANDROID_FORCE_LAND');
    expect(bridgePy).toContain('--wait-route');
    expect(bridgePy).toContain('normalize_route_path');
    expect(bridgePy).toContain('must NOT match');
    expect(bridgePy).toMatch(
      /No explicit land — skip only when already on the wanted surface/,
    );
    const verifyBoth = read('scripts/agent-ui-verify-both.sh');
    const hostSh = read('scripts/lib/agent-ui-host.sh');
    const agentUiSh = read('scripts/agent-ui.sh');
    expect(verifyBoth).toContain('AGENT_UI_ANDROID_FORCE_LAND');
    expect(verifyBoth).toContain('Android on / (cold boot)');
    // Soft-reconnect before peer emu kill; heartbeats on cold packager ensure.
    expect(verifyBoth).toContain('Android still quiet');
    expect(verifyBoth).toContain('still ensuring Android packager/app');
    expect(verifyBoth).toContain('Android warm path ok');
    // Epilogue parsed before long iOS/Android work (mid-edit offset safety).
    expect(verifyBoth).toMatch(
      /finish_verify_both\(\)[\s\S]*?set \+e[\s\S]*?run_ios[\s\S]*?finish_verify_both/,
    );
    // Default dual close-out is parallel (daemon platform:slot FIFOs); serial escape.
    expect(verifyBoth).toContain('parallel iOS + Android');
    expect(verifyBoth).toContain('AGENT_UI_VERIFY_SERIAL');
    expect(verifyBoth).toMatch(/run_ios &\s*\n\s*ios_pid=/);
    expect(verifyBoth).toMatch(/run_android &\s*\n\s*android_pid=/);
    expect(verifyBoth).toContain('do NOT pipe this script through `tail`');
    expect(verifyBoth).toContain('agent_ui_refuse_piped_head_tail');
    expect(verifyBoth).toMatch(/-h\|--help\) usage/);
    expect(hostSh).toContain('agent_ui_refuse_piped_head_tail');
    expect(hostSh).toContain('AGENT_UI_ALLOW_PIPED_TAIL');
    expect(hostSh).toContain('piped through head/tail');
    // Per-entry-line match via $0; pipe must follow entry (`script | tail`),
    // not a sibling `jest | tail && script` (false-positive abort).
    expect(hostSh).toContain('entry_base');
    expect(hostSh).toContain('basename "${0:-}"');
    expect(hostSh).toContain('util_h');
    expect(hostSh).toContain('Sibling `jest | tail && script`');
    // bash: grep -Eq "${entry_base}"'.*\|[[:space:]]…'
    expect(hostSh).toContain('"${entry_base}"' + "'.*\\|");
    expect(hostSh).not.toMatch(/\*"\|"\*head\*/);
    // Refuse pipes before auto-lease on source (silent hang root cause).
    expect(hostSh).toMatch(
      /agent_ui_refuse_piped_head_tail[\s\S]*?agent_ui_ensure_lease/,
    );
    // Help must run before sourcing host (source auto-leases).
    expect(agentUiSh).toMatch(
      /Help must run BEFORE sourcing host[\s\S]*?source[\s\S]*agent-ui-host\.sh/,
    );
    expect(agentUiSh).toContain('once" || "${1}" == "verify"');

    // /travel must not match trip detail (false skip → agent redo loops).
    const routeScript = [
      'import importlib.util, sys',
      `spec = importlib.util.spec_from_file_location("bridge", ${JSON.stringify(
        `${root}/scripts/lib/agent_ui_bridge.py`,
      )})`,
      'm = importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(m)',
      'assert m.route_matches("/travel", "/travel")',
      'assert m.route_matches("/(tabs)/travel", "/travel")',
      'assert m.route_matches("/travel/", "/travel")',
      'assert not m.route_matches("/travel/trip-agent-ui-demo", "/travel")',
      'assert not m.route_matches("/travel", "/travel/trip-agent-ui-demo")',
      'assert m.route_matches("/travel/trip-x", "/travel/trip-x")',
      'print("route_matches ok")',
    ].join('\n');
    const routeOut = execFileSync('python3', ['-c', routeScript], {
      encoding: 'utf8',
      timeout: 15_000,
    });
    expect(routeOut).toContain('route_matches ok');

    const skill = read('.cursor/skills/agent-ui/SKILL.md');
    expect(skill).toMatch(/Never `\| tail`/);
    expect(skill).toContain('open-new-trip');
    expect(skill).toContain('mass-kill emulators');
  });
});
