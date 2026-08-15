import type { ThemeTokenOverrides } from './theme-overrides';
import type { ThemeAppearance } from './themes';

export type ThemePresetId = 'classic' | 'coast' | 'garden' | 'berry' | 'midnight';

export type ThemePreset = {
  id: ThemePresetId;
  name: string;
  description: string;
  appearance: ThemeAppearance;
  colors: ThemeTokenOverrides;
};

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Warm editorial glass',
    appearance: 'light',
    colors: {},
  },
  {
    id: 'coast',
    name: 'Coast',
    description: 'Airy blue and sea glass',
    appearance: 'light',
    colors: {
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
  },
  {
    id: 'garden',
    name: 'Garden',
    description: 'Soft sage and evergreen',
    appearance: 'light',
    colors: {
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
  },
  {
    id: 'berry',
    name: 'Berry',
    description: 'Plum glass and rose light',
    appearance: 'dark',
    colors: {
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
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep navy and electric blue',
    appearance: 'dark',
    colors: {
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
] as const;

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return THEME_PRESETS.some((preset) => preset.id === value);
}
