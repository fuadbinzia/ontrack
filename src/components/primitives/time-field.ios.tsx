import ExpoDateTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { glassFieldBackground, radii, shadows, spacing } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { formatMinutes, formatTimePickerTitle, nowMinutes } from '@/utils/date';

import { AppText } from './app-text';
import { IconButton } from './button';
import { FieldLeadingIcon, fieldLeadingIconRowStyle } from './field-leading-icon';
import { stackedFieldMinHeight } from './field-leading-icon-style';
import { GlassPlate } from './glass-plate';
import { StackedIconField } from './stacked-icon-field';
import { Symbol } from './symbol';
import {
    clampMinutesFromMidnight,
    minutesFromPickerDate,
    minutesToDate,
    type TimeFieldProps,
} from './time-field.types';

/** Tappable iOS time field backed by a full-width native wheel picker. */
export function TimeField({
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
  const insets = useSafeAreaInsets();
  const { spacing: rs, layout, s, typography, fontScale } = useResponsive();
  const stackedMinHeight = stackedFieldMinHeight({
    baseMinHeight: Math.max(56, s(60)),
    fontScale,
    labelLineHeight: typography.caption.lineHeight,
    valueLineHeight: typography.body.lineHeight,
    verticalPadding: rs.sm,
  });
  const [showPicker, setShowPicker] = useState(false);
  const [draftMinutes, setDraftMinutes] = useState(() =>
    clampMinutesFromMidnight(value ?? nowMinutes()),
  );
  const hasValue = value !== null;
  const displayValue = hasValue
    ? formatMinutes(clampMinutesFromMidnight(value))
    : placeholder;
  const resolvedA11yLabel = accessibilityLabel ?? label ?? stackedLabel ?? 'Time';
  const pickerTitle = formatTimePickerTitle(resolvedA11yLabel);
  const stacked = Boolean(stackedLabel);

  const openPicker = () => {
    setDraftMinutes(clampMinutesFromMidnight(value ?? nowMinutes()));
    setShowPicker(true);
  };

  const commitDraft = () => {
    onChange(draftMinutes);
    setShowPicker(false);
  };
  const agent = useAgentUiTarget(testID, {
    label: resolvedA11yLabel,
    onPress: disabled ? undefined : openPicker,
  });
  const doneAgent = useAgentUiTarget(testID ? `${testID}.done` : undefined, {
    label: 'Done',
    onPress: commitDraft,
  });

  return (
    <View style={[styles.wrapper, { gap: rs.sm }]}>
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
        style={({ pressed }) => ({
          opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
        })}
        testID={testID}>
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
                minHeight: Math.max(44, s(48)),
                borderRadius: radii.md,
                paddingHorizontal: rs.md,
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

      <Modal
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
        presentationStyle="overFullScreen"
        transparent
        visible={showPicker}>
        <View
          style={[
            styles.modalRoot,
            {
              backgroundColor: theme.overlayScrim,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              paddingHorizontal: layout.screenPadding,
            },
          ]}>
          <Pressable
            accessible={false}
            onPress={() => setShowPicker(false)}
            style={StyleSheet.absoluteFill}
          />
          <GlassPlate
            style={[
              styles.pickerSheet,
              {
                maxWidth: Math.min(layout.maxContentWidth, s(420)),
                padding: rs.md,
                gap: rs.sm,
              },
            ]}>
            <View style={[styles.pickerHeader, { gap: rs.sm }]}>
              <AppText variant="heading" fit style={styles.pickerTitle}>
                {pickerTitle}
              </AppText>
              <IconButton
                icon="close"
                accessibilityLabel="Close time picker"
                testID={testID ? `${testID}.close` : undefined}
                onPress={() => setShowPicker(false)}
              />
            </View>
            <ExpoDateTimePicker
              value={minutesToDate(draftMinutes)}
              mode="time"
              display="spinner"
              locale="en_US"
              accentColor={theme.accentPrimary}
              themeVariant={theme.name}
              style={styles.timePicker}
              testID={testID ? `${testID}-picker` : undefined}
              onValueChange={(_event, selected) => {
                const minutes = minutesFromPickerDate(selected);
                if (minutes === undefined) return;
                setDraftMinutes(minutes);
              }}
            />
            <Pressable
              ref={doneAgent.ref}
              testID={testID ? `${testID}.done` : undefined}
              onLayout={doneAgent.onLayout}
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={commitDraft}
              style={({ pressed }) => [
                styles.done,
                {
                  minHeight: Math.max(44, s(48)),
                  paddingHorizontal: rs.md,
                  backgroundColor: theme.accentPrimary,
                  borderColor: theme.accentSoft,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              <AppText variant="subheading" color="onAccent" fit>
                Done
              </AppText>
            </Pressable>
          </GlassPlate>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  field: {
    width: '100%',
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeText: {
    flex: 1,
    minWidth: 0,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  pickerSheet: {
    width: '100%',
    alignSelf: 'center',
    ...shadows.overlay,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerTitle: {
    flex: 1,
    minWidth: 0,
  },
  timePicker: {
    width: '100%',
    height: 156,
  },
  done: {
    ...shadows.raised,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
