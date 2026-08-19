import NativeDateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/primitives/app-text';
import {
    FieldLeadingIcon,
    fieldLeadingIconRowStyle,
} from '@/components/primitives/field-leading-icon';
import { stackedFieldMinHeight } from '@/components/primitives/field-leading-icon-style';
import { StackedIconField } from '@/components/primitives/stacked-icon-field';
import { Symbol } from '@/components/primitives/symbol';
import {
    clampMinutesFromMidnight,
    minutesFromPickerDate,
    minutesToDate,
    type TimeFieldProps,
} from '@/components/primitives/time-field.types';
import { glassFieldBackground, radii, spacing } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { formatMinutes, nowMinutes } from '@/utils/date';

/**
 * Android-only Material time field: pressable summary + dialog clock picker.
 * Mounted via `time-field.android.tsx`; iOS must not import this module.
 */
export function MaterialTimeField({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = 'Time',
  stackedLabel,
  iconBackground,
  iconColor,
  fieldBackground,
  fieldBorderColor,
  fieldBorderRadius,
  stackedLabelColor,
  placeholderColor,
  showChevron = false,
  accessibilityLabel,
  testID,
}: TimeFieldProps) {
  const theme = useTheme();
  const { s, typography, fontScale } = useResponsive();
  const stackedMinHeight = stackedFieldMinHeight({
    baseMinHeight: Math.max(56, s(60)),
    fontScale,
    labelLineHeight: typography.caption.lineHeight,
    valueLineHeight: typography.body.lineHeight,
    verticalPadding: spacing.sm,
  });
  const [showPicker, setShowPicker] = useState(false);
  const minutes = clampMinutesFromMidnight(value ?? nowMinutes());
  const hasValue = value !== null;
  const displayValue = hasValue ? formatMinutes(minutes) : placeholder;
  const resolvedA11yLabel = accessibilityLabel ?? label ?? stackedLabel ?? 'Time';
  const stacked = Boolean(stackedLabel);
  const openPicker = () => setShowPicker(true);
  // Registry required for agent-ui dump/assert/tap — bare RN testID is not enough.
  const agent = useAgentUiTarget(testID, {
    label: stackedLabel ?? resolvedA11yLabel,
    value: displayValue,
    onPress: disabled ? undefined : openPicker,
  });
  useAgentUiTarget(testID ? `${testID}.done` : undefined, {
    label: 'Done',
    onPress: () => setShowPicker(false),
  });

  return (
    <View style={styles.wrapper}>
      {label && !stacked ? (
        <AppText variant="overline" color="tertiary" fit>
          {label}
        </AppText>
      ) : null}
      <Pressable
        ref={agent.ref}
        onLayout={agent.onLayout}
        accessibilityRole="button"
        accessibilityLabel={resolvedA11yLabel}
        accessibilityValue={{ text: displayValue }}
        disabled={disabled}
        onPress={openPicker}
        testID={testID}
        style={({ pressed }) => ({
          opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
        })}>
        {stacked ? (
          <StackedIconField
            icon="clock"
            stackedLabel={stackedLabel!}
            stackedLabelColor={stackedLabelColor ?? theme.textPrimary}
            iconBackground={iconBackground}
            iconColor={iconColor}
            fieldBackground={fieldBackground ?? glassFieldBackground(theme.name)}
            fieldBorderColor={fieldBorderColor}
            borderRadius={fieldBorderRadius ?? radii.lg}
            minHeight={stackedMinHeight}
            trailing={
              showChevron ? (
                <Symbol
                  name="chevron-down"
                  size="sm"
                  color={placeholderColor ?? theme.textTertiary}
                />
              ) : null
            }>
            <AppText
              variant="body"
              fit
              numberOfLines={1}
              style={{
                flexShrink: 1,
                minWidth: 0,
                color: hasValue
                  ? theme.textPrimary
                  : (placeholderColor ?? theme.textTertiary),
              }}>
              {displayValue}
            </AppText>
          </StackedIconField>
        ) : (
          <View
            style={[
              styles.field,
              fieldLeadingIconRowStyle({
                minHeight: 48,
                borderRadius: radii.md,
                paddingVertical: 0,
                backgroundColor: fieldBackground ?? glassFieldBackground(theme.name),
              }),
            ]}>
            <FieldLeadingIcon
              name="clock"
              backgroundColor={iconBackground}
              color={iconColor}
            />
            <AppText
              variant="body"
              color={hasValue ? 'primary' : 'tertiary'}
              style={styles.timeText}>
              {displayValue}
            </AppText>
            {showChevron ? (
              <Symbol
                name="chevron-down"
                size="sm"
                color={placeholderColor ?? theme.textTertiary}
              />
            ) : null}
          </View>
        )}
      </Pressable>

      {showPicker ? (
        <NativeDateTimePicker
          value={minutesToDate(minutes)}
          mode="time"
          display="clock"
          presentation="dialog"
          is24Hour={false}
          accentColor={theme.accentPrimary}
          positiveButton={{ label: 'Done' }}
          negativeButton={{ label: 'Cancel' }}
          onDismiss={() => setShowPicker(false)}
          onValueChange={(_event, selected) => {
            const minutes = minutesFromPickerDate(selected);
            if (minutes === undefined) {
              setShowPicker(false);
              return;
            }
            onChange(minutes);
            setShowPicker(false);
          }}
          testID={testID ? `${testID}-picker` : undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  field: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeText: {
    flex: 1,
    minWidth: 0,
  },
});
