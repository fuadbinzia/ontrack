#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const MINIMUM_BYTES = 1024 * 1024;
const MINIMUM_SAVINGS_RATIO = 0.02;
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const projectRoot = process.cwd();
const assetsRoot = path.join(projectRoot, 'assets');

function collectOversizedAssets(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const pending = [directory];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolutePath);
      else if (
        entry.isFile() &&
        SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) &&
        fs.statSync(absolutePath).size > MINIMUM_BYTES
      ) {
        files.push(absolutePath);
      }
    }
  }
  return files.sort();
}

function optimizedPipeline(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const pipeline = sharp(filePath, { failOn: 'warning' }).rotate();
  if (extension === '.jpg' || extension === '.jpeg') {
    return pipeline.jpeg({ quality: 84, mozjpeg: true });
  }
  if (extension === '.webp') {
    return pipeline.webp({ quality: 84, effort: 6 });
  }
  return pipeline.png({
    adaptiveFiltering: true,
    compressionLevel: 9,
    effort: 10,
  });
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

async function optimizeAsset(filePath) {
  const originalBytes = fs.statSync(filePath).size;
  const temporaryPath = `${filePath}.ontrack-optimize.tmp`;
  try {
    await optimizedPipeline(filePath).toFile(temporaryPath);
    const optimizedBytes = fs.statSync(temporaryPath).size;
    if (optimizedBytes >= originalBytes * (1 - MINIMUM_SAVINGS_RATIO)) {
      fs.rmSync(temporaryPath, { force: true });
      return { filePath, originalBytes, optimizedBytes: originalBytes, changed: false };
    }
    fs.renameSync(temporaryPath, filePath);
    return { filePath, originalBytes, optimizedBytes, changed: true };
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw new Error(
      `Could not optimize ${path.relative(projectRoot, filePath)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const candidates = collectOversizedAssets(assetsRoot);
const results = [];
for (const candidate of candidates) results.push(await optimizeAsset(candidate));

const changed = results.filter((result) => result.changed);
const bytesSaved = changed.reduce(
  (total, result) => total + result.originalBytes - result.optimizedBytes,
  0,
);

process.stdout.write('\nAsset optimization\n');
for (const result of changed) {
  process.stdout.write(
    `- ${path.relative(projectRoot, result.filePath)}: ${formatBytes(result.originalBytes)} → ${formatBytes(result.optimizedBytes)}\n`,
  );
}
process.stdout.write(
  changed.length > 0
    ? `Saved ${formatBytes(bytesSaved)} across ${changed.length} asset${changed.length === 1 ? '' : 's'}.\n\n`
    : `No oversized assets could be reduced by at least ${MINIMUM_SAVINGS_RATIO * 100}%.\n\n`,
);
