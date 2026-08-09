/**
 * VISUAL DIRECTION
 *
 * Editorial foundation (serif headlines, warm paper/ink, burnished-copper accent,
 * muted jewel category tints) with layered glass atmosphere for surfaces:
 * frosted chrome/cards/sheets over soft page washes. Feature scenic washes
 * (Travel sky, Today time-of-day) still win via SafeAreaChrome priority.
 * Restraint over glow soup — blur is performance-gated; Android prefers washes.
 */

import { categoryPalette, palette, type CategoryColorKey } from './colors';

export type ThemeAppearance = 'light' | 'dark';
export type ThemeFeatureScope = 'default' | 'travel' | 'plants' | 'vehicles' | 'food';

export interface Theme {
  name: ThemeAppearance;
  backgroundPrimary: string;
  backgroundSecondary: string;
  backgroundElevated: string;
  backgroundSunken: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnAccent: string;
  accentPrimary: string;
  accentSoft: string;
  accentFaint: string;
  separator: string;
  success: string;
  warning: string;
  danger: string;
  overlayScrim: string;
}

export const lightTheme: Theme = {
  name: 'light',
  backgroundPrimary: palette.paper0,
  backgroundSecondary: palette.paper1,
  backgroundElevated: '#FFFFFF',
  backgroundSunken: palette.paper2,
  textPrimary: palette.ink0,
  textSecondary: palette.ink2,
  textTertiary: palette.ink3,
  textOnAccent: '#FFF9F2',
  accentPrimary: palette.copper,
  accentSoft: palette.copperSoft,
  accentFaint: palette.copperFaint,
  separator: palette.paper3,
  success: palette.green,
  warning: palette.amber,
  danger: palette.red,
  overlayScrim: 'rgba(27, 24, 21, 0.45)',
};

export const darkTheme: Theme = {
  name: 'dark',
  backgroundPrimary: palette.night0,
  backgroundSecondary: palette.night1,
  backgroundElevated: palette.night2,
  backgroundSunken: palette.night1,
  textPrimary: palette.cream0,
  textSecondary: palette.cream1,
  textTertiary: palette.cream2,
  textOnAccent: '#FFF9F2',
  accentPrimary: palette.copperSoft,
  accentSoft: palette.copper,
  accentFaint: '#33261B',
  separator: palette.night3,
  success: palette.greenBright,
  warning: palette.amber,
  danger: palette.redBright,
  overlayScrim: 'rgba(0, 0, 0, 0.6)',
};

export const lightTravelTheme: Theme = {
  ...lightTheme,
  // Cool off-white itinerary wash — white cards sit on soft gray paper.
  // Top wash stays a light sky tint so Travel still reads as travel, not Today.
  backgroundPrimary: '#DCE8F1',
  backgroundSecondary: '#E8F0F6',
  backgroundElevated: '#F4F7FA',
  backgroundSunken: '#E2EBF2',
  separator: '#C5D4E0',
  textPrimary: '#0B1C28',
  textSecondary: '#3A5568',
  textTertiary: '#6A8294',
  accentPrimary: palette.travelBlue,
  accentSoft: palette.travelBlueSoft,
  accentFaint: palette.travelBlueFaint,
  textOnAccent: '#F7FCFF',
};

export const darkTravelTheme: Theme = {
  ...darkTheme,
  // Pure black base with slightly lifted elevated cards.
  backgroundPrimary: '#000000',
  backgroundSecondary: '#0A0A0A',
  backgroundElevated: '#141414',
  backgroundSunken: '#0A0A0A',
  separator: '#2A2A2A',
  textPrimary: '#F2F6FA',
  // Brighter secondary/tertiary so itinerary meta (times, day dates) stays
  // readable on near-black cards — old #A8B8C8 / #7A8FA3 read as mud in dark.
  textSecondary: '#C8D5E2',
  textTertiary: '#A8B8C8',
  accentPrimary: palette.travelBlueDark,
  accentSoft: palette.travelBlueSoftDark,
  accentFaint: palette.travelBlueFaintDark,
  textOnAccent: '#F7FCFF',
};

export const lightPlantTheme: Theme = {
  ...lightTheme,
  accentPrimary: palette.plantGreen,
  accentSoft: palette.plantGreenSoft,
  accentFaint: palette.plantGreenFaint,
  textOnAccent: '#F4FBF6',
};

export const darkPlantTheme: Theme = {
  ...darkTheme,
  accentPrimary: palette.plantGreenDark,
  accentSoft: palette.plantGreenSoftDark,
  accentFaint: palette.plantGreenFaintDark,
  textOnAccent: '#F4FBF6',
};

export const lightVehicleTheme: Theme = {
  ...lightTheme,
  accentPrimary: palette.vehicleSteel,
  accentSoft: palette.vehicleSteelSoft,
  accentFaint: palette.vehicleSteelFaint,
  textOnAccent: '#F5FAFD',
};

export const darkVehicleTheme: Theme = {
  ...darkTheme,
  accentPrimary: palette.vehicleSteelDark,
  accentSoft: palette.vehicleSteelSoftDark,
  accentFaint: palette.vehicleSteelFaintDark,
  textOnAccent: '#F5FAFD',
};

export const lightFoodTheme: Theme = {
  ...lightTheme,
  // Warm-neutral editorial ivory — quiet chrome that recedes behind food
  // photography; graphite accent instead of a hue so imagery owns the color.
  backgroundPrimary: '#F7F4EE',
  backgroundSecondary: '#FBF9F5',
  backgroundElevated: '#FFFDF9',
  backgroundSunken: '#EFEBE2',
  separator: '#E1DBD0',
  textPrimary: '#25231F',
  textSecondary: '#6D6860',
  textTertiary: '#918B82',
  accentPrimary: palette.foodGraphite,
  accentSoft: palette.foodGraphiteSoft,
  accentFaint: palette.foodGraphiteFaint,
  textOnAccent: '#F6F2EA',
  success: '#3E8D68',
  warning: '#B9852F',
  danger: '#B95750',
};

export const darkFoodTheme: Theme = {
  ...darkTheme,
  backgroundPrimary: '#11110F',
  backgroundSecondary: '#171613',
  backgroundElevated: '#1C1B18',
  backgroundSunken: '#171613',
  separator: '#302D28',
  textPrimary: '#F6F2EA',
  textSecondary: '#C0B9AF',
  textTertiary: '#8E887F',
  accentPrimary: palette.foodGraphiteDark,
  accentSoft: palette.foodGraphiteSoftDark,
  accentFaint: palette.foodGraphiteFaintDark,
  textOnAccent: '#1B1916',
  success: '#3E8D68',
  warning: '#B9852F',
  danger: '#B95750',
};

export interface CategoryColors {
  main: string;
  tint: string;
}

export function categoryColors(theme: Theme, key: CategoryColorKey): CategoryColors {
  const c = categoryPalette[key];
  return theme.name === 'light'
    ? { main: c.light, tint: c.tintLight }
    : { main: c.dark, tint: c.tintDark };
}

/** Time-of-day ambient wash colors for the Today header. */
export function timeOfDayGradient(theme: Theme, hour: number): [string, string] {
  const light = theme.name === 'light';
  // Tops sit near atmosphere cream so the header dissolve never opens a muddy ditch.
  if (hour < 6) return light ? ['#E8E4F0', palette.paper0] : ['#221F2E', palette.night0];
  if (hour < 11) return light ? ['#F5EBDF', palette.paper0] : ['#2E2418', palette.night0];
  if (hour < 17) return light ? ['#F2EDE4', palette.paper0] : ['#292520', palette.night0];
  if (hour < 21) return light ? ['#F1E6DC', palette.paper0] : ['#2E211A', palette.night0];
  return light ? ['#E6E4EE', palette.paper0] : ['#1F1D28', palette.night0];
}

/** Soft alpha stops for Today / scenic header washes (8-digit hex). */
export function hexWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.trim().replace('#', '');
  const rgb =
    normalized.length === 3
      ? normalized
          .split('')
          .map((ch) => `${ch}${ch}`)
          .join('')
      : normalized.slice(0, 6);
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${rgb}${a}`;
}

/** Top stop of the Today wash — paint the status-bar shell to match. */
export function timeOfDaySafeAreaBackground(theme: Theme, hour: number): string {
  return timeOfDayGradient(theme, hour)[0];
}

/** Shipped base theme for a feature scope + appearance (before local overrides). */
export function resolveBaseTheme(scope: ThemeFeatureScope, appearance: ThemeAppearance): Theme {
  if (scope === 'travel') {
    return appearance === 'dark' ? darkTravelTheme : lightTravelTheme;
  }
  if (scope === 'plants') {
    return appearance === 'dark' ? darkPlantTheme : lightPlantTheme;
  }
  if (scope === 'vehicles') {
    return appearance === 'dark' ? darkVehicleTheme : lightVehicleTheme;
  }
  if (scope === 'food') {
    return appearance === 'dark' ? darkFoodTheme : lightFoodTheme;
  }
  return appearance === 'dark' ? darkTheme : lightTheme;
}
