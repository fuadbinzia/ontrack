import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { bumpPatchVersion, prependCatalogEntry } from '../ship-bump-version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('bumpPatchVersion', () => {
  it('increments the patch segment', () => {
    assert.equal(bumpPatchVersion('1.0.2'), '1.0.3');
    assert.equal(bumpPatchVersion('2.4.9'), '2.4.10');
    assert.equal(bumpPatchVersion('1.0'), '1.0.1');
  });

  it('rejects non-semver-like values', () => {
    assert.throws(() => bumpPatchVersion('v1'), /semver-like/);
    assert.throws(() => bumpPatchVersion(''), /semver-like/);
  });

  it('keeps the patch segment numeric for Android version codes', () => {
    assert.equal(Number(bumpPatchVersion('1.0.67').split('.')[2]), 68);
    assert.equal(Number(bumpPatchVersion('2.4.9').split('.')[2]), 10);
  });
});

describe('prependCatalogEntry (JSON catalogs)', () => {
  const existing = [
    { version: '1.0.2', date: '2026-08-07', notes: ['Older note.'] },
    { version: '1.0.1', date: '2026-07-15', notes: ['Oldest note.'] },
  ];
  const entry = {
    version: '1.0.3',
    date: '2026-08-16',
    notes: ["New note with 'quotes' and\u00A0specials."],
  };

  it('prepends the new entry newest-first and preserves existing entries', () => {
    const out = prependCatalogEntry(JSON.stringify(existing), entry);
    const parsed = JSON.parse(out);
    assert.equal(parsed.length, 3);
    assert.deepEqual(parsed[0], entry);
    assert.deepEqual(parsed.slice(1), existing);
  });

  it('emits pretty JSON with a trailing newline', () => {
    const out = prependCatalogEntry('[]', entry);
    assert.ok(out.endsWith('\n'));
    assert.equal(out, `${JSON.stringify([entry], null, 2)}\n`);
  });

  it('rejects catalogs that are not JSON arrays', () => {
    assert.throws(() => prependCatalogEntry('{}', entry), /JSON array/);
    assert.throws(() => prependCatalogEntry('not json', entry), SyntaxError);
  });
});

describe('ship-bump-version end-to-end', () => {
  it('dry-run bumps against the real JSON catalogs without writing', () => {
    const out = execFileSync(
      process.execPath,
      [
        join(ROOT, 'scripts/ship-bump-version.mjs'),
        '--message',
        'regression dry run',
        '--dry-run',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.match(out, /==> Version \d+\.\d+\.\d+ → \d+\.\d+\.\d+/);
    assert.match(out, /\[dry-run\] no files written/);
  });
});
