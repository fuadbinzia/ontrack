#!/usr/bin/env node
/**
 * Decide whether ship:push should run `expo export -p web` + `eas deploy`.
 * UI-only diffs skip the second Metro compile; API / hosting config still ships.
 * Version-only app.json / package.json bumps (every push) do not count.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const HOSTING_PATH_PATTERNS = [
  /\+api\.[cm]?[jt]sx?$/,
  /(^|\/)eas\.json$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)metro\.config\.js$/,
  /(^|\/)babel\.config\.js$/,
];

const VERSION_MANIFESTS = new Set(['app.json', 'package.json']);

export function hostingPathNeeded(file) {
  const normalized = String(file ?? '').replace(/\\/g, '/').trim();
  if (!normalized) return false;
  return HOSTING_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function stripAppJsonVersion(value) {
  if (!value || typeof value !== 'object') return value;
  const clone = structuredClone(value);
  if (clone.expo && typeof clone.expo === 'object') {
    delete clone.expo.version;
    if (clone.expo.android && typeof clone.expo.android === 'object') {
      delete clone.expo.android.versionCode;
    }
  }
  return clone;
}

function stripPackageJsonVersion(value) {
  if (!value || typeof value !== 'object') return value;
  const clone = structuredClone(value);
  delete clone.version;
  return clone;
}

export function manifestHostingChanged(relativePath, beforeText, afterText) {
  const name = String(relativePath ?? '').replace(/\\/g, '/').split('/').pop();
  if (!VERSION_MANIFESTS.has(name ?? '')) return false;
  try {
    const before = JSON.parse(String(beforeText ?? ''));
    const after = JSON.parse(String(afterText ?? ''));
    const strip = name === 'app.json' ? stripAppJsonVersion : stripPackageJsonVersion;
    return JSON.stringify(strip(before)) !== JSON.stringify(strip(after));
  } catch {
    return true;
  }
}

export function hostingDeployNeeded(files, manifestChanges = {}) {
  const names = Array.isArray(files) ? files : [];
  if (names.some((file) => hostingPathNeeded(file))) return true;
  return names.some((file) => {
    const normalized = String(file ?? '').replace(/\\/g, '/').trim();
    const base = normalized.split('/').pop();
    if (!VERSION_MANIFESTS.has(base ?? '')) return false;
    return Boolean(manifestChanges[normalized] ?? manifestChanges[base ?? '']);
  });
}

function gitShow(ref, file) {
  try {
    return execFileSync('git', ['show', `${ref}:${file}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

export function hostingDeployNeededForGitRange(fromRef, toRef) {
  let files = [];
  try {
    files = execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=ACMR', fromRef, toRef],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return true;
  }
  const manifestChanges = {};
  for (const file of files) {
    const base = file.replace(/\\/g, '/').split('/').pop();
    if (!VERSION_MANIFESTS.has(base ?? '')) continue;
    manifestChanges[file] = manifestHostingChanged(
      file,
      gitShow(fromRef, file),
      gitShow(toRef, file),
    );
  }
  return hostingDeployNeeded(files, manifestChanges);
}

function isCliMain() {
  if (!process.argv[1] || !import.meta.url) return false;
  try {
    return process.argv[1] === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isCliMain()) {
  if (process.argv[2] === '--git-range') {
    const fromRef = process.argv[3];
    const toRef = process.argv[4];
    if (!fromRef || !toRef) {
      process.stderr.write('usage: hosting-deploy-needed.mjs --git-range <from> <to>\n');
      process.exit(2);
    }
    process.stdout.write(
      hostingDeployNeededForGitRange(fromRef, toRef) ? 'needed\n' : 'skip\n',
    );
    process.exit(0);
  }
  const files = readFileSync(0, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  process.stdout.write(hostingDeployNeeded(files) ? 'needed\n' : 'skip\n');
}
