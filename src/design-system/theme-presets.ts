import type { ThemeTokenOverrides } from './theme-overrides';
import type { ThemeAppearance } from './themes';

export type ThemePresetId = 'classic' | 'coast' | 'garden' | 'berry' | 'midnight' | 'ember';

export type ThemePreset = {
  id: ThemePresetId;
  name: string;
  description: string;
  colors: Readonly<Record<ThemeAppearance, ThemeTokenOverrides>>;
};

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Warm editorial glass',
    colors: { light: {}, dark: {} },
  },
  {
    id: 'coast',
    name: 'Coast',
    description: 'Airy blue and sea glass',
    colors: {
      light: {
        backgroundPrimary: '#EAF3F5',
        backgroundSecondary: '#DCECEF',
        backgroundElevated: '#F8FCFC',
        backgroundSunken: '#D6E7E9',
        textPrimary: '#132D35',
        textSecondary: '#42646D',
        textTertiary: '#6E8990',
        accentPrimary: '#18758A',
        accentSoft: '#69AEBB',
        accentFaint: '#C9E4E8',
        textOnAccent: '#F7FEFF',
        separator: '#BFD6DA',
        danger: '#B64E55',
      },
      dark: {
        backgroundPrimary: '#081A20',
        backgroundSecondary: '#0D252C',
        backgroundElevated: '#14323A',
        backgroundSunken: '#0A2026',
        textPrimary: '#F2FAFB',
        textSecondary: '#B8CED3',
        textTertiary: '#7E9DA4',
        accentPrimary: '#63C4D5',
        accentSoft: '#2C8394',
        accentFaint: '#163C45',
        textOnAccent: '#062027',
        separator: '#294951',
        danger: '#FF7E84',
      },
    },
  },
  {
    id: 'garden',
    name: 'Garden',
    description: 'Soft sage and evergreen',
    colors: {
      light: {
        backgroundPrimary: '#EEF3EA',
        backgroundSecondary: '#E2EBDD',
        backgroundElevated: '#FAFCF8',
        backgroundSunken: '#DCE7D6',
        textPrimary: '#203126',
        textSecondary: '#52675A',
        textTertiary: '#78887C',
        accentPrimary: '#3E7552',
        accentSoft: '#7DA88A',
        accentFaint: '#D4E5D6',
        textOnAccent: '#F8FFF9',
        separator: '#C8D8C4',
        danger: '#B55750',
      },
      dark: {
        backgroundPrimary: '#101812',
        backgroundSecondary: '#17231A',
        backgroundElevated: '#203025',
        backgroundSunken: '#131E16',
        textPrimary: '#F3F8F1',
        textSecondary: '#C2D2C5',
        textTertiary: '#8AA18E',
        accentPrimary: '#84C498',
        accentSoft: '#4C8A61',
        accentFaint: '#25402D',
        textOnAccent: '#102016',
        separator: '#344A39',
        danger: '#FF817A',
      },
    },
  },
  {
    id: 'berry',
    name: 'Berry',
    description: 'Plum glass and rose light',
    colors: {
      light: {
        backgroundPrimary: '#F7EDF3',
        backgroundSecondary: '#F0E0E9',
        backgroundElevated: '#FFF9FC',
        backgroundSunken: '#EAD9E3',
        textPrimary: '#351D2B',
        textSecondary: '#704C61',
        textTertiary: '#98778A',
        accentPrimary: '#A63F73',
        accentSoft: '#D783AC',
        accentFaint: '#F0CFE0',
        textOnAccent: '#FFF9FC',
        separator: '#DEC2D2',
        danger: '#B94E55',
      },
      dark: {
        backgroundPrimary: '#1B131B',
        backgroundSecondary: '#291A29',
        backgroundElevated: '#332334',
        backgroundSunken: '#241824',
        textPrimary: '#FFF5FC',
        textSecondary: '#D9C4D3',
        textTertiary: '#AA91A3',
        accentPrimary: '#E48DB8',
        accentSoft: '#B96892',
        accentFaint: '#48263A',
        textOnAccent: '#29121F',
        separator: '#51384E',
        danger: '#FF817D',
      },
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep navy and electric blue',
    colors: {
      light: {
        backgroundPrimary: '#EDF3FA',
        backgroundSecondary: '#DFEAF5',
        backgroundElevated: '#FAFCFF',
        backgroundSunken: '#D9E5F2',
        textPrimary: '#10283E',
        textSecondary: '#46647F',
        textTertiary: '#7089A0',
        accentPrimary: '#176EAF',
        accentSoft: '#69A8D6',
        accentFaint: '#CFE4F5',
        textOnAccent: '#F8FCFF',
        separator: '#BDD1E2',
        danger: '#B94E59',
      },
      dark: {
        backgroundPrimary: '#07111F',
        backgroundSecondary: '#0C1B2E',
        backgroundElevated: '#13263D',
        backgroundSunken: '#0A1727',
        textPrimary: '#F4F8FF',
        textSecondary: '#B7C8DE',
        textTertiary: '#7F96B1',
        accentPrimary: '#65B5FF',
        accentSoft: '#317FC5',
        accentFaint: '#173A5B',
        textOnAccent: '#061522',
        separator: '#29425F',
        danger: '#FF777E',
      },
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Smoked charcoal and warm amber',
    colors: {
      light: {
        backgroundPrimary: '#F5EFE7',
        backgroundSecondary: '#EDE3D7',
        backgroundElevated: '#FFF9F1',
        backgroundSunken: '#E8DCCC',
        textPrimary: '#35271B',
        textSecondary: '#705B46',
        textTertiary: '#967F68',
        accentPrimary: '#9B5B0B',
        accentSoft: '#D6923A',
        accentFaint: '#F1D9B7',
        textOnAccent: '#FFF9F1',
        separator: '#D9C7B1',
        danger: '#B94F42',
      },
      dark: {
        backgroundPrimary: '#171513',
        backgroundSecondary: '#211D18',
        backgroundElevated: '#2B251E',
        backgroundSunken: '#1D1915',
        textPrimary: '#FFF7E8',
        textSecondary: '#D7C7AE',
        textTertiary: '#A39176',
        accentPrimary: '#F0AE4D',
        accentSoft: '#B8782F',
        accentFaint: '#46321C',
        textOnAccent: '#261704',
        separator: '#493D30',
        danger: '#FF7D68',
      },
    },
  },
] as const;

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return THEME_PRESETS.some((preset) => preset.id === value);
}

export function findThemePreset(presetId: ThemePresetId): ThemePreset {
  return THEME_PRESETS.find((preset) => preset.id === presetId) ?? THEME_PRESETS[0];
}

export function resolveThemePresetColors(
  presetId: ThemePresetId,
  appearance: ThemeAppearance,
): ThemeTokenOverrides {
  return findThemePreset(presetId).colors[appearance];
}
