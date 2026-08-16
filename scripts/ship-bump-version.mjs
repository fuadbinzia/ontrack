#!/usr/bin/env node
/**
 * Patch-bump expo.version and prepend Release Notes + Changelog for ship:push.
 *
 * Usage:
 *   node scripts/ship-bump-version.mjs --message "Why this ships"
 *   node scripts/ship-bump-version.mjs --message "…" --dry-run
 *   node scripts/ship-bump-version.mjs --message "…" --release-note "User facing" --changelog-note "Technical"
 *
 * Pins runtimeVersion to a fixed string when still on { policy: "appVersion" }
 * so day-to-day patch bumps do not orphan OTA clients on existing binaries.
 * Bump runtimeVersion manually (and ship a native binary) when native modules change.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_JSON = join(ROOT, 'app.json');
const PACKAGE_JSON = join(ROOT, 'package.json');
const RELEASE_NOTES_JSON = join(
  ROOT,
  'src/constants/release-notes-user.json',
);
const CHANGELOG_JSON = join(
  ROOT,
  'src/constants/release-notes-changelog.json',
);

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function usage() {
  console.log(`Usage: node scripts/ship-bump-version.mjs --message "Why this ships" [--dry-run]
       node scripts/ship-bump-version.mjs --message "…" --release-note "…" --changelog-note "…"`);
}

function parseArgs(argv) {
  const out = {
    message: '',
    releaseNote: '',
    changelogNote: '',
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--message' || arg === '-m') {
      out.message = argv[++i] ?? '';
    } else if (arg === '--release-note') {
      out.releaseNote = argv[++i] ?? '';
    } else if (arg === '--changelog-note') {
      out.changelogNote = argv[++i] ?? '';
    } else if (arg === '--dry-run') {
      out.dryRun = true;
    } else if (arg === '-h' || arg === '--help') {
      usage();
      process.exit(0);
    } else {
      die(`unknown arg: ${arg}`);
    }
  }
  return out;
}

/** Increment the third semver segment: 1.0.2 → 1.0.3 */
export function bumpPatchVersion(version) {
  const parts = String(version).trim().split('.');
  if (parts.length < 2 || parts.some((p) => !/^\d+$/.test(p))) {
    throw new Error(`expected semver-like version (got ${version})`);
  }
  while (parts.length < 3) parts.push('0');
  const major = parts[0];
  const minor = parts[1];
  const patch = Number(parts[2]);
  if (!Number.isFinite(patch)) throw new Error(`invalid patch in ${version}`);
  return `${major}.${minor}.${patch + 1}`;
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function sentenceNote(raw) {
  const text = String(raw).trim().replace(/\s+/g, ' ');
  if (!text) return '';
  const capped = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

/** Prepend a { version, date, notes } entry to a newest-first JSON catalog. */
export function prependCatalogEntry(jsonText, entry) {
  const entries = JSON.parse(jsonText);
  if (!Array.isArray(entries)) {
    throw new Error('catalog must be a JSON array');
  }
  return `${JSON.stringify([entry, ...entries], null, 2)}\n`;
}

function changedPathHints(limit = 4) {
  try {
    const out = execFileSync(
      'git',
      ['status', '--porcelain', '-uall'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const paths = out
      .split('\n')
      .map((line) => line.slice(3).trim())
      .filter(Boolean)
      .filter((p) => !p.startsWith('scripts/ship-bump-version'))
      .filter((p) => p !== 'app.json' && p !== 'package.json')
      .filter((p) => !/src\/(features\/account|constants)\/release-notes[^/]*$/.test(p));
    const hints = [];
    for (const p of paths) {
      if (p.startsWith('src/features/')) {
        const feature = p.split('/')[2];
        if (feature) hints.push(`features/${feature}`);
      } else if (p.startsWith('src/app/')) {
        hints.push('app routes');
      } else if (p.startsWith('supabase/')) {
        hints.push('supabase');
      } else if (p.startsWith('design/')) {
        hints.push('design');
      }
      if (hints.length >= limit) break;
    }
    return [...new Set(hints)].slice(0, limit);
  } catch {
    return [];
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.message.trim()) die('--message is required');

  const app = JSON.parse(readFileSync(APP_JSON, 'utf8'));
  const current = app?.expo?.version;
  if (!current) die('app.json missing expo.version');

  const next = bumpPatchVersion(current);
  const date = todayISODate();
  const releaseNote = sentenceNote(args.releaseNote || args.message);
  const changelogPrimary = sentenceNote(args.changelogNote || args.message);
  const hints = changedPathHints();
  const changelogNotes = [
    changelogPrimary,
    ...(hints.length
      ? [`Touched: ${hints.join(', ')}.`]
      : ['Ship via ship:push (TestFlight + device OTA).']),
  ];

  app.expo.version = next;
  // Local Drive APKs use this value; EAS store builds still auto-increment from
  // their remote version source. Keep the sideload binary upgradeable and make
  // its embedded version match the release notes / filename.
  app.expo.android ??= {};
  app.expo.android.versionCode = Number(next.split('.')[2]);
  // Keep OTA clients on existing binaries; patch bumps are marketing/JS only.
  if (
    app.expo.runtimeVersion &&
    typeof app.expo.runtimeVersion === 'object' &&
    app.expo.runtimeVersion.policy === 'appVersion'
  ) {
    app.expo.runtimeVersion = String(current);
  }

  const releaseNotesJson = prependCatalogEntry(
    readFileSync(RELEASE_NOTES_JSON, 'utf8'),
    { version: next, date, notes: [releaseNote] },
  );
  const changelogJson = prependCatalogEntry(
    readFileSync(CHANGELOG_JSON, 'utf8'),
    { version: next, date, notes: changelogNotes },
  );

  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
  pkg.version = next;

  console.log(`==> Version ${current} → ${next}`);
  console.log(`    release notes: ${releaseNote}`);
  for (const n of changelogNotes) console.log(`    changelog: ${n}`);
  if (
    typeof app.expo.runtimeVersion === 'string'
  ) {
    console.log(`    runtimeVersion: ${app.expo.runtimeVersion} (pinned for OTA)`);
  }

  if (args.dryRun) {
    console.log('[dry-run] no files written');
    return;
  }

  writeFileSync(APP_JSON, `${JSON.stringify(app, null, 2)}\n`);
  writeFileSync(PACKAGE_JSON, `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(RELEASE_NOTES_JSON, releaseNotesJson);
  writeFileSync(CHANGELOG_JSON, changelogJson);
  console.log(
    '    wrote app.json, package.json, release-notes-user.json, release-notes-changelog.json',
  );
}

const isDirect =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirect) {
  main();
}
