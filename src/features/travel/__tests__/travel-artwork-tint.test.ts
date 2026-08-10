import { lightTravelTheme } from '@/design-system';
import {
  deepenArtworkTintForGlass,
  headerSkyLightTintColor,
  lightenArtworkTintForGlass,
  normalizeArtworkTintHex,
  pickDarkestArtworkTint,
  pickLightestArtworkTint,
  resolveTravelArtworkTintHex,
  travelArtworkGlassFill,
  travelArtworkTintPrefersLightInk,
} from '@/features/travel/travel-artwork-tint';
import { kindAccent } from '@/features/travel/travel-kind-chrome';
import {
  HEADER_SKY_AURORA_CHROME,
  HEADER_SKY_NIGHT_CHROME,
} from '@/features/travel/travel-sky-condition';
import { relativeLuminanceFromHex } from '@/features/travel/travel-home-atmosphere-ink';

describe('travel artwork tint', () => {
  it('normalizes short hex and rejects junk', () => {
    expect(normalizeArtworkTintHex('#1e3')).toBe('#11EE33');
    expect(normalizeArtworkTintHex('#1E3A42')).toBe('#1E3A42');
    expect(normalizeArtworkTintHex('not-a-color')).toBeUndefined();
  });

  it('picks the lightest / darkest candidate hex', () => {
    expect(pickLightestArtworkTint('#021734', '#B7CBD0', '#1E3A42')).toBe(
      '#B7CBD0',
    );
    expect(pickDarkestArtworkTint('#021734', '#B7CBD0', '#1E3A42')).toBe(
      '#021734',
    );
  });

  it('lightens dark plate samples into frost-friendly pastels (day path)', () => {
    const light = lightenArtworkTintForGlass('#021734');
    expect(light).not.toBe('#021734');
    expect(relativeLuminanceFromHex(light)!).toBeGreaterThan(0.55);
    expect(travelArtworkTintPrefersLightInk(light)).toBe(false);
  });

  it('deepens bright samples into dark glass candidates (night path)', () => {
    const deep = deepenArtworkTintForGlass('#E8EEF5');
    expect(deep).not.toBe('#E8EEF5');
    expect(relativeLuminanceFromHex(deep)!).toBeLessThan(0.4);
    expect(travelArtworkTintPrefersLightInk(deep)).toBe(true);
    expect(deepenArtworkTintForGlass('#0C1423')).toBe('#0C1423');
  });

  it('keeps already-light washes near themselves', () => {
    expect(lightenArtworkTintForGlass('#DCE8F1')).toBe('#DCE8F1');
  });

  it('resolves night / aurora glass to dark chrome with light ink', () => {
    const iceland = resolveTravelArtworkTintHex({
      themeDark: false,
      look: 'night-clear',
      destination: 'Reykjavík, Iceland',
    });
    expect(iceland).toBe(HEADER_SKY_AURORA_CHROME);
    expect(travelArtworkTintPrefersLightInk(iceland)).toBe(true);

    const portugal = resolveTravelArtworkTintHex({
      themeDark: false,
      look: 'night-clear',
      destination: 'Lisbon, Portugal',
    });
    expect(portugal).toBe(HEADER_SKY_NIGHT_CHROME);
    expect(travelArtworkTintPrefersLightInk(portugal)).toBe(true);
  });

  it('deepens a light photo sample on night plates instead of milky frost', () => {
    const tint = resolveTravelArtworkTintHex({
      averageColor: '#E8EEF5',
      themeDark: false,
      look: 'night-clear',
      destination: 'Lisbon',
    });
    expect(travelArtworkTintPrefersLightInk(tint)).toBe(true);
    expect(relativeLuminanceFromHex(tint)!).toBeLessThanOrEqual(
      relativeLuminanceFromHex(HEADER_SKY_NIGHT_CHROME)!,
    );
    expect(tint).not.toBe('#E8EEF5');
  });

  it('keeps day glass on light pastels (not night chrome)', () => {
    const tint = resolveTravelArtworkTintHex({
      themeDark: false,
      look: 'sunny',
      destination: 'Lisbon',
    });
    expect(tint).toBe(
      headerSkyLightTintColor({
        themeDark: false,
        look: 'sunny',
        destination: 'Lisbon',
      }),
    );
    expect(travelArtworkTintPrefersLightInk(tint)).toBe(false);
  });

  it('builds translucent shell/mist fills (never opaque paper)', () => {
    const shell = travelArtworkGlassFill(HEADER_SKY_NIGHT_CHROME, 'shell', {
      airy: true,
      allowsBlur: true,
    });
    expect(shell.fill.startsWith('rgba(')).toBe(true);
    expect(shell.darkMaterial).toBe(true);
    expect(shell.fill).not.toContain(', 1)');
  });

  it('keeps light-theme kind accents on light artwork glass', () => {
    expect(kindAccent('flight', lightTravelTheme)).toBe('#315A7C');
    expect(kindAccent('flight', lightTravelTheme, { darkGlass: true })).toBe(
      '#8DB2CF',
    );
  });
});
