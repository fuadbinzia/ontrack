#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import proofResults from './lib/flow-proof-results.cjs';

const { failureStepFor, parseDualPlatformExit } = proofResults;

const root = path.resolve(import.meta.dirname, '..');
const resultPath = path.join(root, '.living-system-map/generated/flow-runs.json');
const flowFiles = fs.readdirSync(path.join(root, 'src/utils/agent-ui'))
  .filter((name) => /^flows-[^.]+\.ts$/.test(name))
  .map((name) => path.join(root, 'src/utils/agent-ui', name));

function discover() {
  return flowFiles.flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file).replaceAll(path.sep, '/');
    return [...source.matchAll(/^\s{2}'([^']+)'\s*:\s*\[/gm)].map((match) => ({
      name: match[1],
      source: relative,
      digest: createHash('sha256').update(`${relative}\0${match[1]}\0${source}`).digest('hex').slice(0, 16),
    }));
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function selectedFlows(all) {
  const args = process.argv.slice(2);
  const flowIndex = args.indexOf('--flow');
  if (flowIndex >= 0) return all.filter((flow) => flow.name === args[flowIndex + 1]);
  const changedIndex = args.indexOf('--changed');
  if (changedIndex >= 0) {
    const base = args[changedIndex + 1];
    if (!base) throw new Error('--changed requires a Git ref.');
    const diff = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf8' });
    if (diff.status !== 0) throw new Error(diff.stderr || 'Could not inspect changed files.');
    const changed = new Set(diff.stdout.split(/\r?\n/).filter(Boolean));
    if (![...changed].some((file) => file.startsWith('src/') || file.startsWith('scripts/') || file.startsWith('modules/'))) return [];
    const touchedFlowFiles = new Set([...changed].filter((file) => /src\/utils\/agent-ui\/flows-[^.]+\.ts$/.test(file)));
    return touchedFlowFiles.size ? all.filter((flow) => touchedFlowFiles.has(flow.source)) : all;
  }
  if (args.includes('--all')) return all;
  throw new Error('Use --all, --flow <name>, or --changed <git-ref>.');
}

function runFlow(flow) {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(path.join(root, 'scripts/agent-ui-verify-both.sh'), ['--proof-flow', flow.name], {
      cwd: root,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output = `${output}${chunk}`.slice(-40_000); process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { output = `${output}${chunk}`.slice(-40_000); process.stderr.write(chunk); });
    child.on('close', (code) => {
      const finished = Date.now();
      const exits = parseDualPlatformExit(output, code);
      const gitSha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
      resolve(['ios', 'android'].map((platform) => ({
        flowId: `agent-ui:${flow.name}`,
        platform,
        definitionDigest: flow.digest,
        gitSha,
        startedAt: new Date(started).toISOString(),
        finishedAt: new Date(finished).toISOString(),
        durationMs: finished - started,
        status: exits[platform] === 0 ? 'passed' : 'failed',
        exitCode: exits[platform],
        failureStep: failureStepFor(platform, exits[platform], output),
      })));
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
for (const flow of flows) {
  process.stdout.write(`\nflow-proof: ${flow.name} (${flow.digest})\n`);
  const runs = await runFlow(flow);
  fresh.push(...runs);
  if (runs.some((run) => run.exitCode === 3)) {
    fs.writeFileSync(resultPath, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), runs: [...previous.runs, ...fresh] }, null, 2)}\n`);
    process.exit(3);
  }
}
const replaced = new Set(fresh.map((run) => `${run.flowId}:${run.platform}`));
const runs = [...previous.runs.filter((run) => !replaced.has(`${run.flowId}:${run.platform}`)), ...fresh];
fs.writeFileSync(resultPath, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), runs }, null, 2)}\n`);
process.exit(fresh.every((run) => run.status === 'passed') ? 0 : 1);
