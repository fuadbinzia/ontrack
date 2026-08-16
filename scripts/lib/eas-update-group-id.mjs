#!/usr/bin/env node
/**
 * Read `eas update --json` stdout and print the update group ID.
 * Non-interactive `eas update:republish` requires `--group`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function easUpdateGroupId(raw) {
  const text = String(raw ?? '').trim();
  if (!text) {
    throw new Error('eas update json is empty');
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.search(/[\[{]/);
    if (start < 0) {
      throw new Error('eas update json missing');
    }
    parsed = JSON.parse(text.slice(start));
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.updates)
      ? parsed.updates
      : [parsed];
  const group = rows.find((row) => row && typeof row.group === 'string')?.group;
  if (!group) {
    throw new Error('eas update json missing group');
  }
  return group;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(easUpdateGroupId(readFileSync(0, 'utf8')));
}
