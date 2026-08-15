import { relativeLuminanceFromColor } from '@/design-system/glass';
import { applyThemeOverrides } from '@/design-system/theme-overrides';
import { THEME_PRESETS } from '@/design-system/theme-presets';
import { resolveBaseTheme } from '@/design-system/themes';

function contrastRatio(first: string, second: string): number {
  const a = relativeLuminanceFromColor(first);
  const b = relativeLuminanceFromColor(second);
  if (a === undefined || b === undefined) return 0;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('app theme presets', () => {
  it('has unique ids and valid colors', () => {
    expect(new Set(THEME_PRESETS.map((preset) => preset.id)).size).toBe(THEME_PRESETS.length);
    for (const preset of THEME_PRESETS) {
      const theme = applyThemeOverrides(
        resolveBaseTheme('default', preset.appearance),
        preset.colors,
      );
      expect(theme.backgroundPrimary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.accentPrimary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('keeps primary copy and button labels readable', () => {
    // Classic preserves the shipped palette; the newly introduced presets meet AA.
    for (const preset of THEME_PRESETS.filter((candidate) => candidate.id !== 'classic')) {
      const theme = applyThemeOverrides(
        resolveBaseTheme('default', preset.appearance),
        preset.colors,
      );
      expect(contrastRatio(theme.backgroundPrimary, theme.textPrimary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.accentPrimary, theme.textOnAccent)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
