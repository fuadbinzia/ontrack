import type { ChangeEvent, CSSProperties } from 'react';
import { createElement } from 'react';
import { View } from 'react-native';

import { radii, spacing, typography } from '@/design-system';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { datePlaceholderForLocale } from '@/utils/date';

import { AppText } from './app-text';

interface DateFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: string;
  maximumDate?: string;
  disabled?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
  testID?: string;
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  disabled = false,
  placeholder = 'MM/DD/YY',
  accessibilityLabel,
  testID,
}: DateFieldProps) {
  const theme = useTheme();
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const resolvedPlaceholder =
    placeholder === 'MM/DD/YY'
      ? datePlaceholderForLocale(dateDisplayFormat)
      : placeholder;
  const style: CSSProperties = {
    minHeight: 48,
    width: '100%',
    boxSizing: 'border-box',
    border: 0,
    borderRadius: radii.md,
    padding: `${spacing.md}px ${spacing.lg}px`,
    background: theme.backgroundSunken,
    color: theme.textPrimary,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {label ? (
        <AppText variant="overline" color="tertiary">
          {label}
        </AppText>
      ) : null}
      {createElement('input', {
        'aria-label': accessibilityLabel ?? label ?? 'Date',
        'data-testid': testID,
        type: 'date',
        lang: dateDisplayFormat === 'system' ? undefined : dateDisplayFormat,
        value,
        min: minimumDate,
        max: maximumDate,
        disabled,
        placeholder: resolvedPlaceholder,
        style,
        onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value),
      })}
    </View>
  );
}
