import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AUTH_COPY_SCALE_MIN } from '@/features/auth/auth-constellation-layout';
import {
  AUTH_RING_HEADLINE_MIN_PT,
  AUTH_RING_INTRO_MIN_PT,
  authRingCopyType,
} from '@/features/auth/auth-ring-copy-type';

const TOKENS = {
  display: { fontSize: 42, lineHeight: 48 },
  body: { fontSize: 15.5, lineHeight: 22 },
};

describe('authRingCopyType', () => {
  it('keeps intro at body size even when the canvas scale is tiny', () => {
    const crushed = authRingCopyType(0.55, TOKENS);
    expect(crushed.intro.fontSize).toBe(AUTH_RING_INTRO_MIN_PT);
    expect(crushed.intro.fontSize).toBeGreaterThanOrEqual(TOKENS.body.fontSize);
    expect(crushed.headline.fontSize).toBeGreaterThanOrEqual(
      AUTH_RING_HEADLINE_MIN_PT,
    );
  });

  it('does not scale intro down at full size', () => {
    const full = authRingCopyType(1, TOKENS);
    expect(full.intro.fontSize).toBe(TOKENS.body.fontSize);
    expect(full.headline.fontSize).toBe(TOKENS.display.fontSize);
  });

  it('keeps type floors when the planet column is narrow', () => {
    const compact = authRingCopyType(AUTH_COPY_SCALE_MIN, TOKENS);
    expect(compact.headline.fontSize).toBeGreaterThanOrEqual(
      AUTH_RING_HEADLINE_MIN_PT,
    );
    expect(compact.intro.fontSize).toBe(TOKENS.body.fontSize);
    expect(compact.intro.fontSize).toBeGreaterThanOrEqual(AUTH_RING_INTRO_MIN_PT);
  });

  it('keeps welcome and upgrade heroes on the shared ring copy', () => {
    const welcome = readFileSync(
      join(process.cwd(), 'src/features/auth/welcome-onboard-screen.tsx'),
      'utf8',
    );
    const hero = readFileSync(
      join(process.cwd(), 'src/features/auth/auth-hero.tsx'),
      'utf8',
    );
    const ring = readFileSync(
      join(process.cwd(), 'src/features/auth/auth-ring-copy.tsx'),
      'utf8',
    );

    expect(welcome).toContain('AuthRingCopy');
    expect(hero).toContain('AuthRingCopy');
    expect(welcome).not.toContain('adjustsFontSizeToFit');
    expect(hero).not.toContain('adjustsFontSizeToFit');
    expect(ring).not.toContain('adjustsFontSizeToFit');
  });
});
