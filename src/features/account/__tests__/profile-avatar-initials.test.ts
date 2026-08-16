import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  AVATAR_INITIALS_MIN_FONT,
  AVATAR_INITIALS_SIZE_RATIO,
  avatarIconGlyphSize,
  avatarInitialsFontSize,
} from '@/features/account/profile-avatar-model';

describe('profile avatar initials sizing', () => {
  it('sizes initials from diameter with a readable floor', () => {
    // Keep two letters inside the circle — a high floor clips tiny marks (e.g. 22pt chips).
    expect(avatarInitialsFontSize(22)).toBeLessThanOrEqual(13);
    expect(avatarInitialsFontSize(22)).toBeGreaterThanOrEqual(10);
    // Caption-sized checklist chips (~lineHeight) must stay under the diameter.
    expect(avatarInitialsFontSize(15)).toBeLessThanOrEqual(9);
    expect(avatarInitialsFontSize(15)).toBeGreaterThanOrEqual(7);
    expect(avatarInitialsFontSize(80)).toBe(Math.round(80 * AVATAR_INITIALS_SIZE_RATIO));
    expect(avatarInitialsFontSize(80)).toBeGreaterThanOrEqual(AVATAR_INITIALS_MIN_FONT);
    expect(avatarIconGlyphSize(80)).toBeGreaterThanOrEqual(14);
  });

  it('keeps ProfileAvatar free of shrink-to-fit text (regression: tiny IH)', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/account/profile-avatar.tsx'),
      'utf8',
    );

    expect(source).toContain('avatarInitialsFontSize');
    expect(source).toMatch(/from 'react-native'/);
    expect(source).toMatch(/\bText\b/);
    // Always the app face — tiny chips must not fall back to system sans.
    expect(source).toMatch(/fontFamily:\s*typeConfig\.fontFamily/);
    expect(source).not.toMatch(/size\s*<\s*40/);
    // Shrink-to-fit collapses initials inside a circular mark.
    expect(source).not.toMatch(/<AppText[\s>]/);
    expect(source).not.toMatch(/adjustsFontSizeToFit/);
    expect(source).not.toMatch(/\bfit\s*=/);
    expect(source).not.toMatch(/fitMinimumScale/);
    expect(source).toContain('transition={0}');
    expect(source).toContain('cachePolicy="memory-disk"');
    expect(source).toContain('initialAvatarPhotoUrl');
  });
});
