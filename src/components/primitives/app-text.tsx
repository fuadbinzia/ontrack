import { forwardRef } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { typeConfig, type TypeVariant } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';

import { titleCaseTextChildren } from './field-title-case';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'danger' | 'success';
  align?: TextStyle['textAlign'];
  /**
   * Explicit emphasis. Default is regular weight from `typeConfig` —
   * only set when the design calls for bold.
   */
  bold?: boolean;
  /**
   * Single-line chrome: shrinks to fit width instead of wrapping.
   * Use for button labels, tab labels, headers in tight rows, chips.
   */
  fit?: boolean;
  /** Floor when `fit` is set (default 0.72). */
  fitMinimumScale?: number;
  /** Title-case compact chrome. Automatically enabled for the overline variant. */
  titleCase?: boolean;
}

export const AppText = forwardRef<Text, AppTextProps>(function AppText(
  {
    variant = 'body',
    color = 'primary',
    align,
    bold = false,
    fit = false,
    fitMinimumScale = 0.72,
    titleCase = false,
    style,
    children,
    numberOfLines,
    adjustsFontSizeToFit,
    minimumFontScale,
    maxFontSizeMultiplier,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const { typography } = useResponsive();
  const colorValue = {
    primary: theme.textPrimary,
    secondary: theme.textSecondary,
    tertiary: theme.textTertiary,
    accent: theme.accentPrimary,
    onAccent: theme.textOnAccent,
    danger: theme.danger,
    success: theme.success,
  }[color];

  const shouldFit = fit || adjustsFontSizeToFit === true;
  const shouldTitleCase = titleCase || variant === 'overline';
  const content = shouldTitleCase ? titleCaseTextChildren(children) : children;

  return (
    <Text
      ref={ref}
      allowFontScaling
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (shouldFit ? 1.15 : 1.3)}
      numberOfLines={numberOfLines ?? (shouldFit ? 1 : undefined)}
      adjustsFontSizeToFit={shouldFit}
      minimumFontScale={minimumFontScale ?? (shouldFit ? fitMinimumScale : undefined)}
      style={[
        typography[variant] as TextStyle,
        bold ? { fontWeight: typeConfig.weight.bold } : null,
        { color: colorValue },
        align && { textAlign: align },
        shouldFit && { flexShrink: 1, minWidth: 0 },
        style,
      ]}
      {...rest}>
      {content}
    </Text>
  );
});
