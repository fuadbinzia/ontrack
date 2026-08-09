import { darkFoodTheme, lightFoodTheme, resolveBaseTheme } from '../themes';

/**
 * Pins the Food hand-off palette (`.design/food-package/02_DESIGN_SYSTEM/design-tokens.json`)
 * onto the shared `Theme` contract. Dark mode is asserted here because the agent
 * device pool renders with a persisted light preference.
 */
describe('food theme scope', () => {
  it('resolves the food scope for both appearances', () => {
    expect(resolveBaseTheme('food', 'light')).toBe(lightFoodTheme);
    expect(resolveBaseTheme('food', 'dark')).toBe(darkFoodTheme);
  });

  it('carries the hand-off canvas and ink values', () => {
    expect(lightFoodTheme.backgroundPrimary).toBe('#F7F4EE');
    expect(lightFoodTheme.textPrimary).toBe('#25231F');
    expect(darkFoodTheme.backgroundPrimary).toBe('#11110F');
    expect(darkFoodTheme.textPrimary).toBe('#F6F2EA');
  });

  it('keeps semantic colors identical across appearances', () => {
    for (const key of ['success', 'warning', 'danger'] as const) {
      expect(darkFoodTheme[key]).toBe(lightFoodTheme[key]);
    }
    expect(lightFoodTheme.success).toBe('#3E8D68');
    expect(lightFoodTheme.warning).toBe('#B9852F');
    expect(lightFoodTheme.danger).toBe('#B95750');
  });

  it('inverts accent and on-accent ink so buttons stay legible in the dark scope', () => {
    expect(luminance(darkFoodTheme.accentPrimary)).toBeGreaterThan(
      luminance(lightFoodTheme.accentPrimary),
    );
    expect(contrastRatio(lightFoodTheme.accentPrimary, lightFoodTheme.textOnAccent)).toBeGreaterThan(
      4.5,
    );
    expect(contrastRatio(darkFoodTheme.accentPrimary, darkFoodTheme.textOnAccent)).toBeGreaterThan(
      4.5,
    );
  });

  it('meets WCAG AA for body text on the canvas in both appearances', () => {
    expect(contrastRatio(lightFoodTheme.backgroundPrimary, lightFoodTheme.textPrimary)).toBeGreaterThan(4.5);
    expect(contrastRatio(lightFoodTheme.backgroundPrimary, lightFoodTheme.textSecondary)).toBeGreaterThan(4.5);
    expect(contrastRatio(darkFoodTheme.backgroundPrimary, darkFoodTheme.textPrimary)).toBeGreaterThan(4.5);
    expect(contrastRatio(darkFoodTheme.backgroundPrimary, darkFoodTheme.textSecondary)).toBeGreaterThan(4.5);
  });
});

function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
