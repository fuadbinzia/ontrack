import {
  darkTheme,
  lightTheme,
  relativeLuminanceFromColor,
  ufcFightCardColors,
} from '@/design-system';

function contrast(first: string, second: string) {
  const a = relativeLuminanceFromColor(first);
  const b = relativeLuminanceFromColor(second);
  if (a === undefined || b === undefined) throw new Error('Expected hex colors');
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

describe.each([lightTheme, darkTheme])('UFC fight-card colors in $name mode', (theme) => {
  const colors = ufcFightCardColors(theme);

  it('keeps names and records crisp on the theme-appropriate broadcast board', () => {
    expect(contrast(colors.primaryText, colors.board)).toBeGreaterThan(12);
    expect(contrast(colors.secondaryText, colors.board)).toBeGreaterThan(5);
    expect(contrast(colors.headerText, colors.header)).toBeGreaterThan(4.5);
  });

  it('keeps the saturated red identity in card chrome instead of fighter rings', () => {
    expect(colors.header).not.toBe(theme.danger);
    expect(colors.header).not.toBe(colors.board);
    expect(colors).not.toHaveProperty('redCorner');
    expect(colors).not.toHaveProperty('blueCorner');
  });

  it('uses a light neutral portrait matte with a quieter defining rim', () => {
    expect(relativeLuminanceFromColor(colors.portraitMatte)).toBeGreaterThan(0.65);
    expect(contrast(colors.portraitMatte, colors.portraitRim)).toBeLessThan(1.8);
    expect(colors.portraitMatte).not.toBe(colors.board);
  });
});

it('uses a light board in light mode and a dark board in dark mode', () => {
  const light = ufcFightCardColors(lightTheme);
  const dark = ufcFightCardColors(darkTheme);

  expect(relativeLuminanceFromColor(light.board)).toBeGreaterThan(0.8);
  expect(relativeLuminanceFromColor(dark.board)).toBeLessThan(0.02);
  expect(light.primaryText).not.toBe(dark.primaryText);
});
