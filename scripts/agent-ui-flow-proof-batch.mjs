#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import proofResults from './lib/flow-proof-results.cjs';

const { failureStepFor, parseDualPlatformExit } = proofResults;

const root = path.resolve(import.meta.dirname, '..');
const resultPath = path.join(root, '.living-system-map/generated/flow-runs.json');
const flowSourceModules = (() => {
  const flowsSource = fs.readFileSync(path.join(root, 'src/utils/agent-ui', 'flows.ts'), 'utf8');
  const importRegex = /import\s+[^\n]*?from\s+['"]\.\/([^'"]+)['"]/g;
  return [...flowsSource.matchAll(importRegex)]
    .map((match) => match[1])
    .filter((name) => name.startsWith('flows-'))
    .map((name) => path.join(root, 'src/utils/agent-ui', `${name}.ts`));
})();
const flowFiles = flowSourceModules;

function parseProofMetrics(output) {
  const metrics = {};
  if (!output) return metrics;
  for (const line of output.split('\n')) {
    const match = line.match(/^verify-both: flow-metrics (\w+) (.+)$/);
    if (!match) continue;
    const platform = match[1];
    try {
      const payload = JSON.parse(match[2]);
      if (payload && typeof payload === 'object') {
        metrics[platform] = payload;
      }
    } catch {
      // Ignore malformed metric payload lines while keeping run status data.
    }
  }
  return metrics;
}

function discover() {
  return flowFiles.flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file).replaceAll(path.sep, '/');
    return [...source.matchAll(/^\s{2}(?:'([^']+)'|"([^"]+)"|([a-zA-Z_$][\w$]*))\s*:\s*\[/gm)].map((match) => ({
      name: match[1] ?? match[2] ?? match[3],
      source: relative,
      digest: createHash('sha256').update(`${relative}\0${match[1] ?? match[2] ?? match[3]}\0${source}`).digest('hex').slice(0, 16),
    }));
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function selectedFlows(all) {
  const args = process.argv.slice(2);
  const excluded = new Set(args.flatMap((arg, index) => arg === '--exclude' ? [args[index + 1]] : []).filter(Boolean));
  const select = (flows) => flows.filter((flow) => !excluded.has(flow.name));
  const requestedFlows = new Set(
    args.flatMap((arg, index) => arg === '--flow' ? [args[index + 1]] : []).filter(Boolean),
  );
  if (requestedFlows.size) return select(all.filter((flow) => requestedFlows.has(flow.name)));
  const changedIndex = args.indexOf('--changed');
  if (changedIndex >= 0) {
    const base = args[changedIndex + 1];
    if (!base) throw new Error('--changed requires a Git ref.');
    const diff = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf8' });
    if (diff.status !== 0) throw new Error(diff.stderr || 'Could not inspect changed files.');
    const changed = new Set(diff.stdout.split(/\r?\n/).filter(Boolean));
    if (![...changed].some((file) => file.startsWith('src/') || file.startsWith('scripts/') || file.startsWith('modules/'))) return [];
    const touchedFlowFiles = new Set([...changed].filter((file) => /src\/utils\/agent-ui\/flows-[^.]+\.ts$/.test(file)));
    return select(touchedFlowFiles.size ? all.filter((flow) => touchedFlowFiles.has(flow.source)) : all);
  }
  if (args.includes('--all')) return select(all);
  throw new Error('Use --all, --flow <name>, or --changed <git-ref>.');
}

function runFlow(flow, { keepDevices = false, warmRun = false } = {}) {
  const started = Date.now();
  const includeIos = process.env.SKIP_IOS !== '1';
  const includeAndroid = process.env.SKIP_ANDROID !== '1';

  if (!includeIos && !includeAndroid) {
    throw new Error('SKIP_IOS=1 and SKIP_ANDROID=1 are both set, so no platform is being executed.');
  }
  const env = {
    ...process.env,
    ...(keepDevices ? { AGENT_UI_KEEP_DEVICES: '1' } : {}),
    ...(warmRun && process.env.AGENT_UI_SKIP_NATIVE_FRESH === undefined ? { AGENT_UI_SKIP_NATIVE_FRESH: '1' } : {}),
  };

  return new Promise((resolve) => {
    const child = spawn(path.join(root, 'scripts/agent-ui-verify-both.sh'), ['--proof-flow', flow.name], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output = `${output}${chunk}`.slice(-40_000); process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { output = `${output}${chunk}`.slice(-40_000); process.stderr.write(chunk); });
    child.on('close', (code) => {
      const finished = Date.now();
      const exits = parseDualPlatformExit(output, code);
      const flowMetrics = parseProofMetrics(output);
      const gitSha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
      resolve([...(includeIos ? ['ios'] : []), ...(includeAndroid ? ['android'] : [])].map((platform) => {
        const failureStep = failureStepFor(platform, exits[platform], output);
        return {
          flowId: `agent-ui:${flow.name}`,
          platform,
          definitionDigest: flow.digest,
          gitSha,
          startedAt: new Date(started).toISOString(),
          finishedAt: new Date(finished).toISOString(),
          durationMs: flowMetrics[platform]?.totalMs ?? (finished - started),
          infraDurationMs: flowMetrics[platform]?.infraMs,
          flowDurationMs: flowMetrics[platform]?.flowMs,
          commandDurationMs: flowMetrics[platform]?.commandMs,
          bridgeReconnectCount: flowMetrics[platform]?.bridgeReconnectCount ?? flowMetrics[platform]?.reconnectCount,
          timing: flowMetrics[platform],
          status: exits[platform] === 0 ? 'passed' : 'failed',
          exitCode: exits[platform],
          failureStep,
          infraFailureReason: failureStep && /^infrastructure:/.test(failureStep) ? failureStep : undefined,
        };
      }));
    });
  });
}

const flows = selectedFlows(discover());
if (!flows.length) {
  process.stdout.write('No affected agent-UI flows.\n');
  process.exit(0);
}
fs.mkdirSync(path.dirname(resultPath), { recursive: true });
let previous = { schemaVersion: 1, runs: [] };
try { previous = JSON.parse(fs.readFileSync(resultPath, 'utf8')); } catch {}
const fresh = [];
function writeProgress() {
  const replaced = new Set(fresh.map((run) => `${run.flowId}:${run.platform}`));
  const runs = [...previous.runs.filter((run) => !replaced.has(`${run.flowId}:${run.platform}`)), ...fresh];
  fs.writeFileSync(resultPath, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), runs }, null, 2)}\n`);
}
for (const [index, flow] of flows.entries()) {
  process.stdout.write(`\nflow-proof: ${flow.name} (${flow.digest})\n`);
  const runs = await runFlow(flow, {
    keepDevices: index < flows.length - 1,
    warmRun: index > 0,
  });
  fresh.push(...runs);
  writeProgress();
  if (runs.some((run) => run.exitCode === 3)) {
    process.exit(3);
  }
}
process.exit(fresh.every((run) => run.status === 'passed') ? 0 : 1);
