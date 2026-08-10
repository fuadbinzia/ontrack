/**
 * Dusty Blue sign-in shell — calm cool wash matching the Welcome-back mock.
 * Scoped to AuthAtmosphere / AuthTheme; does not change app-wide paper/copper.
 */
export const authPalette = {
  /** Page mist — mock background. */
  mist: '#F1F4F5',
  /** Soft plate / icon-well chill. */
  fog: '#D5E0E4',
  /** Links, orbit ink, soft accent. */
  dust: '#718C98',
  /** Headlines, wordmark, Apple fill. */
  ink: '#29363B',
  /** Night sky top (locked / dark preference). */
  nightMist: '#1C2733',
  nightFog: '#425C7A',
  nightDust: '#7A96B8',
  nightInk: '#EEF2F6',
} as const;

export type AuthAtmosphereTokens = {
  top: string;
  mid: string;
  bottom: string;
  orb: string;
  cool: string;
  veil: readonly [string, string, string] | readonly [string, string, string, string];
  veilLocations: readonly number[];
  star: string;
};

/** Full-bleed sky stops for the signed-out shell. */
export function authAtmosphere(appearance: 'light' | 'dark'): AuthAtmosphereTokens {
  if (appearance === 'dark') {
    return {
      top: authPalette.nightMist,
      mid: '#243542',
      bottom: '#141C22',
      orb: 'rgba(122, 150, 184, 0.22)',
      cool: 'rgba(66, 92, 122, 0.2)',
      veil: ['rgba(255,255,255,0.05)', 'transparent', 'rgba(0,0,0,0.32)'],
      veilLocations: [0, 0.4, 1],
      star: '#EAF1FF',
    };
  }
  return {
    // Pale top → soft fog mid → slightly cooler floor under the provider card.
    top: authPalette.mist,
    mid: '#E6ECF0',
    bottom: authPalette.fog,
    orb: 'rgba(113, 140, 152, 0.16)',
    cool: 'rgba(213, 224, 228, 0.55)',
    veil: [
      'rgba(255,255,255,0.55)',
      'rgba(255,255,255,0.18)',
      'transparent',
      'rgba(41, 54, 59, 0.04)',
    ],
    veilLocations: [0, 0.26, 0.62, 1],
    star: '#EAF1FF',
  };
}

/** Accent + ink tokens merged onto the active theme while AuthAtmosphere is up. */
export function authThemeTokens(appearance: 'light' | 'dark') {
  if (appearance === 'dark') {
    return {
      textPrimary: authPalette.nightInk,
      textSecondary: '#C9D6E5',
      textTertiary: '#7A96B8',
      accentPrimary: authPalette.nightDust,
      accentSoft: authPalette.nightFog,
      accentFaint: '#243542',
      textOnAccent: authPalette.nightMist,
      separator: 'rgba(201, 214, 229, 0.22)',
      backgroundPrimary: authPalette.nightMist,
      backgroundSecondary: '#141C22',
    } as const;
  }
  return {
    textPrimary: authPalette.ink,
    textSecondary: '#4A5C64',
    textTertiary: '#718C98',
    accentPrimary: authPalette.dust,
    accentSoft: '#8AA3AD',
    accentFaint: authPalette.fog,
    textOnAccent: '#F7FBFC',
    separator: 'rgba(41, 54, 59, 0.12)',
    backgroundPrimary: authPalette.mist,
    backgroundSecondary: authPalette.fog,
  } as const;
}
