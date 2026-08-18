import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import {
    StyleSheet,
    TextInput,
    View,
    type StyleProp,
    type TextInputProps,
    type TextStyle,
    type ViewStyle,
} from 'react-native';

import {
    glassFieldBackground,
    glassFieldBorder,
    radii,
    type AppIconName,
} from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { formatNumericInput } from '@/utils/parse';
import { AppText } from './app-text';
import {
    FieldLeadingIcon,
    fieldLeadingIconRowStyle,
    iconMultilineOpticalPad,
} from './field-leading-icon';
import { stackedFieldMinHeight } from './field-leading-icon-style';
import { StackedFieldLabel } from './stacked-field-label';
import {
    StackedIconField,
    stackedIconFieldShouldExpand,
} from './stacked-icon-field';

function readStyleMinHeight(style: StyleProp<TextStyle>): number | undefined {
  const flat = StyleSheet.flatten(style);
  const value = flat?.minHeight;
  return typeof value === 'number' ? value : undefined;
}

function readStyleHeight(style: StyleProp<TextStyle>): number | undefined {
  const flat = StyleSheet.flatten(style);
  const value = flat?.height;
  return typeof value === 'number' ? value : undefined;
}

/** Multiline contentSize must report text, not the chrome frame we grow. */
function withoutFrameSize(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style);
  if (!flat) return style;
  const { minHeight: _minHeight, height: _height, ...rest } = flat;
  return rest;
}

interface InputProps extends TextInputProps {
  label?: string;
  /** Leading icon inside the field, matching DateField / TimeField chrome. */
  icon?: AppIconName;
  /** Persistent label above the value (sheet stacked chrome; icon optional). */
  stackedLabel?: string;
  /** Align stacked label + value (`center` for short numeric fields). */
  stackedAlign?: 'start' | 'center';
  iconBackground?: string;
  iconColor?: string;
  fieldBackground?: string;
  fieldBorderColor?: string;
  fieldBorderRadius?: number;
  stackedLabelColor?: string;
  /** Optional supporting copy shown below a stacked field value. */
  helperText?: string;
  trailing?: ReactNode;
  /** Layout for the complete field wrapper, such as `flex: 1` in a toolbar. */
  containerStyle?: StyleProp<ViewStyle>;
}

function numericSanitizeOptions(keyboardType: TextInputProps['keyboardType']) {
  if (keyboardType === 'number-pad') {
    return { decimals: false, allowComma: false } as const;
  }
  if (keyboardType === 'decimal-pad' || keyboardType === 'numeric') {
    return { decimals: true } as const;
  }
  return null;
}

function numericChangeForKeyboard(
  keyboardType: TextInputProps['keyboardType'],
  onChangeText: TextInputProps['onChangeText'],
) {
  const options = numericSanitizeOptions(keyboardType);
  if (!options) return onChangeText;
  if (!onChangeText) return undefined;

  // Keep form state machine-friendly (no separators) while rendering the
  // formatted value below. This avoids making every numeric consumer parse
  // display punctuation before saving.
  return (text: string) => onChangeText(formatNumericInput(text, options).replace(/,/g, ''));
}

function sanitizeNumericValue(
  value: TextInputProps['value'],
  keyboardType: TextInputProps['keyboardType'],
) {
  const options = numericSanitizeOptions(keyboardType);
  if (!options || value == null) return value;
  return formatNumericInput(String(value), options);
}

export function Input({
  label,
  style,
  icon,
  stackedLabel,
  stackedAlign = 'start',
  iconBackground,
  iconColor,
  fieldBackground,
  fieldBorderColor,
  fieldBorderRadius,
  stackedLabelColor,
  helperText,
  trailing,
  containerStyle,
  multiline,
  placeholder,
  placeholderTextColor,
  value,
  onFocus,
  onBlur,
  keyboardType,
  onChangeText,
  testID,
  accessibilityLabel,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const { typography, spacing, s, fontScale } = useResponsive();
  const minHeight = Math.max(44, s(48));
  const styleMinHeight = readStyleMinHeight(style);
  const styleHeight = readStyleHeight(style);
  const rowMinHeight = styleMinHeight ?? minHeight;
  const stackedMinHeight = stackedFieldMinHeight({
    baseMinHeight: Math.max(56, s(60)),
    fontScale,
    labelLineHeight: typography.caption.lineHeight,
    valueLineHeight: typography.body.lineHeight,
    verticalPadding: spacing.sm,
  });
  const hasIcon = Boolean(icon);
  const stacked = Boolean(stackedLabel);
  const stackedCentered = stacked && stackedAlign === 'center';
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const numericValue = sanitizeNumericValue(value, keyboardType);
  const body = typography.body;
  const oneLineHeight = Math.ceil(body.lineHeight * Math.min(fontScale, 1.3));
  const expandStacked = stackedIconFieldShouldExpand({
    multiline,
    value: numericValue,
    styleMinHeight: readStyleMinHeight(style),
    oneLineHeight,
  });
  const hasValue = String(numericValue ?? '').length > 0;
  const showChromePlaceholder =
    hasIcon &&
    !stacked &&
    !multiline &&
    !hasValue &&
    !focused &&
    Boolean(placeholder);
  const iconMultilinePad = iconMultilineOpticalPad(rowMinHeight, oneLineHeight);
  const fill = fieldBackground ?? glassFieldBackground(theme.name);
  const handleChangeText = numericChangeForKeyboard(keyboardType, onChangeText);
  const agent = useAgentUiTarget(testID, {
    label: accessibilityLabel ?? stackedLabel ?? label,
    // Registry value for --contains; keep accessibilityLabel chrome-only.
    value: String(numericValue ?? ''),
    onPress: () => inputRef.current?.focus(),
  });

  const handleFocus: TextInputProps['onFocus'] = (event) => {
    setFocused(true);
    onFocus?.(event);
  };
  const handleBlur: TextInputProps['onBlur'] = (event) => {
    setFocused(false);
    onBlur?.(event);
  };

  if (hasIcon || stacked) {
    return (
      <View
        ref={agent.ref}
        collapsable={false}
        onLayout={agent.onLayout}
        style={[styles.wrapper, { gap: spacing.sm }, containerStyle]}>
        {label && !stacked ? (
          <AppText variant="overline" color="tertiary" numberOfLines={1}>
            {label}
          </AppText>
        ) : null}
        {stacked && icon ? (
          <StackedIconField
            icon={icon}
            stackedLabel={stackedLabel!}
            stackedLabelColor={stackedLabelColor ?? theme.textPrimary}
            stackedAlign={stackedAlign}
            iconBackground={iconBackground}
            iconColor={iconColor}
            fieldBackground={fill}
            fieldBorderColor={fieldBorderColor}
            borderRadius={fieldBorderRadius ?? radii.lg}
            expand={expandStacked}
            minHeight={stackedMinHeight}
            trailing={trailing}>
            <TextInput
              ref={inputRef}
              testID={testID}
              accessibilityLabel={accessibilityLabel}
              value={numericValue}
              placeholder={placeholder}
              placeholderTextColor={placeholderTextColor ?? theme.textTertiary}
              allowFontScaling
              maxFontSizeMultiplier={2}
              multiline={multiline}
              keyboardType={keyboardType}
              onChangeText={handleChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              style={[
                styles.input,
                styles.iconInput,
                {
                  fontFamily: body.fontFamily,
                  fontSize: body.fontSize,
                  fontWeight: body.fontWeight,
                  lineHeight: body.lineHeight,
                  color: theme.textPrimary,
                  padding: 0,
                  margin: 0,
                  includeFontPadding: false,
                  textAlignVertical: expandStacked ? 'top' : 'center',
                  textAlign: stackedCentered ? 'center' : 'left',
                },
                expandStacked ? styles.stackedMultilineInput : null,
                trailing ? { paddingRight: s(40) } : null,
                style,
                // Pin wins over caller minHeight so empty Notes matches peers.
                expandStacked ? null : { minHeight: oneLineHeight },
              ]}
              {...rest}
              underlineColorAndroid="transparent"
            />
            {helperText ? (
              <AppText variant="caption" color="tertiary" numberOfLines={1}>
                {helperText}
              </AppText>
            ) : null}
          </StackedIconField>
        ) : stacked ? (
          <View
            style={[
              styles.iconField,
              fieldLeadingIconRowStyle({
                minHeight: stackedMinHeight,
                borderRadius: radii.lg,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                gap: spacing.sm,
                backgroundColor: fill,
              }),
            ]}>
            <View
              style={[
                styles.stackedCopy,
                stackedCentered ? styles.stackedCopyCentered : null,
              ]}>
              <StackedFieldLabel
                color={stackedLabelColor ?? theme.textPrimary}
                align={stackedCentered ? 'center' : 'start'}
                style={styles.stackedLabel}>
                {stackedLabel!}
              </StackedFieldLabel>
              <TextInput
                ref={inputRef}
                testID={testID}
                accessibilityLabel={accessibilityLabel}
                value={numericValue}
                placeholder={placeholder}
                placeholderTextColor={placeholderTextColor ?? theme.textTertiary}
                allowFontScaling
                maxFontSizeMultiplier={2}
                multiline={multiline}
                keyboardType={keyboardType}
                onChangeText={handleChangeText}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={[
                  styles.input,
                  styles.iconInput,
                  {
                    fontFamily: body.fontFamily,
                    fontSize: body.fontSize,
                    fontWeight: body.fontWeight,
                    lineHeight: body.lineHeight,
                    color: theme.textPrimary,
                    minHeight: multiline
                      ? undefined
                      : Math.max(
                          s(24),
                          Math.ceil(body.lineHeight * Math.min(fontScale, 1.3)),
                        ),
                    padding: 0,
                    margin: 0,
                    includeFontPadding: false,
                    textAlignVertical: multiline ? 'top' : 'center',
                    textAlign: stackedCentered ? 'center' : 'left',
                  },
                  multiline ? styles.stackedMultilineInput : null,
                  trailing ? { paddingRight: s(40) } : null,
                  style,
                ]}
                {...rest}
                underlineColorAndroid="transparent"
              />
              {helperText ? (
                <AppText variant="caption" color="tertiary" numberOfLines={1}>
                  {helperText}
                </AppText>
              ) : null}
            </View>
            {trailing ? (
              <View style={[styles.trailing, { right: spacing.xs }]}>{trailing}</View>
            ) : null}
          </View>
        ) : (
          <View
            style={[
              styles.iconField,
              fieldLeadingIconRowStyle({
                minHeight: rowMinHeight,
                height: multiline ? styleHeight : rowMinHeight,
                overflow: multiline && styleHeight ? 'hidden' : undefined,
                borderRadius: radii.lg,
                paddingHorizontal: spacing.md,
                paddingVertical: 0,
                gap: spacing.sm,
                backgroundColor: fill,
              }),
            ]}>
            {icon ? (
              <FieldLeadingIcon
                name={icon}
                backgroundColor={iconBackground}
                color={iconColor}
              />
            ) : null}
            {showChromePlaceholder ? (
              <AppText
                variant="body"
                color="tertiary"
                numberOfLines={1}
                style={styles.chromeLabel}>
                {placeholder}
              </AppText>
            ) : multiline ? (
              <View
                style={[
                  styles.iconMultilineSlot,
                  { paddingVertical: iconMultilinePad },
                ]}>
                <TextInput
                  ref={inputRef}
                  testID={testID}
                  accessibilityLabel={accessibilityLabel}
                  value={numericValue}
                  placeholder={placeholder}
                  placeholderTextColor={placeholderTextColor ?? theme.textTertiary}
                  allowFontScaling
                  maxFontSizeMultiplier={2}
                  multiline
                  keyboardType={keyboardType}
                  onChangeText={handleChangeText}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  style={[
                    styles.input,
                    styles.iconInput,
                    styles.stackedMultilineInput,
                    {
                      fontFamily: body.fontFamily,
                      fontSize: body.fontSize,
                      fontWeight: body.fontWeight,
                      lineHeight: body.lineHeight,
                      color: theme.textPrimary,
                      includeFontPadding: false,
                      textAlignVertical: 'top',
                      alignSelf: 'stretch',
                      flexGrow: 0,
                      flexShrink: 0,
                    },
                    trailing ? { paddingRight: s(40) } : null,
                    withoutFrameSize(style),
                  ]}
                  {...rest}
                  underlineColorAndroid="transparent"
                />
              </View>
            ) : (
              <TextInput
                ref={inputRef}
                testID={testID}
                accessibilityLabel={accessibilityLabel}
                value={numericValue}
                placeholder={undefined}
                allowFontScaling
                maxFontSizeMultiplier={2}
                keyboardType={keyboardType}
                onChangeText={handleChangeText}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={[
                  styles.input,
                  styles.iconInput,
                  {
                    fontFamily: body.fontFamily,
                    fontSize: body.fontSize,
                    fontWeight: body.fontWeight,
                    color: theme.textPrimary,
                    minHeight: Math.max(0, rowMinHeight - 4),
                    includeFontPadding: false,
                    textAlignVertical: 'center',
                  },
                  trailing ? { paddingRight: s(40) } : null,
                  style,
                ]}
                {...rest}
                underlineColorAndroid="transparent"
              />
            )}
            {showChromePlaceholder ? (
              <TextInput
                ref={inputRef}
                testID={testID}
                accessibilityLabel={accessibilityLabel}
                value={numericValue}
                caretHidden
                allowFontScaling
                maxFontSizeMultiplier={2}
                keyboardType={keyboardType}
                onChangeText={handleChangeText}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={styles.hitInput}
                {...rest}
                underlineColorAndroid="transparent"
              />
            ) : null}
            {trailing ? (
              <View style={[styles.trailing, { right: spacing.xs }]}>{trailing}</View>
            ) : null}
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      ref={agent.ref}
      collapsable={false}
      onLayout={agent.onLayout}
      style={[styles.wrapper, { gap: spacing.sm }, containerStyle]}>
      {label ? (
        <AppText variant="overline" color="tertiary" numberOfLines={1}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.field}>
        <TextInput
          ref={inputRef}
          testID={testID}
          accessibilityLabel={accessibilityLabel}
          value={numericValue}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor ?? theme.textTertiary}
          allowFontScaling
          maxFontSizeMultiplier={2}
          multiline={multiline}
          keyboardType={keyboardType}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[
            {
              borderRadius: fieldBorderRadius ?? radii.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              minHeight,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: fieldBorderColor ?? glassFieldBorder(theme.name),
            },
            trailing ? { paddingRight: s(56) } : null,
            typography.body,
            {
              backgroundColor: fill,
              color: theme.textPrimary,
            },
            style,
          ]}
          {...rest}
          underlineColorAndroid="transparent"
        />
        {trailing ? (
          <View style={[styles.trailing, { right: spacing.xs }]}>{trailing}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  field: {
    position: 'relative',
  },
  iconField: {
    position: 'relative',
    flexDirection: 'row',
    overflow: 'visible',
  },
  stackedCopy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
    justifyContent: 'center',
  },
  stackedCopyCentered: {
    alignItems: 'center',
  },
  stackedLabel: {
    flexShrink: 1,
    minWidth: 0,
  },
  chromeLabel: {
    flex: 1,
    minWidth: 0,
    letterSpacing: 0,
  },
  iconInput: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    letterSpacing: 0,
  },
  iconMultilineSlot: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
  },
  stackedMultilineInput: {
    // A growing native multiline input can paint over its preceding label.
    // Its explicit/intrinsic height should size the stacked copy instead.
    flexGrow: 0,
    flexBasis: 'auto',
  },
  input: {},
  hitInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.02,
  },
  trailing: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
