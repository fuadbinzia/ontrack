import { authAtmosphere, authPalette, authThemeTokens } from '../auth-palette';

describe('auth dusty-blue palette', () => {
  it('keeps the mock swatches stable', () => {
    expect(authPalette.mist).toBe('#F1F4F5');
    expect(authPalette.fog).toBe('#D5E0E4');
    expect(authPalette.dust).toBe('#718C98');
    expect(authPalette.ink).toBe('#29363B');
  });

  it('maps light atmosphere to cool mist → fog', () => {
    const sky = authAtmosphere('light');
    expect(sky.top).toBe(authPalette.mist);
    expect(sky.bottom).toBe(authPalette.fog);
  });

  it('scopes light accents to dusty blue ink', () => {
    const tokens = authThemeTokens('light');
    expect(tokens.accentPrimary).toBe(authPalette.dust);
    expect(tokens.textPrimary).toBe(authPalette.ink);
  });
});
