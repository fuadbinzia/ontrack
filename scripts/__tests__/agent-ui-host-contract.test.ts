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

  it('claims a dedicated agent device pool slot (max 5) across entry points', () => {
    const host = read('scripts/lib/agent-ui-host.sh');
    const pool = read('scripts/lib/agent-ui-pool.sh');
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
    expect(pool).toContain('AGENT_UI_KEEP_IOS');
    expect(pool).toContain('AGENT_UI_KEEP_ANDROID');
    expect(pool).toContain('agent_ui_pool_keep_ios');
    expect(pool).toContain('agent_ui_pool_keep_android');
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
    expect(host).toContain('AGENT_UI_SKIP_LEASE');
    expect(host).toContain('AGENT_UI_LOCK_WAIT_SECS');
    expect(host).toContain('AGENT_UI_LOCK_DIR');
    expect(host).toMatch(
      /if \[\[ "\$\{AGENT_UI_SKIP_LEASE:-0\}" != "1" \]\]; then[\s\S]*?agent_ui_ensure_lease/,
    );
    // Fresh pool slots: heal may boot without install — fall through to clone.
    expect(host).toContain('agent_ui_pool_ensure_app_installed');
    expect(host).toContain('Fall through to clone/launch');
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
    // ensure-packager sources pool.sh without host — clone must resolve ROOT alone.
    expect(pool).toContain('agent_ui_pool_repo_root');

    const verifyBoth = read('scripts/agent-ui-verify-both.sh');
    expect(verifyBoth).toContain('agent-ui-host.sh');
    expect(verifyBoth).toContain('AGENT_UI_LOCK_HELD');
    expect(verifyBoth).toContain('AGENT_UI_SLOT');
    expect(verifyBoth).toContain('AGENT_UI_SKIP_LEASE');
    // Android side must wait for a fully booted emulator before verify.
    expect(verifyBoth).toContain('android_emu_ensure_ready');
    expect(verifyBoth).toContain('ensuring Android emulator is up and ready');
    expect(verifyBoth).toContain('soft reconnect');
    expect(verifyBoth).toContain('iOS app up but bridge quiet');
    expect(verifyBoth).not.toMatch(/ensure-packager\.sh" --start --android \|\| true/);
    // Headed Simulator open → handoff preferred Pro (not stale Agent N window).
    expect(verifyBoth).toContain('agent_ui_headed_viewer_handoff');
    // Dual-run children must not mid-handoff Galaxy (looks hung after iOS ok).
    expect(verifyBoth).toContain('AGENT_UI_SKIP_HEADED_HANDOFF=1');
    // Pool ignores sticky keep when GUI closed; live headed Galaxy adopts.
    expect(verifyBoth).toContain('sticky headed keep ignored');
    expect(verifyBoth).toContain('ONTRACK_ANDROID_KEEP_HEADED=0');
    expect(verifyBoth).toContain('live headed');
    expect(verifyBoth).toContain('not killing user window');
    expect(verifyBoth).toContain('android_emu_live_headed_galaxy_name');
    expect(host).toContain('agent_ui_headed_ios_handoff');
    expect(host).toContain('headed viewer handoff');
    expect(host).toContain('AGENT_UI_SKIP_HEADED_HANDOFF');
    expect(host).toContain('Never re-run --flow here');
    expect(host).toContain('not cold-booting');
    expect(host).toContain('agents stay warm');
    // Ready check BEFORE adopt — never "adopting" then "skipped".
    expect(host).toMatch(
      /agent_ui_headed_android_handoff\(\)[\s\S]*?android_emu_avd_is_ready_named[\s\S]*?android_emu_adopt_android_for_headed_host/,
    );
    // Android handoff must not SurfaceView-heal (≤25s) after verify already passed.
    expect(host).toContain('Never call android_emu_ensure_app_surface here');
    expect(host).toContain('AGENT_UI_HEADED_ANDROID_HANDOFF_SECS');
    expect(host).not.toMatch(
      /agent_ui_headed_android_handoff\(\)[\s\S]*?\bandroid_emu_ensure_app_surface\b(?! here)/,
    );
    // Lease sets ONTRACK_IOS_SIMULATOR=Agent N — handoff must use viewer name.
    expect(host).toContain('ios_sim_viewer_name');
    expect(host).toContain('ONTRACK_IOS_SIMULATOR_UDID=');
    expect(host).not.toMatch(
      /agent_ui_headed_ios_handoff\(\)[\s\S]*?name="\$\(ios_sim_preferred_name\)"/,
    );
    // Soft reconnect first — hard terminate races Fabric BlurView remounts.
    expect(host).toContain('Prefer soft reconnect');
    expect(host).toContain('app context has been lost');
    expect(host).toMatch(
      /agent_ui_headed_ios_handoff\(\)[\s\S]*?agent_ui_soft_reconnect_dev_client[\s\S]*?simctl terminate/,
    );
    // Headed WINDOW=1 still hard-fails alert OCR; headless Agent pool soft-continues.
    expect(host).toContain(
      'iOS system-alert clear failed while headed Simulator is required',
    );
    expect(host).toContain('ONTRACK_IOS_SIMULATOR_WINDOW');
    expect(host).toContain('continuing (bridge is up)');
    // Headed layout: Android left, iOS right.
    expect(host).toContain('agent_ui_arrange_headed_device_windows');
    expect(host).toContain('ios_sim_place_window_named');
    expect(host).toContain('android_emu_place_window left');
    const simLib = read('scripts/lib/ios-simulator.sh');
    expect(simLib).toContain('ios_sim_focus_window_named');
    expect(simLib).toContain('ios_sim_place_window_named');
    expect(simLib).toContain('ios_sim_viewer_name');
    expect(simLib).toContain('onTrack\\ Agent*|onTrack_Agent*');
    expect(read('scripts/agent-ui-verify.sh')).toContain('agent_ui_headed_viewer_handoff');

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
    expect(emu).toContain('android_emu_adopt_android_for_headed_host');
    expect(emu).toContain('adopting headed');
    expect(emu).toContain('cannot run agent beside GUI');
    expect(emu).toContain('NEVER run agents');
    expect(emu).toContain('Never kill a live headed GUI');

    // Galaxy must not spoof android bridge status for an Agent AVD.
    expect(host).toContain('agent_ui_app_process_running || return 1');
    expect(verifyBoth).toContain('Android still quiet');
    expect(verifyBoth).toContain('agent_ui_bridge_answers');
    expect(verifyBoth).toContain('android_emu_adopt_android_for_headed_host');
    expect(verifyBoth).toContain('ensuring Android emulator is up and ready');

    const bridge = read('scripts/lib/agent_ui_bridge.py');
    expect(bridge).toContain('has_flow_land');
    expect(bridge).toContain('and not has_flow_land');
    expect(bridge).toContain('write_android_slot_pin_file');
    expect(bridge).toContain('write-slot-pin');
    expect(bridge).toContain('files/agent-ui-pin.json');

    const ensure = read('scripts/ensure-packager.sh');
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

  it('headed Android handoff heals blank SurfaceView before finish_app_up', () => {
    const emu = read('scripts/lib/android-emulator.sh');
    const host = read('scripts/lib/agent-ui-host.sh');
    const surface = read('scripts/lib/android_emu_surface.py');
    expect(emu).toContain('android_emu_ensure_app_surface');
    expect(emu).toContain('android_emu_mark_ready');
    expect(emu).toContain('Relaunching');
    expect(emu).toContain('blank/white SurfaceView');
    expect(host).toContain('android_emu_want_app_surface');
    expect(host).toContain('android_emu_ensure_app_surface');
    expect(host).toContain('app surface still blank/white');
    expect(surface).toContain('near_white_pct');
    expect(surface).toContain('is-blank');

    // Functional: pure white PNG is blank; cream travel-home tone is not.
    const surfacePy = join(root, 'scripts/lib/android_emu_surface.py');
    const script = [
      'from pathlib import Path',
      'import tempfile',
      'from PIL import Image',
      'import importlib.util',
      'spec = importlib.util.spec_from_file_location("android_emu_surface", ' +
        JSON.stringify(surfacePy) +
        ')',
      'mod = importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(mod)',
      'td = tempfile.mkdtemp()',
      'white = Path(td) / "white.png"',
      'cream = Path(td) / "cream.png"',
      'Image.new("RGB", (64, 64), (255, 255, 255)).save(white)',
      'Image.new("RGB", (64, 64), (231, 220, 204)).save(cream)',
      'assert mod.near_white_pct(white.read_bytes()) >= 85',
      'assert mod.near_white_pct(cream.read_bytes()) < 85',
    ].join('\n');
    execFileSync('python3', ['-c', script], { encoding: 'utf8', timeout: 15_000 });
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
