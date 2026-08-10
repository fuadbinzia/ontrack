import { glassDynamicTintMaterials } from '@/design-system/glass';

describe('glassDynamicTintMaterials', () => {
  const darkHex = '#1E3A42';
  const lightHex = '#E8EEF5';

  it('keeps mist translucent when BlurView frost is available (iOS)', () => {
    const mist = glassDynamicTintMaterials(darkHex, {
      mist: true,
      allowsBlur: true,
    });
    expect(mist?.fill).toBe('rgba(30, 58, 66, 0.22)');
  });

  it('densifies mist when fill-only (Android / blur-gated)', () => {
    const mist = glassDynamicTintMaterials(darkHex, {
      mist: true,
      allowsBlur: false,
    });
    expect(mist?.fill).toBe('rgba(30, 58, 66, 0.52)');
    expect(mist?.border).toBe('rgba(30, 58, 66, 0.58)');
  });

  it('uses solid shell alphas when fill-only so artwork cannot read sharp through', () => {
    const shell = glassDynamicTintMaterials(darkHex, {
      airy: true,
      allowsBlur: false,
    });
    expect(shell?.fill).toBe('rgba(30, 58, 66, 0.72)');
    const light = glassDynamicTintMaterials(lightHex, {
      airy: true,
      allowsBlur: false,
    });
    expect(light?.fill).toBe('rgba(232, 238, 245, 0.62)');
  });

  it('keeps blur-tier shell alphas when frost is available', () => {
    const shell = glassDynamicTintMaterials(darkHex, {
      airy: true,
      allowsBlur: true,
    });
    expect(shell?.fill).toBe('rgba(30, 58, 66, 0.46)');
  });
});
