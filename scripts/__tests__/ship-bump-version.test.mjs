import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bumpPatchVersion } from '../ship-bump-version.mjs';

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
