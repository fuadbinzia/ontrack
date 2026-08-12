import { useId, useRef, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText, LoadingSpinner } from '@/components/primitives';
import { fieldTitleCase } from '@/components/primitives/field-title-case';
import { GlassIconWell } from '@/components/primitives/glass-icon-well';
import { Symbol } from '@/components/primitives/symbol';
import { radii, type AppIconName } from '@/design-system';
import { CityAutofindSuggestionMenu } from '@/features/account/city-autofind-suggestion-menu';
import { useCityAutofindSuggestions } from '@/features/account/use-city-autofind-suggestions';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';

type CityAutofindSettingsRowProps = {
  label: string;
  icon: AppIconName;
  value: string;
  onChangeText: (text: string) => void;
  onCommit: (label: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder: string;
  testID: string;
  accessibilityLabel: string;
  editable?: boolean;
  grouped?: boolean;
  /** Far-right control (e.g. locate). Rendered after the field. */
  trailing?: ReactNode;
};

/**
 * Preferences-style row with Open-Meteo city autocomplete
 * (city / state / country — no street addresses).
 */
export function CityAutofindSettingsRow({
  label,
  icon,
  value,
  onChangeText,
  onCommit,
  onBlur,
  onFocus,
  placeholder,
  testID,
  accessibilityLabel,
  editable = true,
  grouped = false,
  trailing,
}: CityAutofindSettingsRowProps) {
  const theme = useTheme();
  const { spacing: rs, layout, s, typography } = useResponsive();
  const listId = useId();
  const fieldRef = useRef<View | null>(null);
  const inputRef = useRef<TextInput>(null);

  const {
    suggestions,
    loading,
    open,
    anchor,
    dismissMenu,
    applySuggestion,
    handleBlur,
    handleChangeText,
    handleSubmitEditing,
  } = useCityAutofindSuggestions({
    value,
    onChangeText,
    onCommit,
    onBlur,
    fieldRef,
  });

  const agent = useAgentUiTarget(testID, {
    label: accessibilityLabel,
    onPress: () => inputRef.current?.focus(),
  });

  return (
    <View ref={fieldRef} collapsable={false}>
      <View
        ref={agent.ref}
        testID={testID}
        onLayout={agent.onLayout}
        style={[
          styles.row,
          {
            minHeight: layout.minTapTarget,
            gap: rs.md,
            paddingVertical: grouped ? rs.sm : rs.md,
            paddingHorizontal: rs.md,
            marginBottom: grouped ? 0 : rs.xs,
            backgroundColor: grouped ? 'transparent' : theme.backgroundSunken,
            borderColor: grouped ? 'transparent' : theme.separator,
            borderWidth: grouped ? 0 : StyleSheet.hairlineWidth,
            borderRadius: grouped ? 0 : radii.md,
          },
        ]}>
        <GlassIconWell size={s(34)} borderRadius={radii.sm}>
          <Symbol name={icon} size="sm" color={theme.accentPrimary} />
        </GlassIconWell>
        <View style={[styles.text, { gap: rs.xxs }]}>
          <AppText variant="callout" fit>
            {fieldTitleCase(label)}
          </AppText>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={handleChangeText}
            onBlur={handleBlur}
            onFocus={onFocus}
            onSubmitEditing={handleSubmitEditing}
            editable={editable}
            placeholder={placeholder}
            placeholderTextColor={theme.textTertiary}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel={accessibilityLabel}
            style={{
              color: theme.textPrimary,
              fontSize: typography.caption.fontSize,
              lineHeight: typography.caption.lineHeight,
              fontFamily: typography.caption.fontFamily,
              padding: 0,
              margin: 0,
              paddingRight: loading ? s(28) : 0,
            }}
          />
        </View>
        {loading ? (
          <LoadingSpinner size={s(16)} color={theme.textTertiary} />
        ) : null}
        {trailing}
      </View>

      <CityAutofindSuggestionMenu
        label={label}
        testID={testID}
        listId={listId}
        suggestions={suggestions}
        open={open}
        anchor={anchor}
        onDismiss={dismissMenu}
        onSelect={applySuggestion}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderCurve: 'continuous',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
});
