import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { failureStepFor, parseDualPlatformExit } = require('../lib/flow-proof-results.cjs');

const read = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');

describe('dual-platform flow proof runner', () => {
  it('records current digest, platform, duration, status, and failure evidence', () => {
    const source = read('scripts/agent-ui-flow-proof-batch.mjs');
    for (const field of [
      'flowId', 'platform', 'definitionDigest', 'gitSha', 'startedAt',
      'finishedAt', 'durationMs', 'status', 'failureStep',
    ]) {
      expect(source).toContain(field);
    }
    expect(source).toContain("includeIos = process.env.SKIP_IOS");
    expect(source).toContain("includeAndroid = process.env.SKIP_ANDROID");
    expect(source).toContain("scripts/agent-ui-verify-both.sh");
    expect(source).toContain("['--proof-flow', flow.name]");
    expect(source).toContain('run.exitCode === 3');
    expect(source).not.toMatch(/AGENT_UI_SKIP_LEASE|ONTRACK_PACKAGER_TARGET/);
  });

  it('discovers quoted and identifier-named flows so the atlas cannot silently omit app journeys', () => {
    const source = read('scripts/agent-ui-flow-proof-batch.mjs');
    expect(source).toContain("'([^']+)'|\"([^\"]+)\"|([a-zA-Z_$][\\w$]*)");
    expect(source).toContain('match[1] ?? match[2] ?? match[3]');
  });

  it('keeps agent devices warm only between batch flows and safely shuts down after the final flow', () => {
    const source = read('scripts/agent-ui-flow-proof-batch.mjs');
    expect(source).toContain("keepDevices ? { ...process.env, AGENT_UI_KEEP_DEVICES: '1' } : process.env");
    expect(source).toContain('for (const [index, flow] of flows.entries())');
    expect(source).toContain('keepDevices: index < flows.length - 1');
  });

  it('checkpoints proof evidence after each flow so later failures do not erase passing work', () => {
    const source = read('scripts/agent-ui-flow-proof-batch.mjs');
    expect(source).toContain('function writeProgress()');
    expect(source).toMatch(/fresh\.push\(\.\.\.runs\);\s*writeProgress\(\);/);
    expect(source).toMatch(/writeProgress\(\);[\s\S]*?run\.exitCode === 3/);
  });

  it('supports explicitly excluding a blocked flow without weakening the default suite', () => {
    const source = read('scripts/agent-ui-flow-proof-batch.mjs');
    expect(source).toContain("arg === '--exclude'");
    expect(source).toContain('!excluded.has(flow.name)');
    expect(source).toContain("if (args.includes('--all')) return select(all)");
  });

  it('discovers only active flow source modules and excludes deprecated flow files', () => {
    const source = read('scripts/agent-ui-flow-proof-batch.mjs');
    expect(source).toContain("const flowSourceModules = (() => {");
    expect(source).toContain("importRegex = /import\\s+[^\\n]*?from\\s+['\"]\\.\\/([^'\"]+)['\"]/g");
    expect(source).not.toContain('flows-life.ts');
  });

  it('accepts repeated flow selectors for focused warm-device reruns', () => {
    const source = read('scripts/agent-ui-flow-proof-batch.mjs');
    expect(source).toContain("arg === '--flow'");
    expect(source).toContain('requestedFlows.has(flow.name)');
  });

  it('keeps a passing iOS result when Android bridge proof fails', () => {
    const output = [
      'error: Android app bridge not answering',
      'verify-both: ios_exit=0 android_exit=1',
    ].join('\n');

    expect(parseDualPlatformExit(output, 1)).toEqual({ ios: 0, android: 1 });
    expect(failureStepFor('ios', 0, output)).toBeUndefined();
    expect(failureStepFor('android', 1, output)).toBe('infrastructure:android-bridge');
  });

  it('marks missing epilogues and unavailable device slots as infrastructure failures', () => {
    expect(parseDualPlatformExit('runner stopped unexpectedly', 1)).toEqual({ ios: 1, android: 1 });
    expect(parseDualPlatformExit('no free agent device slot', 3)).toEqual({ ios: 3, android: 3 });
    expect(failureStepFor('android', 3, 'no free agent device slot')).toBe('infrastructure:no-device-slot');
    expect(failureStepFor('ios', 1, 'runner stopped unexpectedly')).toBe('flow:ios');
  });

  it('treats framework timeouts as infrastructure timeouts', () => {
    expect(failureStepFor('ios', 1, 'timed out after 10.0s')).toBe('infrastructure:ios-timeout');
    expect(failureStepFor('android', 1, 'timed out after 10.0s')).toBe('infrastructure:android-timeout');
  });

  it('uses a self-hosted macOS PR/nightly gate and preserves proof artifacts', () => {
    const workflow = read('.github/workflows/flow-protection.yml');
    expect(workflow).toContain('runs-on: [self-hosted, macOS, ontrack-agent-ui]');
    expect(workflow).toContain("cron: '17 6 * * *'");
    expect(workflow).toContain('--changed');
    expect(workflow).toContain('--all');
    expect(workflow).toContain('actions/cache@v4');
    expect(workflow).toContain('system-map:verify');
    expect(workflow).toContain('system-map:check');
  });
});
