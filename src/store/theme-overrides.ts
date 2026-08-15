import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  DEFAULT_MONO_FONT_PRESET_ID,
  DEFAULT_UI_FONT_PRESET_ID,
  emptyFontOverrides,
  findFontPreset,
  FONT_ROLE_LABELS,
  sanitizeFontOverrides,
  type FontOverrides,
  type FontRole,
} from '@/design-system/font-presets';
import {
  emptyThemeOverrides,
  normalizeHexColor,
  prependThemeOverrideHistory,
  sanitizeThemeOverrideHistory,
  sanitizeThemeOverridesByScope,
  THEME_SCOPE_LABELS,
  THEME_TOKEN_LABELS,
  type EditableThemeToken,
  type ThemeOverrideHistoryEntry,
  type ThemeOverridesByScope,
  type ThemeScope,
  type ThemeTokenOverrides,
} from '@/design-system/theme-overrides';
import { isThemePresetId, type ThemePresetId } from '@/design-system/theme-presets';
import { resolveSelfDisplayName } from '@/features/account/self-display-name';
import { createPersistStorage, STORAGE_KEYS } from '@/services/storage';
import { usePreferences } from '@/store/preferences';
import { newId } from '@/utils/id';

interface ThemeOverridesState {
  overrides: ThemeOverridesByScope;
  presetId: ThemePresetId | 'custom';
  fonts: FontOverrides;
  history: ThemeOverrideHistoryEntry[];
  setToken: (scope: ThemeScope, key: EditableThemeToken, hex: string) => boolean;
  applyPreset: (presetId: ThemePresetId, colors: ThemeTokenOverrides) => void;
  clearToken: (scope: ThemeScope, key: EditableThemeToken) => void;
  resetScope: (scope: ThemeScope) => void;
  setFont: (role: FontRole, presetId: string) => boolean;
  resetFonts: () => void;
  resetAll: () => void;
  clearHistory: () => void;
}

function withScope(
  overrides: ThemeOverridesByScope,
  scope: ThemeScope,
  next: ThemeTokenOverrides,
): ThemeOverridesByScope {
  return { ...overrides, [scope]: next };
}

function themeEditorName(): string {
  return resolveSelfDisplayName({
    preferencesName: usePreferences.getState().name,
    fallback: 'Local',
  });
}

function historyEntry(
  partial: Omit<ThemeOverrideHistoryEntry, 'id' | 'at' | 'by'> & { by?: string },
): ThemeOverrideHistoryEntry {
  return {
    id: newId('theme-hist'),
    at: new Date().toISOString(),
    by: partial.by?.trim() || themeEditorName(),
    action: partial.action,
    scope: partial.scope,
    key: partial.key,
    from: partial.from,
    to: partial.to,
    summary: partial.summary,
  };
}

function hasColorOverrides(overrides: ThemeOverridesByScope): boolean {
  return Object.values(overrides).some((scope) => Object.keys(scope).length > 0);
}

function hasFontOverrides(fonts: FontOverrides): boolean {
  return Boolean(fonts.ui || fonts.mono);
}

function effectiveFontPresetId(role: FontRole, fonts: FontOverrides): string {
  if (role === 'mono') return fonts.mono ?? DEFAULT_MONO_FONT_PRESET_ID;
  return fonts.ui ?? DEFAULT_UI_FONT_PRESET_ID;
}

function defaultPresetId(role: FontRole): string {
  return role === 'mono' ? DEFAULT_MONO_FONT_PRESET_ID : DEFAULT_UI_FONT_PRESET_ID;
}

export const useThemeOverrides = create<ThemeOverridesState>()(
  persist(
    (set, get) => ({
      overrides: emptyThemeOverrides(),
      presetId: 'classic',
      fonts: emptyFontOverrides(),
      history: [],
      setToken: (scope, key, hex) => {
        const normalized = normalizeHexColor(hex);
        if (!normalized) return false;
        const current = get().overrides[scope] ?? {};
        const previous = current[key] ?? null;
        if (previous === normalized) return true;
        const entry = historyEntry({
          action: 'set',
          scope,
          key,
          from: previous,
          to: normalized,
          summary: `Set ${THEME_SCOPE_LABELS[scope]} · ${THEME_TOKEN_LABELS[key]} to ${normalized}`,
        });
        set({
          overrides: withScope(get().overrides, scope, { ...current, [key]: normalized }),
          presetId: 'custom',
          history: prependThemeOverrideHistory(get().history, entry),
        });
        return true;
      },
      applyPreset: (presetId, colors) => {
        const normalized = sanitizeThemeOverridesByScope({ default: colors });
        const entry = historyEntry({
          action: 'applyPreset',
          summary: `Applied ${presetId} theme preset`,
        });
        set({
          overrides: normalized,
          presetId,
          history: prependThemeOverrideHistory(get().history, entry),
        });
      },
      clearToken: (scope, key) => {
        const current = get().overrides[scope] ?? {};
        if (!(key in current)) return;
        const previous = current[key] ?? null;
        const next = { ...current };
        delete next[key];
        const nextOverrides = withScope(get().overrides, scope, next);
        const entry = historyEntry({
          action: 'clear',
          scope,
          key,
          from: previous,
          to: null,
          summary: `Restored ${THEME_SCOPE_LABELS[scope]} · ${THEME_TOKEN_LABELS[key]} to default`,
        });
        set({
          overrides: nextOverrides,
          presetId: hasColorOverrides(nextOverrides) ? 'custom' : 'classic',
          history: prependThemeOverrideHistory(get().history, entry),
        });
      },
      resetScope: (scope) => {
        const current = get().overrides[scope] ?? {};
        if (Object.keys(current).length === 0) return;
        const entry = historyEntry({
          action: 'resetScope',
          scope,
          from: null,
          to: null,
          summary: `Restored ${THEME_SCOPE_LABELS[scope]} defaults`,
        });
        const nextOverrides = withScope(get().overrides, scope, {});
        set({
          overrides: nextOverrides,
          presetId: hasColorOverrides(nextOverrides) ? 'custom' : 'classic',
          history: prependThemeOverrideHistory(get().history, entry),
        });
      },
      setFont: (role, presetId) => {
        const preset = findFontPreset(role, presetId);
        if (!preset) return false;
        const fonts = get().fonts;
        const previousId = effectiveFontPresetId(role, fonts);
        const nextStored = preset.id === defaultPresetId(role) ? null : preset.id;
        const currentStored = role === 'mono' ? fonts.mono : fonts.ui;
        if (currentStored === nextStored) return true;

        const entry = historyEntry({
          action: 'setFont',
          from: previousId,
          to: preset.id,
          summary: `Set ${FONT_ROLE_LABELS[role]} to ${preset.label}`,
        });
        set({
          fonts: role === 'mono' ? { ...fonts, mono: nextStored } : { ...fonts, ui: nextStored },
          history: prependThemeOverrideHistory(get().history, entry),
        });
        return true;
      },
      resetFonts: () => {
        if (!hasFontOverrides(get().fonts)) return;
        const entry = historyEntry({
          action: 'resetFonts',
          summary: 'Restored default fonts',
        });
        set({
          fonts: emptyFontOverrides(),
          history: prependThemeOverrideHistory(get().history, entry),
        });
      },
      resetAll: () => {
        const colors = hasColorOverrides(get().overrides);
        const fonts = hasFontOverrides(get().fonts);
        if (!colors && !fonts && get().presetId === 'classic') return;
        const entry = historyEntry({
          action: 'resetAll',
          summary: 'Restored all theme defaults',
        });
        set({
          overrides: emptyThemeOverrides(),
          presetId: 'classic',
          fonts: emptyFontOverrides(),
          history: prependThemeOverrideHistory(get().history, entry),
        });
      },
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: STORAGE_KEYS.themeOverrides,
      storage: createPersistStorage(),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<ThemeOverridesState> | undefined;
        return {
          ...currentState,
          ...persisted,
          overrides: sanitizeThemeOverridesByScope(persisted?.overrides),
          presetId: isThemePresetId(persisted?.presetId)
            ? persisted.presetId
            : Object.values(sanitizeThemeOverridesByScope(persisted?.overrides)).some(
                (scope) => Object.keys(scope).length > 0,
              )
              ? 'custom'
              : 'classic',
          fonts: sanitizeFontOverrides(persisted?.fonts),
          history: sanitizeThemeOverrideHistory(persisted?.history),
        };
      },
    },
  ),
);
