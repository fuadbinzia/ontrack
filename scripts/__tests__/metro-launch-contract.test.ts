import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const root = process.cwd();
const requireFromRoot = createRequire(join(root, 'scripts/__tests__/metro-launch-contract.test.ts'));

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8');
}

describe('metro launch command contract', () => {
  it('keeps app code off @react-navigation/* (expo-router SDK 56+ fork)', () => {
    let out = '';
    try {
      out = execFileSync(
        'rg',
        [
          '-n',
          "from ['\"]@react-navigation/|require\\(['\"]@react-navigation/",
          'src',
          '--glob',
          '*.{ts,tsx,js,jsx}',
        ],
        { cwd: root, encoding: 'utf8' },
      );
    } catch (error: unknown) {
      const status =
        error && typeof error === 'object' && 'status' in error
          ? (error as { status?: number }).status
          : undefined;
      // rg exit 1 = no matches (desired).
      if (status !== 1) throw error;
      out = '';
    }
    expect(out.trim()).toBe('');

    const pkg = JSON.parse(read('package.json')) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.['@react-navigation/bottom-tabs']).toBeUndefined();
    expect(pkg.dependencies?.['@react-navigation/native']).toBeUndefined();
    expect(read('src/components/navigation/bottom-nav-bar.tsx')).toContain(
      "from 'expo-router/js-tabs'",
    );
    expect(read('src/features/travel/travel-chat-screen.tsx')).toContain(
      "from 'expo-router/js-tabs'",
    );
  });

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

  it('strips inherited NO_COLOR so Metro workers do not trip Node FORCE_COLOR warnings', () => {
    const metroConfig = read('metro.config.js');
    const launcher = read('scripts/start-metro.sh');
    const publish = read('scripts/publish-ota.sh');
    const helper = read('scripts/lib/strip-node-color-conflict.cjs');

    expect(helper).toContain('delete env.NO_COLOR');
    expect(helper).toContain('delete env.NODE_DISABLE_COLORS');
    expect(metroConfig).toContain('strip-node-color-conflict.cjs');
    expect(metroConfig).toContain('stripNodeColorConflict()');
    expect(launcher).toMatch(/unset NO_COLOR NODE_DISABLE_COLORS/);
    expect(publish).toMatch(/unset NO_COLOR NODE_DISABLE_COLORS/);

    const {
      stripNodeColorConflict,
    } = requireFromRoot('../lib/strip-node-color-conflict.cjs') as {
      stripNodeColorConflict: (env?: NodeJS.ProcessEnv) => NodeJS.ProcessEnv;
    };

    const env: NodeJS.ProcessEnv = {
      PATH: process.env.PATH,
      NO_COLOR: '1',
      NODE_DISABLE_COLORS: '1',
      FORCE_COLOR: '1',
    };
    const conflicted = spawnSync(
      process.execPath,
      ['-e', "require('util').styleText('red','x')"],
      { env, encoding: 'utf8' },
    );
    expect(conflicted.status).toBe(0);
    expect(conflicted.stderr).toMatch(
      /NO_COLOR' env is ignored due to the 'FORCE_COLOR'/,
    );

    const forceOff = spawnSync(
      process.execPath,
      ['-e', "require('util').styleText('red','x')"],
      {
        env: { PATH: process.env.PATH, NO_COLOR: '1', FORCE_COLOR: '0' },
        encoding: 'utf8',
      },
    );
    expect(forceOff.status).toBe(0);
    expect(forceOff.stderr).not.toMatch(/NO_COLOR/);

    stripNodeColorConflict(env);
    expect(env.NO_COLOR).toBeUndefined();
    expect(env.NODE_DISABLE_COLORS).toBeUndefined();
    expect(env.FORCE_COLOR).toBe('1');

    const quiet = spawnSync(
      process.execPath,
      ['-e', "require('util').styleText('red','x')"],
      { env, encoding: 'utf8' },
    );
    expect(quiet.status).toBe(0);
    expect(quiet.stderr).not.toMatch(/NO_COLOR/);
  });

  it('keeps Watchman hybrid crawl/watch and refuses dead subscriptions', () => {
    const metroConfig = read('metro.config.js');
    expect(metroConfig).toMatch(/resolver\.useWatchman\s*=\s*null/);
    expect(metroConfig).toMatch(/patch-expo-metro-watchman/);
    expect(metroConfig).toMatch(/healthCheck/);
    expect(metroConfig).toMatch(/enabled:\s*true/);
    // Avoid entry-node dynamic langs/*.json (Metro red screen: unknown ./langs/br.json).
    expect(metroConfig).toContain("moduleName === 'i18n-iso-countries'");
    expect(metroConfig).toContain('i18n-iso-countries/index.js');
    expect(read('src/features/travel/map/country-data.ts')).toContain(
      "from 'i18n-iso-countries/index'",
    );

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
    expect(read('scripts/living-system-map-analytics.mjs')).not.toContain('.env.analytics.local');
    expect(read('scripts/living-system-map-analytics.mjs')).toContain('.living-system-map/runtime-analytics.local');

    const ensure = read('scripts/ensure-packager.sh');
    expect(ensure).toContain('metro-watcher.sh');
    expect(ensure).toContain('ensure_metro_watcher');
    expect(ensure).toContain('CURSOR_AGENT');

    const launcher = read('scripts/start-metro.sh');
    expect(launcher).toContain('patch-expo-metro-watchman.sh');
    expect(launcher).toContain('wait_for_watchman');
    expect(launcher).toContain('ensure-local-analytics-env.mjs');
    expect(launcher).toContain('SUPABASE_SERVICE_ROLE_KEY=*|ANALYTICS_INSTALL_HASH_SECRET=*');
    expect(launcher).not.toContain('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
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

  it('skips reconnect on cold boot heal and re-launches a dead iOS process (H21)', () => {
    // H19 shutdown leaves the app dead. Waiting a full reconnect timeout before
    // the host launches doubles cold-path time and looks like "reinstalling".
    const ensure = read('scripts/ensure-packager.sh');
    expect(ensure).toContain('AGENT_UI_PACKAGER_SKIP_RECONNECT');
    expect(ensure).toContain('app_process_running');
    expect(ensure).toContain('app process never started after launch');
    expect(ensure).toContain('App not running — launching + connecting to Metro');
    expect(ensure).not.toContain('Checking app install on');

    const host = read('scripts/lib/agent-ui-host.sh');
    expect(host).toContain('AGENT_UI_PACKAGER_SKIP_RECONNECT=1');
    expect(host).toContain('booting device');
  });

  it('heals a persisted Fast Refresh-off dev client toggle', () => {
    // RCTDevMenu.hotLoadingEnabled=0 persists per install and silently
    // disables HMR regardless of Metro/Watchman health.
    const ensure = read('scripts/ensure-packager.sh');
    expect(ensure).toContain('ensure_fast_refresh_enabled');
    expect(ensure).toContain('hotLoadingEnabled = 0');
    expect(ensure).toMatch(/defaults write "\$BUNDLE_ID" RCTDevMenu -dict-add hotLoadingEnabled -bool YES/);
  });

  it('does not trust Android "already connected" without HMR beacon freshness (H20)', () => {
    // Warm Android keeps answering the agent-ui bridge on a stale bundle while
    // iOS reconnects — new testIDs assert-miss only on Android. ensure-packager
    // and verify must prove the Metro HMR beacon before treating the app as ready.
    const ensure = read('scripts/ensure-packager.sh');
    expect(ensure).toContain('ensure-js-fresh');
    expect(ensure).toContain('JS matches Metro HMR beacon');
    expect(ensure).not.toMatch(
      /App already connected to packager \(no reconnect\)\.\s*\n\s*exit 0/,
    );

    const bridge = read('scripts/lib/agent_ui_bridge.py');
    expect(bridge).toContain('def ensure_js_fresh');
    expect(bridge).toContain('def beacon_satisfies');
    expect(bridge).toContain('hmrBeacon');
    expect(bridge).toContain('AGENT_UI_SKIP_JS_FRESH');
    expect(bridge).toContain('AGENT_UI_EXPECTED_HMR_BEACON');
    // verify always proves freshness before land/assert (H20).
    expect(bridge).toContain('# H20: warm Android bridge ≠ fresh JS');
    expect(bridge).toContain('fresh = ensure_js_fresh');
    // Watcher may re-bump mid-wait — accept app beacon newer than the minimum.
    expect(bridge).toContain('hmr_beacon_ns(app_beacon) >= hmr_beacon_ns(minimum)');

    const verifyBoth = read('scripts/agent-ui-verify-both.sh');
    expect(verifyBoth).toContain('ensure-js-fresh --bump-only');
    expect(verifyBoth).toContain('AGENT_UI_EXPECTED_HMR_BEACON');

    const persist = read('src/utils/agent-ui/persist.ts');
    expect(persist).toContain('hmrBeacon');
    expect(persist).toContain('METRO_HMR_BEACON');
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
    expect(ensure).toContain('packager_ensure_native_fresh');
    expect(ensure).toContain('agent_ui_pool_clone_ios_app');

    const host = read('scripts/lib/agent-ui-host.sh');
    expect(host).toContain('agent_ui_ensure_native_fresh');
    expect(host).toContain('AGENT_UI_SKIP_NATIVE_FRESH');
    expect(host).toContain('AGENT_UI_NATIVE_FRESH_DONE');
    expect(host).toContain('relaunching after native debug client refresh');
    expect(host).toContain('agent_ui_heal_packager');
    expect(host).toContain('AGENT_UI_SKIP_HEAL');
    expect(host).toContain('agent_ui_pool_ensure_app_installed');
    expect(host).toContain('agent_ui_soft_reconnect_dev_client');

    const open = read('scripts/agent-ui-open.sh');
    expect(open).toContain('agent_ui_heal_packager');
  });
});
