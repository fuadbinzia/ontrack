import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8');
}

describe('metro device launch contract', () => {
  it('boots preferred simulator headless; GUI window is opt-in only', () => {
    const sim = read('scripts/lib/ios-simulator.sh');
    expect(sim).toContain('ONTRACK_IOS_SIMULATOR:=onTrack iPhone 17 Pro');
    expect(sim).toContain('ONTRACK_IOS_SIMULATOR_DEVICE_TYPE:=com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro');
    expect(sim).toContain('ios_sim_ensure_device_exists');
    expect(sim).toContain('ios_sim_latest_ios_runtime');
    expect(sim).toContain('ONTRACK_IOS_SIMULATOR_WINDOW:=0');
    expect(sim).toContain('ios_sim_want_window');
    expect(sim).toContain('ios_sim_pool_mode');
    expect(sim).toContain('ios_sim_is_protected_sim_name');
    expect(sim).toContain('onTrack\\ Agent*|onTrack\\ iPhone\\ 17\\ Pro');
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
    expect(alerts).toContain('DEV_MENU_INTRO_PHRASES');
    expect(alerts).toContain('DEV_MENU_TOOLS_PHRASES');
    expect(alerts).toContain('DEV_MENU_ACCEPT_PRIORITY');
    expect(alerts).toContain('_is_dev_menu_prompt');
    expect(alerts).toContain('_is_dev_menu_intro');
    expect(alerts).toContain('_is_dev_menu_tools');
    // Expo tools FAB (gearshape.fill) — UserDefaults suppress when Info.plist
    // toolsButton:false is not yet in the installed agent binary.
    expect(alerts).toContain('suppress_expo_dev_menu_fab');
    expect(alerts).toContain('EXDevMenuShowFloatingActionButton');
    // Intro has Continue; tools Escape. "runtime version" must not force Escape.
    // Apple Account password sheet → Not Now (never Escape while that label is OCR'd).
    expect(alerts).toContain('dismissed Expo developer-menu intro');
    expect(alerts).toContain('dismissing Expo Dev Menu (Escape)');
    expect(alerts).toContain('APPLE_ACCOUNT_PHRASES');
    expect(alerts).toContain("tapping '{label}' on system sheet");
    expect(alerts).toContain('Not Now');
    const toolsBlock = alerts.slice(
      alerts.indexOf('DEV_MENU_TOOLS_PHRASES'),
      alerts.indexOf('DEV_MENU_PHRASES ='),
    );
    expect(toolsBlock).not.toContain('runtime version');

    // Android Expo Dev Menu — uiautomator Continue/BACK + prefs suppress (showsAtLaunch).
    const androidAlerts = read('scripts/lib/android_system_alert.py');
    expect(androidAlerts).toContain('DEV_MENU_INTRO_PHRASES');
    expect(androidAlerts).toContain('DEV_MENU_TOOLS_PHRASES');
    expect(androidAlerts).toContain('dismissing Expo developer-menu intro');
    expect(androidAlerts).toContain('dismissing Expo Dev Menu (BACK)');
    expect(androidAlerts).toContain('showsAtLaunch');
    expect(androidAlerts).toContain('isOnboardingFinished');
    expect(androidAlerts).toContain('expo.modules.devmenu.sharedpreferences');
    expect(androidAlerts).toContain('PERMISSION_CONTROLLER_PACKAGES');
    expect(androidAlerts).toContain('PERMISSION_ALLOW_LABELS');
    expect(androidAlerts).toContain('blocking_activity_active');
    expect(androidAlerts).toContain('granting Android runtime permission');
    expect(androidAlerts).toContain('DEV_LAUNCHER_PHRASES');
    expect(androidAlerts).toContain('opening Android development server');
    expect(androidAlerts).toContain('for _ in range(8)');
    expect(androidAlerts).toContain('attempts = 10 if force else 4');
    const androidHost = read('scripts/lib/agent-ui-host.sh');
    expect(androidHost).toContain('agent_ui_ensure_android_system_alerts_clear');
    expect(androidHost).toContain('android_system_alert.py');
    expect(androidHost).toContain('android_system_alert.py\" dismiss');
    expect(ensure).toContain('android_system_alert.py\" dismiss');
    expect(ensure).toContain('android_system_alert.py\" ensure');
    expect(androidHost).toContain('AGENT_UI_SKIP_ANDROID_ALERTS');
    const appJson = read('app.json');
    expect(appJson).toContain('expo-dev-client');
    expect(appJson).toContain('skipOnboarding');
    expect(appJson).toContain('showMenuAtLaunch');
    expect(appJson).toContain('toolsButton');
  });

  it('classifies Android runtime permission dialogs without confusing ordinary app UI', () => {
    const classifier = [
      'import importlib.util, json, sys',
      "spec = importlib.util.spec_from_file_location('alerts', sys.argv[1])",
      'module = importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(module)',
      'payload = json.load(sys.stdin)',
      'print(json.dumps([module.classify(item) for item in payload]))',
    ].join('; ');
    const permissionXml = '<hierarchy><node package="com.google.android.permissioncontroller" text="Allow onTrack to access this device’s location?" content-desc=""><node package="com.google.android.permissioncontroller" text="While using the app" content-desc="" /></node></hierarchy>';
    const ordinaryXml = '<hierarchy><node package="com.imtihoss.ontracknow" text="Allow friends to join" content-desc="" /></hierarchy>';
    const introXml = '<hierarchy><node package="com.imtihoss.ontracknow" text="This is the developer menu. Useful tools in development." content-desc=""><node package="com.imtihoss.ontracknow" text="Continue" content-desc="" /></node></hierarchy>';
    const launcherXml = '<hierarchy><node package="com.imtihoss.ontracknow" text="Development Build"/><node text="Development Servers"/><node text="http://192.168.1.2:8081" bounds="[10,20][200,80]"/><node text="New development server"/></hierarchy>';
    const output = execFileSync(
      'python3',
      ['-c', classifier, join(root, 'scripts/lib/android_system_alert.py')],
      { cwd: root, encoding: 'utf8', input: JSON.stringify([permissionXml, ordinaryXml, introXml, launcherXml]) },
    );
    expect(JSON.parse(output)).toEqual(['permission', null, 'intro', 'launcher']);
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
    expect(packager).toContain('extra=45');
    expect(packager).toContain('pidof "$BUNDLE_ID"');
    expect(packager).toContain('agent_ui_dev_client_metro_url');
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
    expect(dropdown).toContain("selectedValues.join(',')");
    expect(dropdown).toContain('value: String(');
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
