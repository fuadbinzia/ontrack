import {
    applyThemeOverrides,
    emptyThemeOverrides,
    normalizeHexColor,
    prependThemeOverrideHistory,
    sanitizeThemeOverrideHistory,
    sanitizeThemeOverridesByScope,
    sanitizeThemeTokenOverrides,
} from '@/design-system/theme-overrides';
import { lightTheme } from '@/design-system/themes';

describe('normalizeHexColor', () => {
  it('normalizes 6-digit hex with or without #', () => {
    expect(normalizeHexColor('#9a7654')).toBe('#9A7654');
    expect(normalizeHexColor('2474A8')).toBe('#2474A8');
  });

  it('expands 3-digit hex', () => {
    expect(normalizeHexColor('#abc')).toBe('#AABBCC');
    expect(normalizeHexColor('f0a')).toBe('#FF00AA');
  });

  it('rejects invalid values', () => {
    expect(normalizeHexColor('')).toBeNull();
    expect(normalizeHexColor('#gg0000')).toBeNull();
    expect(normalizeHexColor('#12345')).toBeNull();
    expect(normalizeHexColor('red')).toBeNull();
  });
});

describe('applyThemeOverrides', () => {
  it('returns the base theme when overrides are empty', () => {
    expect(applyThemeOverrides(lightTheme)).toBe(lightTheme);
    expect(applyThemeOverrides(lightTheme, {})).toBe(lightTheme);
  });

  it('merges valid editable tokens and ignores junk', () => {
    const next = applyThemeOverrides(lightTheme, {
      accentPrimary: '#2474a8',
      danger: 'not-a-color',
      textOnAccent: '#fff',
    });
    expect(next).not.toBe(lightTheme);
    expect(next.accentPrimary).toBe('#2474A8');
    expect(next.textOnAccent).toBe('#FFFFFF');
    expect(next.danger).toBe(lightTheme.danger);
    expect(next.backgroundPrimary).toBe(lightTheme.backgroundPrimary);
  });
});

describe('sanitizeThemeOverridesByScope', () => {
  it('keeps only valid scoped tokens', () => {
    const sanitized = sanitizeThemeOverridesByScope({
      default: { accentPrimary: '#abc', backgroundPrimary: '#000000' },
      travel: { accentPrimary: 'oops', accentSoft: '#4d96c5' },
      plants: null,
      unknown: { accentPrimary: '#000000' },
    });
    expect(sanitized.default).toEqual({
      accentPrimary: '#AABBCC',
      backgroundPrimary: '#000000',
    });
    expect(sanitized.travel).toEqual({ accentSoft: '#4D96C5' });
    expect(sanitized.plants).toEqual({});
    expect(sanitized.vehicles).toEqual({});
    expect(sanitizeThemeTokenOverrides(null)).toEqual({});
    expect(emptyThemeOverrides().default).toEqual({});
  });
});

describe('theme override history helpers', () => {
  it('sanitizes and prepends history entries', () => {
    const sanitized = sanitizeThemeOverrideHistory([
      {
        id: 'a',
        at: '2026-08-05T12:00:00.000Z',
        by: 'Rocky',
        action: 'set',
        scope: 'default',
        key: 'accentPrimary',
        from: null,
        to: '#2474a8',
        summary: 'Set App / Buttons · Accent to #2474A8',
      },
      { id: 'bad' },
    ]);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]?.to).toBe('#2474A8');

    const next = prependThemeOverrideHistory(sanitized, {
      id: 'b',
      at: '2026-08-05T13:00:00.000Z',
      by: 'Rocky',
      action: 'resetAll',
      summary: 'Restored all theme defaults',
    });
    expect(next.map((entry) => entry.id)).toEqual(['b', 'a']);
  });
});
