import { createContext, createElement, type PropsWithChildren, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import {
    applyThemeOverrides,
    resolveBaseTheme,
    type Theme,
    type ThemeScope,
} from '@/design-system';
import { usePreferences } from '@/store/preferences';
import { useThemeOverrides } from '@/store/theme-overrides';

type FeatureTheme = ThemeScope;

const FeatureThemeContext = createContext<FeatureTheme>('default');
/** Local partial theme merge (auth shell, etc.) — applied after scope overrides. */
const ThemeMergeContext = createContext<Partial<Theme> | null>(null);

export function FeatureThemeProvider({
  children,
  feature,
}: PropsWithChildren<{ feature: Exclude<FeatureTheme, 'default'> }>) {
  return createElement(FeatureThemeContext.Provider, { value: feature }, children);
}

export function ThemeMergeProvider({
  children,
  value,
}: PropsWithChildren<{ value: Partial<Theme> | null }>) {
  return createElement(ThemeMergeContext.Provider, { value }, children);
}

export function useTheme(): Theme {
  const system = useColorScheme();
  const preference = usePreferences((s) => s.themePreference);
  const resolved = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const feature = useContext(FeatureThemeContext);
  const overrides = useThemeOverrides((s) => s.overrides[feature]);
  const merge = useContext(ThemeMergeContext);
  return useMemo(() => {
    const base = applyThemeOverrides(resolveBaseTheme(feature, resolved), overrides);
    return merge ? { ...base, ...merge } : base;
  }, [feature, merge, overrides, resolved]);
}
