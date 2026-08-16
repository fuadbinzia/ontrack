#!/usr/bin/env node
'use strict';

/**
 * Decide when a simulator/emulator needs the latest local debug client.
 * Host scripts call this so verify never keeps testing a stale native binary.
 */

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  'build',
  'Pods',
  '.gradle',
  'node_modules',
  '.git',
  'DerivedData',
]);

/** User-owned devices that must receive the same debug client as agent slots. */
const USER_VIRTUAL_DEVICES = {
  ios: ['onTrack iPhone 17 Pro'],
  android: ['Galaxy_S26'],
};

function userVirtualDevices() {
  return {
    ios: USER_VIRTUAL_DEVICES.ios.slice(),
    android: USER_VIRTUAL_DEVICES.android.slice(),
  };
}

function artifactIdentity({ version, mtimeMs, size }) {
  return [version || '', Number(mtimeMs) || 0, Number(size) || 0].join(':');
}

function identityFromPath(filePath, version) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  const stat = fs.statSync(filePath);
  return artifactIdentity({
    version: version || '',
    mtimeMs: stat.mtimeMs,
    size: stat.size,
  });
}

function shouldRebuildArtifact({
  artifactExists,
  artifactMtimeMs,
  sourceMtimesMs,
  force,
}) {
  if (force) return true;
  if (!artifactExists) return false;
  const times = Array.isArray(sourceMtimesMs) ? sourceMtimesMs : [];
  const newest = Math.max(0, ...times.filter((n) => Number.isFinite(n)));
  return newest > (Number(artifactMtimeMs) || 0);
}

function shouldInstallOntoDevice({
  appInstalled,
  stampIdentity,
  artifactIdentity: identity,
}) {
  if (!identity) return false;
  if (!appInstalled) return true;
  return String(stampIdentity || '') !== String(identity);
}

function walkFileMtimes(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkFileMtimes(full, acc);
      continue;
    }
    try {
      acc.push(fs.statSync(full).mtimeMs);
    } catch {
      /* ignore unreadable files */
    }
  }
  return acc;
}

function nativeSourceFiles(root, platform) {
  const files = [];
  if (platform === 'ios' || platform === 'both') {
    files.push(
      'ios/Podfile.lock',
      'ios/onTrack.xcodeproj/project.pbxproj',
      'ios/onTrack/Info.plist',
    );
  }
  if (platform === 'android' || platform === 'both') {
    files.push(
      'android/app/build.gradle',
      'android/build.gradle',
      'android/gradle.properties',
    );
  }
  return files.map((rel) => path.join(root, rel));
}

function collectNativeSourceMtimes(root, platform) {
  const times = [];
  for (const file of nativeSourceFiles(root, platform)) {
    try {
      times.push(fs.statSync(file).mtimeMs);
    } catch {
      /* optional path */
    }
  }
  const plugins = path.join(root, 'plugins');
  if (fs.existsSync(plugins)) walkFileMtimes(plugins, times);
  const modules = path.join(root, 'modules');
  if (fs.existsSync(modules)) walkFileMtimes(modules, times);
  return times;
}

function newestSourceMtime(root, platform) {
  return Math.max(0, ...collectNativeSourceMtimes(root, platform));
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i += 1;
      }
    } else {
      out._.push(arg);
    }
  }
  return out;
}

function printBool(value) {
  process.stdout.write(value ? '1\n' : '0\n');
}

function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  if (cmd === 'identity') {
    process.stdout.write(`${identityFromPath(args.path, args.version || '')}\n`);
    return;
  }
  if (cmd === 'rebuild-needed') {
    const artifact = args.artifact || '';
    const exists = Boolean(artifact && fs.existsSync(artifact));
    let artifactMtimeMs = 0;
    if (exists) artifactMtimeMs = fs.statSync(artifact).mtimeMs;
    printBool(
      shouldRebuildArtifact({
        artifactExists: exists,
        artifactMtimeMs,
        sourceMtimesMs: collectNativeSourceMtimes(
          args.root || process.cwd(),
          args.platform || 'both',
        ),
        force: Boolean(args.force),
      }),
    );
    return;
  }
  if (cmd === 'install-needed') {
    printBool(
      shouldInstallOntoDevice({
        appInstalled: args.installed === '1' || args.installed === 'true',
        stampIdentity: args.stamp || '',
        artifactIdentity: args['artifact-id'] || '',
      }),
    );
    return;
  }
  if (cmd === 'newest-source') {
    process.stdout.write(
      `${newestSourceMtime(args.root || process.cwd(), args.platform || 'both')}\n`,
    );
    return;
  }
  if (cmd === 'user-devices') {
    const devices = userVirtualDevices();
    const platform = args.platform || 'both';
    const names =
      platform === 'ios'
        ? devices.ios
        : platform === 'android'
          ? devices.android
          : [...devices.ios, ...devices.android];
    process.stdout.write(`${names.join('\n')}\n`);
    return;
  }
  throw new Error(
    'usage: native-build-freshness.js identity|rebuild-needed|install-needed|newest-source|user-devices',
  );
}

module.exports = {
  artifactIdentity,
  identityFromPath,
  shouldRebuildArtifact,
  shouldInstallOntoDevice,
  nativeSourceFiles,
  collectNativeSourceMtimes,
  newestSourceMtime,
  userVirtualDevices,
};

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  }
}
