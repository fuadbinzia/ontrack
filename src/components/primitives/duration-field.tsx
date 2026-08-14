import { useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { radii } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { numericOnChangeText } from '@/utils/parse';

import { AppText } from './app-text';
import { FieldLeadingIcon, fieldLeadingIconRowStyle } from './field-leading-icon';
import { GlassPlate } from './glass-plate';

type DurationFieldProps = {
  label?: string;
  hours: string;
  onHoursChange: (value: string) => void;
  minutes: string;
  onMinutesChange: (value: string) => void;
  hoursTestID?: string;
  minutesTestID?: string;
};

export function DurationField({
  label = 'Duration',
  hours,
  onHoursChange,
  minutes,
  onMinutesChange,
  hoursTestID,
  minutesTestID,
}: DurationFieldProps) {
  const theme = useTheme();
  const { spacing, s, typography } = useResponsive();
  const hoursRef = useRef<TextInput>(null);
  const minutesRef = useRef<TextInput>(null);
  const hoursAgent = useAgentUiTarget(hoursTestID, {
    label: 'Duration hours',
    value: hours,
    onPress: () => hoursRef.current?.focus(),
  });
  const minutesAgent = useAgentUiTarget(minutesTestID, {
    label: 'Duration minutes',
    value: minutes,
    onPress: () => minutesRef.current?.focus(),
  });
  const inputTypography = typography.body;

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="overline" color="tertiary" fit>
        {label}
      </AppText>
      <GlassPlate
        airy
        style={fieldLeadingIconRowStyle({
          minHeight: Math.max(52, s(56)),
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
          gap: spacing.md,
        })}>
        <FieldLeadingIcon name="timer" />
        <View style={styles.values}>
          <View
            ref={hoursAgent.ref}
            collapsable={false}
            onLayout={hoursAgent.onLayout}
            style={[styles.segment, { gap: spacing.xs }]}>
            <TextInput
              ref={hoursRef}
              testID={hoursTestID}
              accessibilityLabel="Duration hours"
              accessibilityValue={{ text: `${hours || '0'} hours` }}
              value={hours}
              onChangeText={numericOnChangeText(onHoursChange, {
                decimals: false,
                allowComma: false,
              })}
              keyboardType="number-pad"
              returnKeyType="next"
              maxLength={3}
              selectTextOnFocus
              allowFontScaling
              maxFontSizeMultiplier={1.3}
              style={[
                styles.input,
                inputTypography,
                { color: theme.textPrimary },
              ]}
              underlineColorAndroid="transparent"
            />
            <AppText variant="caption" color="tertiary" fit>
              hours
            </AppText>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />
          <View
            ref={minutesAgent.ref}
            collapsable={false}
            onLayout={minutesAgent.onLayout}
            style={[styles.segment, { gap: spacing.xs }]}>
            <TextInput
              ref={minutesRef}
              testID={minutesTestID}
              accessibilityLabel="Duration minutes"
              accessibilityValue={{ text: `${minutes || '0'} mins` }}
              value={minutes}
              onChangeText={numericOnChangeText(onMinutesChange, {
                decimals: false,
                allowComma: false,
              })}
              keyboardType="number-pad"
              returnKeyType="done"
              maxLength={2}
              selectTextOnFocus
              allowFontScaling
              maxFontSizeMultiplier={1.3}
              style={[
                styles.input,
                inputTypography,
                { color: theme.textPrimary },
              ]}
              underlineColorAndroid="transparent"
            />
            <AppText variant="caption" color="tertiary" fit>
              mins
            </AppText>
          </View>
        </View>
      </GlassPlate>
    </View>
  );
}

const styles = StyleSheet.create({
  values: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minWidth: 28,
    padding: 0,
    margin: 0,
    textAlign: 'right',
    includeFontPadding: false,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },
});
