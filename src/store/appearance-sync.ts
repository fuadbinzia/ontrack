import {
  emptyFontOverrides,
  sanitizeFontOverrides,
  type FontOverrides,
} from '@/design-system/font-presets';
import {
  emptyThemeOverrides,
  sanitizeThemeOverridesByScope,
  type ThemeOverridesByScope,
} from '@/design-system/theme-overrides';
import { isThemePresetId, type ThemePresetId } from '@/design-system/theme-presets';
import { usePreferences, type ThemePreference } from '@/store/preferences';
import { useThemeOverrides } from '@/store/theme-overrides';

export type AppearanceSnapshot = {
  themePreference: ThemePreference;
  presetId: ThemePresetId | 'custom';
  overrides: ThemeOverridesByScope;
  fonts: FontOverrides;
};

export function parseThemePreference(value: unknown): ThemePreference | undefined {
  if (value === 'system' || value === 'light' || value === 'dark') return value;
  return undefined;
}

export function resolveThemeAppearanceState(persisted?: {
  overrides?: unknown;
  presetId?: unknown;
  fonts?: unknown;
}): Pick<AppearanceSnapshot, 'presetId' | 'overrides' | 'fonts'> {
  const sanitizedOverrides = sanitizeThemeOverridesByScope(persisted?.overrides);
  const presetId = isThemePresetId(persisted?.presetId)
    ? persisted.presetId
    : Object.values(sanitizedOverrides).some((scope) => Object.keys(scope).length > 0)
      ? 'custom'
      : 'classic';
  return {
    overrides: presetId === 'custom' ? sanitizedOverrides : emptyThemeOverrides(),
    presetId,
    fonts: sanitizeFontOverrides(persisted?.fonts),
  };
}

export function snapshotAppearance(): AppearanceSnapshot {
  const preferences = usePreferences.getState();
  const theme = useThemeOverrides.getState();
  return {
    themePreference: parseThemePreference(preferences.themePreference) ?? 'system',
    presetId: theme.presetId,
    overrides: theme.overrides,
    fonts: theme.fonts ?? emptyFontOverrides(),
  };
}

export function restoreAppearance(
  snapshot: AppearanceSnapshot,
  options?: { hasOnboarded?: boolean },
) {
  usePreferences.setState({
    themePreference: snapshot.themePreference,
    ...(options?.hasOnboarded ? { hasOnboarded: true } : {}),
  });
  useThemeOverrides.setState({
    overrides: snapshot.overrides,
    presetId: snapshot.presetId,
    fonts: snapshot.fonts,
  });
}

export function appearanceSyncFields(snapshot: AppearanceSnapshot) {
  return {
    themePreference: snapshot.themePreference,
    themePresetId: snapshot.presetId,
    themeOverrides: snapshot.overrides,
    themeFonts: snapshot.fonts,
  };
}

function payloadHasThemeChrome(payload: Record<string, unknown>) {
  return (
    'themePresetId' in payload || 'themeOverrides' in payload || 'themeFonts' in payload
  );
}

/** Apply cloud preference fields without clobbering local chrome when older payloads omit them. */
export function applyAppearancePayload(
  payload: Record<string, unknown>,
  fallback: AppearanceSnapshot,
) {
  const themePreference = parseThemePreference(payload.themePreference) ?? fallback.themePreference;
  const theme = payloadHasThemeChrome(payload)
    ? resolveThemeAppearanceState({
        presetId: payload.themePresetId,
        overrides: payload.themeOverrides,
        fonts: payload.themeFonts,
      })
    : fallback;
  restoreAppearance({
    themePreference,
    presetId: theme.presetId,
    overrides: theme.overrides,
    fonts: theme.fonts,
  });
}
