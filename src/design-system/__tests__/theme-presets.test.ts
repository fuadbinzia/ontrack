import { relativeLuminanceFromColor } from '@/design-system/glass';
import { applyThemeOverrides } from '@/design-system/theme-overrides';
import {
  resolveThemePresetColors,
  THEME_PRESETS,
} from '@/design-system/theme-presets';
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
      for (const appearance of ['light', 'dark'] as const) {
        const theme = applyThemeOverrides(
          resolveBaseTheme('default', appearance),
          preset.colors[appearance],
        );
        expect(theme.backgroundPrimary).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(theme.accentPrimary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('resolves every preset to an intentional palette for both brightness modes', () => {
    for (const preset of THEME_PRESETS) {
      const light = applyThemeOverrides(
        resolveBaseTheme('default', 'light'),
        resolveThemePresetColors(preset.id, 'light'),
      );
      const dark = applyThemeOverrides(
        resolveBaseTheme('default', 'dark'),
        resolveThemePresetColors(preset.id, 'dark'),
      );

      expect(dark.name).toBe('dark');
      expect(light.name).toBe('light');
      expect(dark.backgroundPrimary).not.toBe(light.backgroundPrimary);
      expect(relativeLuminanceFromColor(dark.backgroundPrimary)).toBeLessThan(
        relativeLuminanceFromColor(light.backgroundPrimary) ?? 0,
      );
    }
  });

  it('keeps primary copy and button labels readable in light and dark palettes', () => {
    // Classic preserves the shipped palette; the newly introduced presets meet AA.
    for (const preset of THEME_PRESETS.filter((candidate) => candidate.id !== 'classic')) {
      for (const appearance of ['light', 'dark'] as const) {
        const theme = applyThemeOverrides(
          resolveBaseTheme('default', appearance),
          preset.colors[appearance],
        );
        expect(contrastRatio(theme.backgroundPrimary, theme.textPrimary)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.accentPrimary, theme.textOnAccent)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
