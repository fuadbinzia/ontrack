import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8');
}

describe('metro launch command contract', () => {
  it('routes npm start family through the shared start-metro launcher', () => {
    const pkg = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts.start).toBe('bash ./scripts/start-metro.sh');
    expect(pkg.scripts['start:clear']).toBe('bash ./scripts/start-metro.sh --clear');
    expect(pkg.scripts.ios).toBe('bash ./scripts/start-metro.sh --ios');
    expect(pkg.scripts.android).toBe('bash ./scripts/start-metro.sh --android');
    expect(pkg.scripts.web).toBe('bash ./scripts/start-metro.sh --web');

    for (const script of [
      pkg.scripts.start,
      pkg.scripts['start:clear'],
      pkg.scripts.ios,
      pkg.scripts.android,
      pkg.scripts.web,
    ]) {
      expect(script).not.toMatch(/--localhost/);
    }
  });

  it('binds with --lan and advertises REACT_NATIVE_PACKAGER_HOSTNAME', () => {
    const launcher = read('scripts/start-metro.sh');

    expect(launcher).toMatch(/expo start --lan/);
    expect(launcher).toContain('REACT_NATIVE_PACKAGER_HOSTNAME');
    expect(launcher).toContain('127.0.0.1');
    expect(launcher).toMatch(/Do not pass Expo `--localhost`/);
    expect(launcher).not.toMatch(/expo start[^\n]*--localhost/);
  });

  it('ensure-packager starts Metro via the shared launcher and detects IPv6-only', () => {
    const ensure = read('scripts/ensure-packager.sh');

    expect(ensure).toContain('scripts/start-metro.sh');
    expect(ensure).toContain('START_METRO_SH');
    expect(ensure).toContain('is_ipv6_only_metro');
    expect(ensure).toContain('Metro is bound to IPv6 only.');
    expect(ensure).toContain('print_packager_diagnostics');
    expect(ensure).toContain('stop_repo_metro_listeners');
    expect(ensure).toContain('pid_belongs_to_repo');
    expect(ensure).toContain('START_WAIT_SECS="${START_WAIT_SECS:-20}"');
    expect(ensure).not.toMatch(/nohup npm start/);
    expect(ensure).toContain('start_new_session=True');
    expect(ensure).toContain('Metro detached (new session)');
  });

  it('keeps Watchman hybrid crawl/watch and refuses dead subscriptions', () => {
    const metroConfig = read('metro.config.js');
    expect(metroConfig).toMatch(/resolver\.useWatchman\s*=\s*null/);
    expect(metroConfig).toMatch(/patch-expo-metro-watchman/);
    expect(metroConfig).toMatch(/healthCheck/);
    expect(metroConfig).toMatch(/enabled:\s*true/);

    const watchmanConfig = JSON.parse(read('.watchmanconfig')) as {
      ignore_dirs?: string[];
    };
    expect(watchmanConfig.ignore_dirs ?? []).toContain('node_modules');

    const patch = read('scripts/patch-expo-metro-watchman.sh');
    expect(patch).toContain('forceNodeFilesystemAPI');
    expect(patch).toContain('ontrack-watchman-hybrid');
    expect(patch).toContain('ontrack-node-crawl-hybrid');
    expect(patch).toContain('createFileMap-fork');

    const watcherLib = read('scripts/lib/metro-watcher.sh');
    expect(watcherLib).toContain('metro_has_watchman_client');
    expect(watcherLib).toContain('metro_watcher_healthy');
    expect(watcherLib).toContain('metro_entry_resolves');
    expect(watcherLib).toContain('metro_subscription_live');
    expect(watcherLib).toContain('ensure_metro_hmr_beacon_probe_file');

    const beaconEnsure = read('scripts/ensure-metro-hmr-beacon.sh');
    expect(beaconEnsure).toContain('metro-hmr-beacon.ts');
    expect(read('.gitignore')).toContain('src/utils/dev/metro-hmr-beacon.ts');

    const ensure = read('scripts/ensure-packager.sh');
    expect(ensure).toContain('metro-watcher.sh');
    expect(ensure).toContain('ensure_metro_watcher');
    expect(ensure).toContain('CURSOR_AGENT');

    const launcher = read('scripts/start-metro.sh');
    expect(launcher).toContain('patch-expo-metro-watchman.sh');
    expect(launcher).toContain('wait_for_watchman');
  });

  it('reconnects the dev client whenever this run (re)launched Metro', () => {
    // A new Metro process orphans the app's HMR socket while the agent-ui
    // bridge (plain HTTP) keeps answering — probe_connected is a false
    // positive after a relaunch and must not short-circuit the reconnect.
    const ensure = read('scripts/ensure-packager.sh');
    expect(ensure).toContain('METRO_RELAUNCHED=0');
    expect(ensure).toContain('METRO_RELAUNCHED=1');
    expect(ensure).toMatch(/METRO_RELAUNCHED.*==\s*"1"[\s\S]*?reconnect_dev_client/);
  });

  it('heals a persisted Fast Refresh-off dev client toggle', () => {
    // RCTDevMenu.hotLoadingEnabled=0 persists per install and silently
    // disables HMR regardless of Metro/Watchman health.
    const ensure = read('scripts/ensure-packager.sh');
    expect(ensure).toContain('ensure_fast_refresh_enabled');
    expect(ensure).toContain('hotLoadingEnabled = 0');
    expect(ensure).toMatch(/defaults write "\$BUNDLE_ID" RCTDevMenu -dict-add hotLoadingEnabled -bool YES/);
  });

  it("live probe trusts Metro's watchman health check, not subscription since", () => {
    // debug-get-subscriptions reports the *initial* since only; requiring it
    // to advance made every ensure run falsely report a dead watcher.
    const watcherLib = read('scripts/lib/metro-watcher.sh');
    expect(watcherLib).toContain('metro_recent_health_check_ok');
    expect(watcherLib).toMatch(/Health check result/);
    expect(watcherLib).toMatch(/never required/);
  });

  it('hooks and agent-ui heal keep Metro alive across agent shells', () => {
    const hooks = JSON.parse(read('.cursor/hooks.json')) as {
      hooks: Record<string, Array<{ command: string }>>;
    };
    expect(hooks.hooks.sessionStart?.[0]?.command).toContain('ensure-packager-session.sh');
    expect(hooks.hooks.beforeShellExecution?.[0]?.command).toContain('block-shell-tied-metro.sh');

    // sessionStart must not open Simulator — only Metro keep-alive.
    const sessionHook = read('.cursor/hooks/ensure-packager-session.sh');
    expect(sessionHook).toContain('--metro-only');
    expect(sessionHook).not.toMatch(/ensure-packager\.sh" --start\s*$/);

    const ensure = read('scripts/ensure-packager.sh');
    expect(ensure).toContain('--metro-only');
    expect(ensure).toContain('Metro-only: skipping device boot/reconnect');
    // Pool heal used to exit 0 with "app not installed" and leave verify broken.
    expect(ensure).toContain('packager_pool_clone_app_if_needed');
    expect(ensure).toContain('agent_ui_pool_clone_ios_app');

    const host = read('scripts/lib/agent-ui-host.sh');
    expect(host).toContain('agent_ui_heal_packager');
    expect(host).toContain('AGENT_UI_SKIP_HEAL');
    expect(host).toContain('agent_ui_pool_ensure_app_installed');
    expect(host).toContain('agent_ui_soft_reconnect_dev_client');

    const open = read('scripts/agent-ui-open.sh');
    expect(open).toContain('agent_ui_heal_packager');
  });

  it('boots preferred simulator headless; GUI window is opt-in only', () => {
    const sim = read('scripts/lib/ios-simulator.sh');
    expect(sim).toContain('ONTRACK_IOS_SIMULATOR:=onTrack iPhone 17 Pro');
    expect(sim).toContain('ONTRACK_IOS_SIMULATOR_DEVICE_TYPE:=com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro');
    expect(sim).toContain('ios_sim_ensure_device_exists');
    expect(sim).toContain('ios_sim_latest_ios_runtime');
    expect(sim).toContain('ONTRACK_IOS_SIMULATOR_WINDOW:=0');
    expect(sim).toContain('ios_sim_want_window');
    expect(sim).toContain('ios_sim_pool_mode');
    expect(sim).toContain('ios_sim_target');
    expect(sim).toContain('Booting preferred simulator (headless)');
    // Window open is gated — never unconditional open in ensure_preferred.
    expect(sim).toMatch(/if ios_sim_want_window; then[\s\S]*?ios_sim_open_focused/);
    expect(sim).toContain('-CurrentDeviceUDID');
    expect(sim).toContain('ios_sim_prune_peers_briefly');
    // Coexist with user's headed Simulator: auto-minimize agents, pin if user opens one.
    expect(sim).toContain('ios_sim_park_agent_windows');
    expect(sim).toContain('ios_sim_enforce_agent_headless_gui');
    expect(sim).toContain('ios_sim_start_agent_gui_reaper');
    expect(sim).toContain('ios_sim_open_agent_headed');
    expect(sim).toContain('ios_sim_mark_agent_headed');
    expect(sim).toContain('ios_sim_shutdown_agent_named');
    expect(sim).toContain('headed-agents');
    expect(sim).toContain('AXMinimizeButton');
    expect(sim).toContain('onTrack Agent');
    // Explicit open places the window on the right (Android owns left).
    expect(sim).toContain('ios_sim_place_window_named');
    expect(sim).toContain('ios_sim_center_agent_window_named');
    expect(sim).toContain('dLeft + dW - winW - margin');
    expect(sim).toContain('AXPress');
    expect(sim).toContain('UI element "${safe}" of list 1');
    expect(sim).not.toContain('ios_sim_quit_gui');
    expect(sim).not.toContain('killall Simulator');

    const alerts = read('scripts/lib/ios_system_alert.py');
    expect(alerts).toContain('restore_headless_gui');
    expect(alerts).toContain('_preferred_boot_udid');
    expect(alerts).toContain('ONTRACK_IOS_SIMULATOR_UDID');
    expect(alerts).toContain('ios_sim_enforce_agent_headless_gui');
    // May quit only when *we* opened Simulator for sheet dismiss — never as default headless.
    expect(alerts).toContain('opened only for sheet dismiss');
  });

  it('pre-approves iOS URL schemes so openurl skips Open-in confirmation', () => {
    // SpringBoard "Open in \"onTrack\"?" blocks reconnect until tapped.
    // Mirror Expo CLI: write LaunchServices schemeapproval before boot/openurl.
    const sim = read('scripts/lib/ios-simulator.sh');
    expect(sim).toContain('ios_sim_approve_url_schemes');
    expect(sim).toContain('com.apple.launchservices.schemeapproval.plist');
    expect(sim).toContain('com.apple.CoreSimulator.CoreSimulatorBridge-->');
    expect(sim).toContain('exp+ontrack');
    expect(sim).toMatch(/ios_sim_approve_url_schemes "\$udid"/);
    expect(sim).toContain('Rebooting simulator so URL scheme approval takes effect');

    const ensure = read('scripts/ensure-packager.sh');
    expect(ensure).toContain('ios_sim_approve_url_schemes');
    expect(ensure).toContain('ios_system_alert.py');

    const host = read('scripts/lib/agent-ui-host.sh');
    expect(host).toContain('ios_sim_approve_url_schemes');

    const pool = read('scripts/lib/agent-ui-pool.sh');
    expect(pool).toContain('ios_sim_approve_url_schemes');

    const ocr = read('scripts/lib/ios_ocr_alert.swift');
    expect(ocr).toContain('"open in"');
    expect(ocr).toContain('acceptNeedles');
    // Location permission — Allow While Using App (never Don't Allow).
    expect(ocr).toContain('use your location');
    expect(ocr).toContain('allow while using app');
    // Expo developer-menu intro — Continue; tools sheet — Escape.
    expect(ocr).toContain('developer menu');
    expect(ocr).toContain('"continue"');
    expect(ocr).toContain('fast refresh');
    expect(ocr).toContain('toggle performance monitor');

    const alerts = read('scripts/lib/ios_system_alert.py');
    expect(alerts).toContain('OPEN_IN_PHRASES');
    expect(alerts).toContain('ACCEPT_PRIORITY');
    expect(alerts).toContain('_is_open_in_prompt');
    expect(alerts).toContain('LOCATION_PHRASES');
    expect(alerts).toContain('LOCATION_ACCEPT_PRIORITY');
    expect(alerts).toContain('_is_location_prompt');
    expect(alerts).toContain('allow while using app');
    expect(alerts).toContain('DEV_MENU_PHRASES');
    expect(alerts).toContain('DEV_MENU_TOOLS_PHRASES');
    expect(alerts).toContain('DEV_MENU_ACCEPT_PRIORITY');
    expect(alerts).toContain('_is_dev_menu_prompt');
    expect(alerts).toContain('_is_dev_menu_tools');
    expect(alerts).toContain('dismissing Expo Dev Menu (Escape)');
  });

  it('times out wedged simctl RPCs and serializes ensure-packager device ops', () => {
    // Unbounded get_app_container / terminate / launch wedges CoreSimulator and
    // freezes Simulator.app when overlapping agents pile up.
    const sim = read('scripts/lib/ios-simulator.sh');
    expect(sim).toContain('ios_simctl_timed');
    expect(sim).toContain('ONTRACK_SIMCTL_TIMEOUT_SECS:=10');
    expect(sim).toContain('alarm shift @ARGV');

    const ensure = read('scripts/ensure-packager.sh');
    expect(ensure).toContain('ios_simctl_timed get_app_container');
    expect(ensure).toContain('acquire_packager_lock');
    expect(ensure).toContain('ensure-packager.lockdir');
    expect(ensure).not.toMatch(
      /xcrun simctl get_app_container booted "\$BUNDLE_ID"/,
    );

    const host = read('scripts/lib/agent-ui-host.sh');
    expect(host).toContain('agent_ui_ios_lib');
    expect(host).toContain('ios_simctl_timed get_app_container');

    const bridge = read('scripts/lib/agent_ui_bridge.py');
    expect(bridge).toContain('SIMCTL_TIMEOUT_SECS');
    expect(bridge).toContain('TimeoutExpired');
    expect(bridge).toContain('timeout=SIMCTL_TIMEOUT_SECS');
  });

  it('boots preferred Android emulator headless; GUI window is opt-in only', () => {
    const emu = read('scripts/lib/android-emulator.sh');
    expect(emu).toContain('ONTRACK_ANDROID_AVD:=Galaxy_S26');
    expect(emu).toContain('ONTRACK_ANDROID_EMULATOR_WINDOW:=0');
    expect(emu).toContain('android_emu_want_window');
    // Headed GUI snaps to the left of the main display (iOS on the right).
    expect(emu).toContain('android_emu_place_window');
    expect(emu).toContain('android_emu_place_window left');
    expect(emu).toContain('android_emu_pool_mode');
    expect(emu).toContain('android_emu_ensure_agent_avd');
    expect(emu).toContain('onTrack_Agent_');
    expect(emu).toContain('Booting preferred emulator (${mode}');
    expect(emu).toContain('-no-window');
    expect(emu).toContain('no-boot-anim');
    expect(emu).toContain('hw.keyboard');
    expect(emu).toContain('android_emu_ensure_hw_keyboard');
    expect(emu).toContain('android_emu_ensure_avd_runtime_config');
    expect(emu).toContain('hw.gpu.enabled');
    expect(emu).toContain('android_emu_sync_avd_config_from_template');
    expect(emu).toContain('-no-snapshot-load');
    expect(emu).toContain('-no-snapshot-save');
    expect(emu).toContain('stuck before boot_completed');
    expect(emu).toContain('android_emu_discard_default_snapshot');
    expect(emu).toContain('android_emu_regenerate_default_snapshot');
    expect(emu).toContain('post-cold heal');
    expect(emu).toContain('android_emu_clear_stale_locks');
    expect(emu).toContain('went offline before boot_completed');
    expect(emu).toContain('Leaving agent emulator up');
    expect(emu).toContain('Leaving unidentified emulator up (pool)');
    expect(emu).toContain('Shutting down non-agent emulator (pool)');
    expect(emu).toContain('ANDROID_EMULATOR_WAIT_TIME_BEFORE_KILL');
    expect(emu).toContain('android_emu_avd_is_complete');
    expect(emu).toContain('android_emu_set_clipboard');
    expect(emu).toContain('hw.gpu.mode=host');
    // Agent RAM must not inherit headed Galaxy 8GB (16GB host OOM / Metal crash).
    expect(emu).toContain('ONTRACK_ANDROID_AGENT_RAM_MB');
    expect(emu).toContain('hw.ramSize={cap}');
    expect(emu).toContain('Shutting down agent emulator (headed');
    expect(emu).toContain('headed ${headed_name} keep needs RAM/GPU');
    expect(emu).toContain('Leaving headed emulator up (user window)');
    expect(emu).toContain('Leaving headed emulator up (live GUI)');
    expect(emu).toContain('android_emu_live_headed_galaxy_name');
    expect(emu).toContain('android_emu_mark_headed_keep');
    expect(emu).toContain('ONTRACK_ANDROID_KEEP_HEADED');
    expect(emu).toContain('clearing stale headed keep');
    // Headed keep / live GUI: adopt Galaxy and kill agents — 16GB cannot run both.
    expect(emu).toContain('android_emu_adopt_android_for_headed_host');
    expect(emu).toContain('adopting headed');
    expect(emu).toContain('cannot run agent beside GUI');
    expect(emu).toContain('NEVER run agents');
    expect(emu).toContain('Never kill a live headed GUI');
    // Must detach like Metro — nohup alone dies with Cursor agent shells.
    expect(emu).toContain('start_new_session=True');
    expect(emu).toContain('Emulator detached (new session)');
    expect(emu).toContain('android_emu_is_ready');
    expect(emu).toContain('android_emu_ensure_ready');
    // Headed handoff must heal blank SurfaceView (not just boot_completed).
    expect(emu).toContain('android_emu_ensure_app_surface');
    expect(emu).toContain('android_emu_mark_ready');
    expect(emu).toContain('android_emu_want_app_surface');
    expect(emu).toContain('blank SurfaceView');
    expect(emu).toContain('android_emu_surface.py');
    // Warm agent reconnect: cold 90s budget only when app process missing.
    const packager = read('scripts/ensure-packager.sh');
    expect(packager).toContain('extra=90');
    expect(packager).toContain('pidof "$BUNDLE_ID"');
    expect(packager).toContain("Warm reuse: app already running");
    const ensure = read('scripts/ensure-android-emulator.sh');
    expect(ensure).toContain('ensure_preferred_android_emulator');
    expect(ensure).toContain('--window');
    expect(ensure).toContain('ONTRACK_ANDROID_SKIP_APP_SURFACE');
    expect(ensure).toContain('blank/white');
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['android:ensure']).toContain('ensure-android-emulator.sh');
    expect(pkg.scripts['android:ensure:start']).toContain('--android');
    expect(pkg.scripts['packager:ensure:android']).toContain('--android');
    expect(pkg.scripts['android:run']).toContain('ensure-android-emulator.sh --window');
    expect(pkg.scripts['android:push-fixture']).toContain('android-push-fixture.sh');
  });

  it('pins agent-ui commands by AGENT_UI_PLATFORM (ios|android)', () => {
    const daemon = read('scripts/lib/agent_ui_daemon.py');
    expect(daemon).toContain('pending_by_platform');
    expect(daemon).toContain('status_by_nonce');
    expect(daemon).toContain('MAX_PENDING_PER_PLATFORM');
    expect(daemon).toContain('daemon_code_fingerprint');
    expect(daemon).toContain('normalize_platform');
    expect(daemon).toContain('platform=');
    const bridge = read('scripts/lib/agent_ui_bridge.py');
    expect(bridge).toContain('agent_ui_platform');
    expect(bridge).toContain('agent_ui_device');
    expect(bridge).toContain('stamp_platform');
    expect(bridge).toContain('AGENT_UI_PLATFORM');
    expect(bridge).toContain('AGENT_UI_DEVICE');
    const host = read('scripts/lib/agent-ui-host.sh');
    expect(host).toContain('agent_ui_is_android');
    expect(host).toContain('AGENT_UI_ANDROID_WARM_WAIT_SECS');
    expect(host).toContain('agent_ui_bridge_recently_ok');
    expect(host).toContain('soft reconnecting dev client');
    expect(host).toContain('agent_ui_soft_reconnect_dev_client');
    expect(host).toContain('agent_ui_restart_device');
    expect(host).toContain('AGENT_UI_DEVICE_RESPOND_SECS:=10');
    expect(host).toContain('android_emu_ensure_adb_reverse');
    expect(host).toContain('reverse_was_missing');
    const sim = read('scripts/lib/ios-simulator.sh');
    expect(sim).toContain('ONTRACK_SIMCTL_TIMEOUT_SECS:=10');
    const packager = read('scripts/ensure-packager.sh');
    expect(packager).toContain('--android');
    expect(packager).toContain('ensure_preferred_android_emulator');
    expect(packager).toContain('android_emu_ensure_adb_reverse');
    expect(packager).toContain('AGENT_UI_PLATFORM=android');
    expect(packager).toContain('Target:');
    expect(packager).toContain('shared_prefs');
    const androidLib = read('scripts/lib/android-emulator.sh');
    expect(androidLib).toContain('android_emu_ensure_adb_reverse');
    expect(androidLib).toContain('adb reverse');
    expect(androidLib).toContain('8191');
    expect(androidLib).toContain('ANDROID_EMU_REVERSE_ADDED');
    const http = read('src/utils/agent-ui/http-bridge.ts');
    expect(http).toContain('platform=');
    expect(http).toContain("Platform.OS === 'android'");
    const sync = read('src/utils/agent-ui/AgentUiRouteSync.tsx');
    expect(sync).toContain('MAX_QUEUED_COMMANDS');
    expect(sync).toContain('Do not long-poll while draining');
    const color = read('scripts/lib/agent_ui_color.py');
    expect(color).toContain('screencap');
    expect(color).toContain('_agent_ui_platform');
    // Parked / no-display agents — unpark or reattach, but never hang forever.
    expect(color).toContain('_ios_unpark_agent_window');
    expect(color).toContain('_ios_reattach_agent_display');
    expect(color).toContain('_ios_screen_capture_healable');
    expect(color).toContain('display port');
    expect(color).toContain('_ios_run_simctl_screenshot');
    expect(color).toContain('start_new_session=True');
    expect(color).toContain('os.killpg');
    expect(color).toContain('_ios_device_is_booted');
    expect(color).toContain('_ios_kill_wedged_simctl_io');
    expect(color).toContain('_ios_screenshot_heal_secs');
    expect(color).toContain('ios_sim_unminimize_agent_window_named');
    expect(color).toContain('_ios_acquire_capture_lock');
    expect(color).toContain('device not Booted');
    const iosLib = read('scripts/lib/ios-simulator.sh');
    expect(iosLib).toContain('ios_sim_ios_capture_in_progress');
    expect(iosLib).toContain('ios-capture.lock');
    const alerts = read('scripts/lib/ios_system_alert.py');
    // Soft-skip true headless + headless Agent pool; headed viewer still hard-fails.
    expect(alerts).toContain('headless, screenshot surfaces unavailable');
    expect(alerts).toContain('headless agent pool');
    expect(alerts).toContain('Cannot prove system sheets are clear');
    expect(alerts).toContain('agent_headless');
    const recipe = read('scripts/agent-ui-android-travel-demo.sh');
    expect(recipe).toContain('AGENT_UI_PLATFORM=android');
    expect(recipe).toContain('travel-demo');
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['android:travel-demo']).toContain('agent-ui-android-travel-demo.sh');
    const dropdown = read('src/components/primitives/dropdown.tsx');
    expect(dropdown).toContain('value: String(value');
  });

  it('daemon BridgeState FIFO + status-by-nonce isolate platforms', () => {
    const lib = join(root, 'scripts/lib');
    const out = execFileSync(
      'python3',
      [
        '-c',
        [
          'import sys',
          `sys.path.insert(0, ${JSON.stringify(lib)})`,
          'from agent_ui_daemon import BridgeState',
          's = BridgeState()',
          'n1 = s.enqueue({"op": "route", "platform": "android"})',
          'n2 = s.enqueue({"op": "exists", "platform": "android"})',
          'n_ios = s.enqueue({"op": "route", "platform": "ios"})',
          'a1 = s.take_command(0, platform="android")',
          'a2 = s.take_command(0, platform="android")',
          'ios = s.take_command(0, platform="ios")',
          'assert a1["nonce"] == n1 and a1["op"] == "route"',
          'assert a2["nonce"] == n2 and a2["op"] == "exists"',
          'assert ios["nonce"] == n_ios',
          's.publish_status({"ok": True, "nonce": n1, "op": "route"})',
          's.publish_status({"ok": True, "nonce": n_ios, "op": "route"})',
          'assert s.wait_status(n1, 0.01)["nonce"] == n1',
          'assert s.wait_status(n_ios, 0.01)["nonce"] == n_ios',
          'assert s.take_command(0, platform="android") is None',
          'print("ok")',
        ].join('; '),
      ],
      { cwd: root, encoding: 'utf8' },
    );
    expect(out.trim()).toBe('ok');
  });
});
