import { lightTravelTheme } from '@/design-system';
import {
  deepenArtworkTintForGlass,
  headerSkyLightTintColor,
  lightenArtworkTintForGlass,
  normalizeArtworkTintHex,
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

  it('picks the lightest candidate hex', () => {
    expect(pickLightestArtworkTint('#021734', '#B7CBD0', '#1E3A42')).toBe(
      '#B7CBD0',
    );
  });

  it('lightens dark plate samples into frost-friendly pastels', () => {
    const light = lightenArtworkTintForGlass('#021734');
    expect(light).not.toBe('#021734');
    expect(relativeLuminanceFromHex(light)!).toBeGreaterThan(0.55);
    expect(travelArtworkTintPrefersLightInk(light)).toBe(false);
    // Alias still lifts (glass no longer deepens).
    expect(deepenArtworkTintForGlass('#1E3A42')).toBe(
      lightenArtworkTintForGlass('#1E3A42'),
    );
  });

  it('keeps already-light washes near themselves', () => {
    expect(lightenArtworkTintForGlass('#DCE8F1')).toBe('#DCE8F1');
  });

  it('resolves Iceland / aurora glass to the light sky mist (not dark chrome)', () => {
    const tint = resolveTravelArtworkTintHex({
      themeDark: false,
      look: 'night-clear',
      destination: 'Reykjavík, Iceland',
    });
    expect(tint).toBe(
      headerSkyLightTintColor({
        themeDark: false,
        look: 'night-clear',
        destination: 'Reykjavík, Iceland',
      }),
    );
    expect(tint).not.toBe(HEADER_SKY_AURORA_CHROME);
    expect(travelArtworkTintPrefersLightInk(tint)).toBe(false);
  });

  it('still prefers a lighter photo sample when it beats the sky mist', () => {
    const tint = resolveTravelArtworkTintHex({
      averageColor: '#E8EEF5',
      themeDark: false,
      look: 'night-clear',
      destination: 'Lisbon',
    });
    expect(tint).toBe('#E8EEF5');
    expect(tint).not.toBe(HEADER_SKY_NIGHT_CHROME);
  });

  it('builds translucent shell/mist fills (never opaque paper)', () => {
    const mistHex = headerSkyLightTintColor({
      themeDark: false,
      look: 'night-clear',
      destination: 'Iceland',
    });
    const shell = travelArtworkGlassFill(mistHex, 'shell', {
      airy: true,
      allowsBlur: true,
    });
    expect(shell.fill.startsWith('rgba(')).toBe(true);
    expect(shell.darkMaterial).toBe(false);
    expect(shell.fill).not.toContain(', 1)');
  });

  it('keeps light-theme kind accents on light artwork glass', () => {
    expect(kindAccent('flight', lightTravelTheme)).toBe('#315A7C');
    expect(kindAccent('flight', lightTravelTheme, { darkGlass: true })).toBe(
      '#8DB2CF',
    );
  });
});
