#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';

const root = process.cwd();
const resultPath = `${root}/.living-system-map/generated/flow-runs.json`;

function usage() {
  process.stdout.write(`\
Usage:
  node scripts/agent-ui-flow-latency-report.mjs [--platform ios|android|both] [--metric <metric>[,<metric>...]] [--days <n>] [--latest <n>]

Defaults:
  platform: both
  metrics: durationMs,infraDurationMs,flowDurationMs,commandDurationMs
  days: all
  latest: all
\n`);
  process.exit(0);
}

function parseArgs(argv) {
  const args = { platform: 'both', metrics: ['durationMs', 'infraDurationMs', 'flowDurationMs', 'commandDurationMs'], days: null, latest: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage();
    if (arg === '--platform') {
      const value = argv[i + 1];
      if (!value || !['ios', 'android', 'both'].includes(value)) usage();
      args.platform = value;
      i += 1;
      continue;
    }
    if (arg === '--metric') {
      const value = argv[i + 1];
      if (!value) usage();
      args.metrics = value.split(',').map((metric) => metric.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === '--days') {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value <= 0) usage();
      args.days = value;
      i += 1;
      continue;
    }
    if (arg === '--latest') {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value <= 0) usage();
      args.latest = value;
      i += 1;
      continue;
    }
    usage();
  }
  return args;
}

function toNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const position = (percentileValue / 100) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function summarize(values) {
  if (!values.length) {
    return { count: 0, p50: null, p95: null, p99: null };
  }
  return {
    count: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
  };
}

function formatMs(value) {
  if (value == null) return 'n/a';
  return `${Math.round(value)}ms`;
}

function formatRows(label, summary) {
  const lines = [
    `${label}: count=${summary.count}`,
    `  p50=${formatMs(summary.p50)}`,
    `  p95=${formatMs(summary.p95)}`,
    `  p99=${formatMs(summary.p99)}`,
  ];
  return lines.join('\n');
}

function formatTopRun(run) {
  const parts = [
    run.flowId,
    run.platform,
    `duration=${formatMs(run.durationMs)}`,
  ];
  if (run.flowDurationMs != null) {
    parts.push(`flow=${formatMs(run.flowDurationMs)}`);
  }
  if (run.infraDurationMs != null) {
    parts.push(`infra=${formatMs(run.infraDurationMs)}`);
  }
  if (run.exitCode != null) {
    parts.push(`exit=${run.exitCode}`);
  }
  return `  - ${parts.join(' | ')}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(resultPath)) {
    process.stderr.write(`No flow proof artifact found at ${resultPath}\n`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(resultPath, 'utf8'));
  const runs = Array.isArray(raw.runs) ? raw.runs : [];

  const platforms = args.platform === 'both' ? ['ios', 'android'] : [args.platform];
  const maxStartedAt = args.days
    ? new Date(Date.now() - args.days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const grouped = platforms.reduce((acc, platform) => {
    acc[platform] = [];
    return acc;
  }, {});

  const byFlowPlatform = new Map();
  for (const run of runs) {
    if (!run || !platforms.includes(run.platform)) continue;
    const ts = run.finishedAt || run.startedAt;
    if (!ts) continue;
    if (maxStartedAt && ts < maxStartedAt) continue;

    const key = `${run.flowId}::${run.platform}`;
    const existing = byFlowPlatform.get(key);
    if (!existing || new Date(run.finishedAt) > new Date(existing.finishedAt)) {
      byFlowPlatform.set(key, run);
    }
  }

  for (const run of byFlowPlatform.values()) {
    grouped[run.platform].push(run);
  }

  if (args.latest) {
    for (const platform of Object.keys(grouped)) {
      grouped[platform].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
      grouped[platform] = grouped[platform].slice(0, args.latest);
    }
  }

  process.stdout.write(`Agent-ui flow latency report (${new Date().toISOString()})\n`);
  if (args.days) {
    process.stdout.write(`Window: last ${args.days} day(s)\n`);
  }
  if (args.latest) {
    process.stdout.write(`Latest N per platform: ${args.latest}\n`);
  }

  for (const platform of platforms) {
    const platformRuns = grouped[platform] || [];
    const failures = platformRuns.filter((run) => run.status !== 'passed');
    const infraFailureCounts = failures.reduce((memo, run) => {
      const reason = run.infraFailureReason || (run.failureStep?.startsWith('infrastructure:') ? run.failureStep : 'flow');
      memo[reason] = (memo[reason] || 0) + 1;
      return memo;
    }, {});

    process.stdout.write(`\n${platform.toUpperCase()} (${platformRuns.length} runs, ${failures.length} failed)\n`);
    process.stdout.write(formatRows('Total latency', summarize(platformRuns.map((run) => toNumber(run.durationMs)).filter((value) => value != null))));
    for (const metric of args.metrics) {
      const values = platformRuns
        .map((run) => toNumber(run[metric]))
        .filter((value) => value != null && Number.isFinite(value));
      const summary = summarize(values);
      process.stdout.write(`\n${formatRows(metric, summary)}\n`);
      process.stdout.write(`  with ${metric}: ${values.length}/${platformRuns.length}\n`);
    }
    const sortedReasons = Object.entries(infraFailureCounts).sort((a, b) => b[1] - a[1]);
    if (sortedReasons.length) {
      process.stdout.write('\nFailure reasons:\n');
      for (const [reason, count] of sortedReasons) {
        process.stdout.write(`  ${reason}: ${count}\n`);
      }
    }

    const topByDuration = [...platformRuns]
      .filter((run) => Number.isFinite(toNumber(run.durationMs)))
      .sort((a, b) => Number(toNumber(b.durationMs)) - Number(toNumber(a.durationMs)))
      .slice(0, 10);
    if (topByDuration.length) {
      process.stdout.write('\nTop 10 flows by total duration:\n');
      for (const run of topByDuration) {
        process.stdout.write(`${formatTopRun(run)}\n`);
      }
    }
  }
}

main();
