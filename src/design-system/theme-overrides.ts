import type { Theme, ThemeFeatureScope } from './themes';

export type ThemeScope = ThemeFeatureScope;

export const THEME_SCOPES = ['default', 'travel', 'plants', 'vehicles', 'food'] as const satisfies readonly ThemeScope[];

/** Tokens editable from the Design System gallery. */
export type EditableThemeToken =
  | 'accentPrimary'
  | 'accentSoft'
  | 'accentFaint'
  | 'textOnAccent'
  | 'backgroundSunken'
  | 'danger';

export const EDITABLE_THEME_TOKENS = [
  'accentPrimary',
  'accentSoft',
  'accentFaint',
  'textOnAccent',
  'backgroundSunken',
  'danger',
] as const satisfies readonly EditableThemeToken[];

export const FEATURE_EDITABLE_TOKENS = [
  'accentPrimary',
  'accentSoft',
  'accentFaint',
  'textOnAccent',
] as const satisfies readonly EditableThemeToken[];

export const DEFAULT_EDITABLE_TOKENS = EDITABLE_THEME_TOKENS;

export type ThemeTokenOverrides = Partial<Pick<Theme, EditableThemeToken>>;

export type ThemeOverridesByScope = Record<ThemeScope, ThemeTokenOverrides>;

export function emptyThemeOverrides(): ThemeOverridesByScope {
  return {
    default: {},
    travel: {},
    plants: {},
    vehicles: {},
    food: {},
  };
}

/** Normalize `#RGB` / `#RRGGBB` (optional leading `#`) to uppercase `#RRGGBB`, or null. */
export function normalizeHexColor(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const [r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex}`.toUpperCase();
  }
  return null;
}

export function applyThemeOverrides(base: Theme, overrides?: ThemeTokenOverrides | null): Theme {
  if (!overrides) return base;
  let next: Theme | undefined;
  for (const key of EDITABLE_THEME_TOKENS) {
    const candidate = overrides[key];
    if (typeof candidate !== 'string') continue;
    const normalized = normalizeHexColor(candidate);
    if (!normalized) continue;
    if (base[key] === normalized) continue;
    if (!next) next = { ...base };
    next[key] = normalized;
  }
  return next ?? base;
}

export function sanitizeThemeTokenOverrides(value: unknown): ThemeTokenOverrides {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const out: ThemeTokenOverrides = {};
  for (const key of EDITABLE_THEME_TOKENS) {
    const candidate = source[key];
    if (typeof candidate !== 'string') continue;
    const normalized = normalizeHexColor(candidate);
    if (normalized) out[key] = normalized;
  }
  return out;
}

export function sanitizeThemeOverridesByScope(value: unknown): ThemeOverridesByScope {
  const empty = emptyThemeOverrides();
  if (!value || typeof value !== 'object') return empty;
  const source = value as Record<string, unknown>;
  for (const scope of THEME_SCOPES) {
    empty[scope] = sanitizeThemeTokenOverrides(source[scope]);
  }
  return empty;
}

export type ThemeOverrideHistoryAction =
  | 'set'
  | 'clear'
  | 'resetScope'
  | 'resetAll'
  | 'setFont'
  | 'resetFonts';

export type ThemeOverrideHistoryEntry = {
  id: string;
  at: string;
  by: string;
  action: ThemeOverrideHistoryAction;
  scope?: ThemeScope;
  key?: EditableThemeToken;
  /** Color hex, font preset id, or null when restoring a default. */
  from?: string | null;
  to?: string | null;
  summary: string;
};

export const THEME_OVERRIDE_HISTORY_LIMIT = 100;

export const THEME_SCOPE_LABELS: Record<ThemeScope, string> = {
  default: 'App / Buttons',
  travel: 'Travel',
  plants: 'Plants',
  vehicles: 'Vehicles',
  food: 'Food',
};

export const THEME_TOKEN_LABELS: Record<EditableThemeToken, string> = {
  accentPrimary: 'Accent',
  accentSoft: 'Soft accent',
  accentFaint: 'Faint accent',
  textOnAccent: 'Text on accent',
  backgroundSunken: 'Secondary fill',
  danger: 'Danger',
};

const HISTORY_ACTIONS = new Set<ThemeOverrideHistoryAction>([
  'set',
  'clear',
  'resetScope',
  'resetAll',
  'setFont',
  'resetFonts',
]);

function sanitizeHistoryValue(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return normalizeHexColor(trimmed) ?? trimmed.slice(0, 80);
}

export function sanitizeThemeOverrideHistory(value: unknown): ThemeOverrideHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const out: ThemeOverrideHistoryEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : null;
    const at = typeof row.at === 'string' ? row.at : null;
    const by = typeof row.by === 'string' && row.by.trim() ? row.by.trim() : null;
    const action = typeof row.action === 'string' ? row.action : null;
    const summary = typeof row.summary === 'string' ? row.summary : null;
    if (!id || !at || !by || !action || !summary) continue;
    if (!HISTORY_ACTIONS.has(action as ThemeOverrideHistoryAction)) continue;
    const scope =
      typeof row.scope === 'string' && (THEME_SCOPES as readonly string[]).includes(row.scope)
        ? (row.scope as ThemeScope)
        : undefined;
    const key =
      typeof row.key === 'string' &&
      (EDITABLE_THEME_TOKENS as readonly string[]).includes(row.key)
        ? (row.key as EditableThemeToken)
        : undefined;
    out.push({
      id,
      at,
      by,
      action: action as ThemeOverrideHistoryAction,
      scope,
      key,
      from: sanitizeHistoryValue(row.from),
      to: sanitizeHistoryValue(row.to),
      summary,
    });
    if (out.length >= THEME_OVERRIDE_HISTORY_LIMIT) break;
  }
  return out;
}

export function prependThemeOverrideHistory(
  history: ThemeOverrideHistoryEntry[],
  entry: ThemeOverrideHistoryEntry,
): ThemeOverrideHistoryEntry[] {
  return [entry, ...history].slice(0, THEME_OVERRIDE_HISTORY_LIMIT);
}
