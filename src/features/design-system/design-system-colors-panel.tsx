import { useEffect, useState } from 'react';
import { Pressable, useColorScheme, View } from 'react-native';

import {
    AppText,
    Button,
    Card,
    Input,
    PanelTitle,
} from '@/components/primitives';
import {
    DEFAULT_EDITABLE_TOKENS,
    FEATURE_EDITABLE_TOKENS,
    normalizeHexColor,
    palette,
    resolveBaseTheme,
    resolveThemePresetColors,
    THEME_TOKEN_LABELS,
    type EditableThemeToken,
    type ThemeScope,
} from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { useThemeOverrides } from '@/store/theme-overrides';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';

import { DesignSystemThemeHistory } from './design-system-theme-history';

type ScopeConfig = {
  scope: ThemeScope;
  title: string;
  description: string;
  tokens: readonly EditableThemeToken[];
  presets: Partial<Record<EditableThemeToken, string[]>>;
};

const SCOPE_CONFIGS: ScopeConfig[] = [
  {
    scope: 'default',
    title: 'App / Buttons',
    description: 'Shared primary, secondary, and destructive button colors.',
    tokens: DEFAULT_EDITABLE_TOKENS,
    presets: {
      accentPrimary: [palette.copper, palette.copperDeep, palette.travelBlue, palette.plantGreen],
      accentSoft: [palette.copperSoft, palette.travelBlueSoft, palette.plantGreenSoft],
      accentFaint: [palette.copperFaint, palette.travelBlueFaint, palette.plantGreenFaint],
      textOnAccent: ['#FFF9F2', '#FFFFFF', '#F7FCFF'],
      backgroundSunken: [palette.paper2, palette.paper1, palette.paper3],
      danger: [palette.red, palette.redBright],
    },
  },
  {
    scope: 'travel',
    title: 'Travel',
    description: 'Travel feature accent tokens used by buttons and section chrome.',
    tokens: FEATURE_EDITABLE_TOKENS,
    presets: {
      accentPrimary: [palette.travelBlue, '#1B6A9A', palette.copper],
      accentSoft: [palette.travelBlueSoft, palette.copperSoft],
      accentFaint: [palette.travelBlueFaint, palette.copperFaint],
      textOnAccent: ['#F7FCFF', '#FFF9F2'],
    },
  },
  {
    scope: 'plants',
    title: 'Plants',
    description: 'Plants feature accent tokens.',
    tokens: FEATURE_EDITABLE_TOKENS,
    presets: {
      accentPrimary: [palette.plantGreen, '#2F5F3F', palette.copper],
      accentSoft: [palette.plantGreenSoft, palette.copperSoft],
      accentFaint: [palette.plantGreenFaint, palette.copperFaint],
      textOnAccent: ['#F4FBF6', '#FFF9F2'],
    },
  },
  {
    scope: 'vehicles',
    title: 'Vehicles',
    description: 'Vehicles feature accent tokens.',
    tokens: FEATURE_EDITABLE_TOKENS,
    presets: {
      accentPrimary: [palette.vehicleSteel, '#2A4A62', palette.copper],
      accentSoft: [palette.vehicleSteelSoft, palette.copperSoft],
      accentFaint: [palette.vehicleSteelFaint, palette.copperFaint],
      textOnAccent: ['#F5FAFD', '#FFF9F2'],
    },
  },
];

export function DesignSystemColorsPanel() {
  const theme = useTheme();
  const { spacing } = useResponsive();
  const resetAll = useThemeOverrides((s) => s.resetAll);
  const hasAnyOverride = useThemeOverrides(
    (s) =>
      Object.values(s.overrides).some((scope) => Object.keys(scope).length > 0) ||
      Boolean(s.fonts.ui || s.fonts.mono),
  );

  const restoreDefaults = () =>
    confirmDestructiveAction({
      title: 'Restore theme defaults?',
      message:
        'Restore shipped accents, button colors, and fonts. This is logged in change history.',
      actionLabel: 'Restore Defaults',
      confirmTestID: AgentUiIds.designSystem.confirmRestoreDefaults,
      onConfirm: resetAll,
    });

  return (
    <View style={{ gap: spacing.lg }}>
      <AppText variant="callout" color="secondary">
        App color foundations. Changes apply live on this device until you restore defaults.
      </AppText>

      <Card airy style={{ gap: spacing.md }}>
        <PanelTitle>Defaults</PanelTitle>
        <AppText variant="caption" color="secondary">
          Current app accent: {theme.accentPrimary}
          {hasAnyOverride ? ' · custom overrides active' : ' · shipped defaults'}
        </AppText>
        <Button
          variant={hasAnyOverride ? 'danger' : 'secondary'}
          testID={AgentUiIds.designSystem.resetAll}
          accessibilityLabel="Restore theme defaults"
          disabled={!hasAnyOverride}
          onPress={restoreDefaults}>
          Restore Defaults
        </Button>
      </Card>

      <DesignSystemThemeHistory />

      {SCOPE_CONFIGS.map((config) => (
        <ScopeEditor key={config.scope} config={config} />
      ))}

      {hasAnyOverride ? (
        <Button
          variant="danger"
          testID={AgentUiIds.designSystem.resetAllFooter}
          accessibilityLabel="Restore theme defaults"
          onPress={restoreDefaults}>
          Restore Defaults
        </Button>
      ) : null}
    </View>
  );
}

function ScopeEditor({ config }: { config: ScopeConfig }) {
  const { spacing, s } = useResponsive();
  const theme = useTheme();
  const system = useColorScheme();
  const preference = usePreferences((s) => s.themePreference);
  const appearance = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const base = resolveBaseTheme(config.scope, appearance);
  const scopeOverrides = useThemeOverrides((s) => s.overrides[config.scope]);
  const presetId = useThemeOverrides((s) => s.presetId);
  const setToken = useThemeOverrides((s) => s.setToken);
  const clearToken = useThemeOverrides((s) => s.clearToken);
  const presetColors =
    presetId === 'custom' ? undefined : resolveThemePresetColors(presetId, appearance);

  return (
    <AgentTestId
      testID={AgentUiIds.designSystem.section(config.scope)}
      label={config.title}
      style={{ gap: spacing.md }}>
      <Card airy style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <PanelTitle>{config.title}</PanelTitle>
          <AppText variant="caption" color="secondary">
            {config.description}
          </AppText>
        </View>

        {config.tokens.map((token) => {
          const effective =
            scopeOverrides[token] ??
            (config.scope === 'default' ? presetColors?.[token] : undefined) ??
            base[token];
          const isOverridden = Boolean(scopeOverrides[token]);
          return (
            <TokenEditor
              key={token}
              scope={config.scope}
              token={token}
              label={THEME_TOKEN_LABELS[token]}
              value={effective}
              defaultValue={base[token]}
              overridden={isOverridden}
              presets={config.presets[token] ?? []}
              onCommit={(hex) => setToken(config.scope, token, hex, presetColors)}
              onReset={() => clearToken(config.scope, token)}
            />
          );
        })}

        <View
          style={{
            height: s(8),
            borderRadius: s(8),
            backgroundColor:
              config.scope === 'default'
                ? theme.accentPrimary
                : (scopeOverrides.accentPrimary ?? base.accentPrimary),
          }}
        />
      </Card>
    </AgentTestId>
  );
}

function TokenEditor({
  scope,
  token,
  label,
  value,
  defaultValue,
  overridden,
  presets,
  onCommit,
  onReset,
}: {
  scope: ThemeScope;
  token: EditableThemeToken;
  label: string;
  value: string;
  defaultValue: string;
  overridden: boolean;
  presets: string[];
  onCommit: (hex: string) => boolean;
  onReset: () => void;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const [draft, setDraft] = useState(value);
  const normalizedDraft = normalizeHexColor(draft);
  const invalid = draft.trim().length > 0 && !normalizedDraft;

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commitDraft = () => {
    if (!normalizedDraft) {
      setDraft(value);
      return;
    }
    if (normalizedDraft === normalizeHexColor(defaultValue)) {
      onReset();
      setDraft(defaultValue);
      return;
    }
    onCommit(normalizedDraft);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <AgentTestId
          testID={AgentUiIds.designSystem.swatch(scope, token)}
          label={`${label} swatch`}
          style={{
            width: s(36),
            height: s(36),
            borderRadius: s(12),
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: theme.separator,
          }}>
          <View
            style={{
              flex: 1,
              backgroundColor: normalizedDraft ?? value,
            }}
          />
        </AgentTestId>
        <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
          <PanelTitle>{label}</PanelTitle>
          <AppText variant="caption" color="tertiary" fit>
            {overridden ? 'Custom' : 'Default'} · {defaultValue}
          </AppText>
        </View>
        {overridden ? (
          <Button
            size="sm"
            variant="ghost"
            testID={AgentUiIds.designSystem.resetToken(scope, token)}
            accessibilityLabel={`Reset ${label}`}
            onPress={onReset}>
            Reset
          </Button>
        ) : null}
      </View>

      <Input
        label="Hex"
        value={draft}
        autoCapitalize="characters"
        autoCorrect={false}
        testID={AgentUiIds.designSystem.token(scope, token)}
        accessibilityLabel={`${label} hex color`}
        onChangeText={setDraft}
        onBlur={commitDraft}
        onSubmitEditing={commitDraft}
      />
      {invalid ? (
        <AppText variant="caption" color="danger" fit>
          Use #RGB or #RRGGBB
        </AppText>
      ) : null}

      {presets.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {presets.map((hex) => {
            const normalized = normalizeHexColor(hex) ?? hex;
            const selected = (normalizedDraft ?? value).toUpperCase() === normalized.toUpperCase();
            const applyPreset = () => {
              if (normalized.toUpperCase() === normalizeHexColor(defaultValue)?.toUpperCase()) {
                onReset();
                setDraft(defaultValue);
                return;
              }
              onCommit(normalized);
              setDraft(normalized);
            };
            return (
              <AgentTestId
                key={`${token}-${normalized}`}
                testID={AgentUiIds.designSystem.preset(scope, token, normalized)}
                label={`Preset ${normalized}`}
                onPress={applyPreset}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Preset ${normalized}`}
                  onPress={applyPreset}
                  style={({ pressed }) => ({
                    minWidth: Math.max(44, s(44)),
                    minHeight: Math.max(44, s(44)),
                    borderRadius: s(14),
                    backgroundColor: normalized,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? theme.textPrimary : theme.separator,
                    opacity: pressed ? 0.8 : 1,
                  })}
                />
              </AgentTestId>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
