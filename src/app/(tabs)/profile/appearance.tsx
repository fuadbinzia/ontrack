import { useState } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';

import {
  AppText,
  Button,
  Card,
  HeaderBackButton,
  Input,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  SettingsGroup,
  SettingsRow,
  SheetScaffold,
  Symbol,
} from '@/components/primitives';
import {
  normalizeHexColor,
  radii,
  resolveBaseTheme,
  resolveThemePresetColors,
  THEME_PRESETS,
  THEME_TOKEN_LABELS,
  type EditableThemeToken,
  type ThemePreset,
} from '@/design-system';
import { AvatarColorPicker } from '@/features/account/avatar-color-picker';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences, type ThemePreference } from '@/store/preferences';
import { useThemeOverrides } from '@/store/theme-overrides';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

const MODE_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const PRESET_ROWS = [THEME_PRESETS.slice(0, 2), THEME_PRESETS.slice(2, 4), THEME_PRESETS.slice(4, 6)];

const COLOR_GROUPS: {
  title: string;
  subtitle: string;
  tokens: EditableThemeToken[];
}[] = [
  {
    title: 'Canvas',
    subtitle: 'The page atmosphere and glass containers.',
    tokens: ['backgroundPrimary', 'backgroundSecondary', 'backgroundElevated', 'backgroundSunken'],
  },
  {
    title: 'Actions',
    subtitle: 'Buttons, selected states, and destructive actions.',
    tokens: ['accentPrimary', 'accentSoft', 'accentFaint', 'textOnAccent', 'danger'],
  },
  {
    title: 'Type & Detail',
    subtitle: 'Headlines, supporting copy, muted labels, and dividers.',
    tokens: ['textPrimary', 'textSecondary', 'textTertiary', 'separator'],
  },
];

export default function AppearanceScreen() {
  const theme = useTheme();
  const system = useColorScheme();
  const { spacing, s } = useResponsive();
  const preference = usePreferences((state) => state.themePreference);
  const setPreference = usePreferences((state) => state.setThemePreference);
  const presetId = useThemeOverrides((state) => state.presetId);
  const overrides = useThemeOverrides((state) => state.overrides.default);
  const applyPreset = useThemeOverrides((state) => state.applyPreset);
  const setToken = useThemeOverrides((state) => state.setToken);
  const [editingToken, setEditingToken] = useState<EditableThemeToken>();
  const [draft, setDraft] = useState('');
  const [pickerDragging, setPickerDragging] = useState(false);
  const appearance = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const base = resolveBaseTheme('default', appearance);
  const presetColors =
    presetId === 'custom' ? overrides : resolveThemePresetColors(presetId, appearance);
  const activePresetName = THEME_PRESETS.find((preset) => preset.id === presetId)?.name;

  const choosePreset = (preset: ThemePreset) => {
    haptics.success();
    applyPreset(preset.id);
  };
  const openColor = (token: EditableThemeToken) => {
    setEditingToken(token);
    setDraft(presetColors[token] ?? base[token]);
  };
  const closeColor = () => {
    setEditingToken(undefined);
    setPickerDragging(false);
  };
  const saveColor = () => {
    if (!editingToken) return;
    const normalized = normalizeHexColor(draft);
    if (!normalized) return;
    setToken('default', editingToken, normalized, presetColors);
    haptics.success();
    closeColor();
  };
  const normalizedDraft = normalizeHexColor(draft);

  return (
    <>
      <Screen refresh={false} contentStyle={{ gap: spacing.xl }}>
        <ScreenHeader
          eyebrow="Make It Yours"
          title="App Appearance"
          subtitle="Choose a complete look or tune every color. Changes apply instantly across onTrack."
          leading={
            <HeaderBackButton
              compact
              fallback="/(tabs)/profile"
              testID={AgentUiIds.profile.appearance.back}
              accessibilityLabel="Back to Profile"
            />
          }
        />

        <AgentTestId testID={AgentUiIds.profile.appearance.preview} label="Live Theme Preview">
          <Card airy style={{ gap: spacing.md }}>
            <View
              style={[
                styles.previewCanvas,
                {
                  backgroundColor: theme.backgroundPrimary,
                  borderColor: theme.separator,
                  padding: spacing.md,
                  gap: spacing.md,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <View
                  style={[
                    styles.previewIcon,
                    {
                      width: s(38),
                      height: s(38),
                      backgroundColor: theme.accentFaint,
                    },
                  ]}
                >
                  <Symbol name="smart" size="sm" color={theme.accentPrimary} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: spacing.xxs }}>
                  <AppText variant="heading" fit>
                    Today, Your Way
                  </AppText>
                  <AppText variant="caption" color="secondary" fit>
                    Previewing{' '}
                    {presetId === 'custom'
                      ? 'your custom look'
                      : `${activePresetName ?? 'Classic'} theme`}
                  </AppText>
                </View>
              </View>
              <View
                style={[
                  styles.previewContainer,
                  {
                    backgroundColor: theme.backgroundElevated,
                    borderColor: theme.separator,
                    padding: spacing.md,
                    gap: spacing.sm,
                  },
                ]}
              >
                <AppText variant="callout" fit>
                  Morning Focus
                </AppText>
                <AppText variant="caption" color="secondary">
                  A calm space for what matters next.
                </AppText>
                <View
                  style={[
                    styles.previewButton,
                    {
                      backgroundColor: theme.accentPrimary,
                      minHeight: Math.max(44, s(44)),
                      paddingHorizontal: spacing.md,
                    },
                  ]}
                >
                  <AppText variant="callout" fit style={{ color: theme.textOnAccent }}>
                    Start My Day
                  </AppText>
                </View>
              </View>
            </View>
          </Card>
        </AgentTestId>

        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Brightness" flush />
          <Card padded={false} style={{ padding: spacing.xs }}>
            <SegmentedControl
              value={preference}
              options={MODE_OPTIONS.map((option) => ({
                ...option,
                testID: AgentUiIds.profile.theme(option.value),
              }))}
              onChange={setPreference}
            />
          </Card>
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Theme Presets" flush />
          <AppText variant="caption" color="secondary">
            One tap changes the full app palette.
          </AppText>
          <View style={{ gap: spacing.md }}>
            {PRESET_ROWS.map((row, rowIndex) => (
              <View
                key={rowIndex}
                style={[styles.presetRow, { gap: spacing.md }]}
              >
                {row.map((preset) => (
                  <View key={preset.id} style={styles.presetCell}>
                    <PresetCard
                      preset={preset}
                      appearance={appearance}
                      selected={presetId === preset.id}
                      onPress={() => choosePreset(preset)}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        {COLOR_GROUPS.map((group) => (
          <View key={group.title} style={{ gap: spacing.sm }}>
            <SectionHeader title={group.title} flush />
            <AppText variant="caption" color="secondary">
              {group.subtitle}
            </AppText>
            <SettingsGroup>
              {group.tokens.map((token) => {
                const value = presetColors[token] ?? base[token];
                return (
                  <SettingsRow
                    key={token}
                    label={THEME_TOKEN_LABELS[token]}
                    detail={value}
                    testID={AgentUiIds.profile.appearance.color(token)}
                    accessibilityLabel={`Customize ${THEME_TOKEN_LABELS[token]}`}
                    onPress={() => openColor(token)}
                    trailing={
                      <View
                        style={[
                          styles.swatch,
                          {
                            width: s(34),
                            height: s(34),
                            backgroundColor: value,
                            borderColor: theme.separator,
                          },
                        ]}
                      />
                    }
                  />
                );
              })}
            </SettingsGroup>
          </View>
        ))}

        <Button
          variant="secondary"
          testID={AgentUiIds.profile.appearance.reset}
          accessibilityLabel="Restore Classic Theme"
          onPress={() => choosePreset(THEME_PRESETS[0])}
        >
          Restore Classic
        </Button>
      </Screen>

      <SheetScaffold
        visible={Boolean(editingToken)}
        title={editingToken ? THEME_TOKEN_LABELS[editingToken] : 'Custom Color'}
        subtitle="Drag to choose a color, or enter an exact hex value."
        onClose={closeColor}
        closeTestID={AgentUiIds.profile.appearance.colorClose}
        closeAccessibilityLabel="Close Color Picker"
        scrollEnabled={!pickerDragging}
        footer={
          <Button
            testID={AgentUiIds.profile.appearance.colorSave}
            accessibilityLabel="Apply Custom Color"
            disabled={!normalizedDraft}
            onPress={saveColor}
          >
            Apply Color
          </Button>
        }
      >
        <View style={{ gap: spacing.md }}>
          <AvatarColorPicker
            color={normalizedDraft ?? undefined}
            onChange={setDraft}
            onDragStart={() => setPickerDragging(true)}
            onDragEnd={() => setPickerDragging(false)}
          />
          <Input
            label="Hex Color"
            value={draft}
            autoCapitalize="characters"
            autoCorrect={false}
            testID={AgentUiIds.profile.appearance.colorHex}
            accessibilityLabel="Custom Color Hex Value"
            onChangeText={setDraft}
          />
          {!normalizedDraft ? (
            <AppText variant="caption" color="danger">
              Use #RGB or #RRGGBB.
            </AppText>
          ) : null}
        </View>
      </SheetScaffold>
    </>
  );
}

function PresetCard({
  preset,
  appearance,
  selected,
  onPress,
}: {
  preset: ThemePreset;
  appearance: 'light' | 'dark';
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const fallback = resolveBaseTheme('default', appearance);
  const colors = preset.colors[appearance];
  const background = colors.backgroundPrimary ?? fallback.backgroundPrimary;
  const accent = colors.accentPrimary ?? fallback.accentPrimary;
  const text = colors.textPrimary ?? fallback.textPrimary;
  return (
    <Card
      onPress={onPress}
      testID={AgentUiIds.profile.appearance.preset(preset.id)}
      accessibilityLabel={`Use ${preset.name} Theme`}
      airy
      style={[
        styles.presetCard,
        {
          minWidth: s(140),
          borderWidth: s(2),
          borderColor: selected ? theme.accentPrimary : 'transparent',
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <View
        style={[
          styles.presetSample,
          {
            backgroundColor: background,
            borderColor: selected ? theme.accentPrimary : theme.separator,
            height: s(56),
            padding: spacing.sm,
            gap: spacing.xs,
          },
        ]}
      >
        <View
          style={[
            styles.presetAccent,
            {
              width: s(26),
              height: s(26),
              borderRadius: s(13),
              top: spacing.sm,
              right: spacing.sm,
              backgroundColor: accent,
            },
          ]}
        />
        <View style={[styles.presetLine, { height: s(4), backgroundColor: text }]} />
      </View>
      <View style={{ minWidth: 0 }}>
        <AppText variant="callout" fit>
          {preset.name}
        </AppText>
        <AppText variant="caption" color="secondary" fit>
          {preset.description}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  previewCanvas: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  previewIcon: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  previewButton: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetRow: { flexDirection: 'row', alignItems: 'stretch' },
  presetCell: { flex: 1, minWidth: 0 },
  presetCard: { width: '100%' },
  presetSample: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  presetAccent: { position: 'absolute' },
  presetLine: { width: '58%', borderRadius: radii.pill, opacity: 0.72 },
  swatch: { borderRadius: radii.md, borderWidth: StyleSheet.hairlineWidth },
});
