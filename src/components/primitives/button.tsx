import { BlurView } from 'expo-blur';
import type { PropsWithChildren, ReactNode } from 'react';
import {
    Platform,
    Pressable,
    StyleSheet,
    View,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from 'react-native';

import { glassMaterials, radii, type AppIconName } from '@/design-system';
import { usePerformanceTier } from '@/hooks/use-performance-tier';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';
import { AppText } from './app-text';
import { fieldTitleCase } from './field-title-case';
import { GlassPlate } from './glass-plate';
import { LoadingSpinner } from './loading-spinner';
import { Symbol } from './symbol';

interface ButtonProps extends PropsWithChildren {
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  shape?: 'pill' | 'rounded';
  icon?: AppIconName;
  leading?: ReactNode;
  /** Far-right glyph (e.g. chevron); stretches the label row with space-between. */
  trailing?: AppIconName;
  /** Replaces the leading icon with a spinner while work is in flight. */
  loading?: boolean;
  disabled?: boolean;
  /**
   * `glass` = frosted plate (app default for secondary; tinted frost for primary/danger).
   * Pass `solid` for opaque accent / sunken fills.
   */
  appearance?: 'solid' | 'glass';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  shape = 'pill',
  icon,
  leading,
  trailing,
  loading = false,
  disabled,
  appearance = 'glass',
  style,
  textStyle,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const { spacing, layout, iconSizes } = useResponsive();
  const glass = appearance === 'glass' && variant !== 'ghost';
  const solidBackground = {
    primary: theme.accentPrimary,
    secondary: theme.backgroundSunken,
    ghost: 'transparent',
    danger: theme.danger,
  }[variant];
  const solidOnAccent = !glass && (variant === 'primary' || variant === 'danger');
  const textColor = (solidOnAccent ? 'onAccent' : 'primary') as 'onAccent' | 'primary';
  // Primary/danger glass: white ink on tinted frost; secondary uses theme ink.
  const glassAccentInk =
    glass && (variant === 'primary' || variant === 'danger')
      ? '#FFFFFF'
      : null;
  const resolvedTextColor = glassAccentInk ? undefined : textColor;
  const resolvedIconColor =
    glassAccentInk ??
    (solidOnAccent ? theme.textOnAccent : theme.textPrimary);
  const isDisabled = disabled || loading;
  const hasTrailing = Boolean(trailing);
  const centerWithTrailing = hasTrailing && !loading && !leading && !icon;
  const labelText =
    typeof children === 'string'
      ? fieldTitleCase(children)
      : children;
  const a11yLabel = accessibilityLabel
    ? fieldTitleCase(accessibilityLabel)
    : typeof children === 'string'
      ? fieldTitleCase(children)
      : undefined;
  const handlePress = () => {
    try {
      haptics.tap();
    } catch {
      // Best-effort haptics should never block the button action.
    }
    onPress();
  };
  const agent = useAgentUiTarget(testID, {
    label: a11yLabel,
    onPress: isDisabled ? undefined : handlePress,
  });

  const radius = shape === 'rounded' ? radii.md : radii.pill;
  const padHorizontal = size === 'sm' ? spacing.md : spacing.xl;
  const padStyle = {
    gap: spacing.sm,
    minHeight: layout.minTapTarget,
    paddingHorizontal: padHorizontal,
    paddingVertical: size === 'lg' ? spacing.lg : size === 'sm' ? spacing.sm : spacing.md,
    borderRadius: radius,
    borderCurve: 'continuous' as const,
  };
  const trailingGlyph = trailing ? (
    <View
      pointerEvents="none"
      style={
        centerWithTrailing
          ? [styles.trailingAbsolute, { right: padHorizontal }]
          : undefined
      }>
      <Symbol name={trailing} size="sm" color={resolvedIconColor} />
    </View>
  ) : null;
  const label = (
    <>
      {loading ? (
        <LoadingSpinner size={iconSizes.sm} color={resolvedIconColor} />
      ) : leading ? (
        leading
      ) : icon ? (
        <Symbol name={icon} size="sm" color={resolvedIconColor} />
      ) : null}
      {labelText != null && labelText !== false && labelText !== '' ? (
        <AppText
          variant={size === 'lg' ? 'subheading' : size === 'sm' ? 'caption' : 'callout'}
          color={resolvedTextColor}
          align={centerWithTrailing ? 'center' : undefined}
          numberOfLines={1}
          style={[
            centerWithTrailing
              ? [styles.centeredTrailingLabel, { paddingHorizontal: iconSizes.sm + spacing.sm }]
              : hasTrailing
                ? styles.trailingLabel
                : null,
            textStyle,
            glassAccentInk ? { color: glassAccentInk } : null,
          ]}>
          {labelText}
        </AppText>
      ) : null}
      {trailingGlyph}
    </>
  );

  if (glass) {
    const tinted =
      variant === 'primary'
        ? {
            borderColor: `${theme.accentPrimary}99`,
            backgroundColor:
              theme.name === 'dark'
                ? `${theme.accentPrimary}66`
                : `${theme.accentPrimary}B8`,
          }
        : variant === 'danger'
          ? {
              borderColor: `${theme.danger}88`,
              backgroundColor:
                theme.name === 'dark'
                  ? 'rgba(180, 60, 60, 0.42)'
                  : 'rgba(180, 60, 60, 0.55)',
            }
          : null;
    return (
      <Pressable
        ref={agent.ref}
        testID={testID}
        onLayout={agent.onLayout}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPress={handlePress}
        style={({ pressed }) => [
          { opacity: isDisabled && !loading ? 0.55 : pressed ? 0.75 : 1 },
          style,
        ]}>
        <GlassPlate
          inverted={variant === 'primary' || variant === 'danger'}
          style={[styles.base, hasTrailing ? styles.withTrailing : null, padStyle, tinted]}>
          {label}
        </GlassPlate>
      </Pressable>
    );
  }

  return (
    <Pressable
      ref={agent.ref}
      testID={testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        hasTrailing ? styles.withTrailing : null,
        padStyle,
        {
          opacity: isDisabled && !loading ? 0.55 : pressed ? 0.75 : 1,
          backgroundColor: solidBackground,
        },
        style,
      ]}>
      {label}
    </Pressable>
  );
}

interface IconButtonProps {
  icon: AppIconName;
  onPress: () => void;
  color?: string;
  iconSize?: keyof ReturnType<typeof useResponsive>['iconSizes'] | number;
  background?: string;
  borderColor?: string;
  shape?: 'circle' | 'rounded';
  size?: number;
  /**
   * `glass` = frosted translucent disc (app default).
   * Pass `solid` for opaque sunken plates.
   */
  appearance?: 'solid' | 'glass';
  accessibilityLabel: string;
  /** Replaces the leading icon with a spinner while work is in flight. */
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function IconButton({
  icon,
  onPress,
  color,
  iconSize = 'md',
  background,
  borderColor,
  shape = 'circle',
  size,
  appearance = 'glass',
  accessibilityLabel,
  loading = false,
  disabled,
  testID,
}: IconButtonProps) {
  const theme = useTheme();
  const { allowsBlur } = usePerformanceTier();
  const { layout, iconSizes } = useResponsive();
  const resolvedSize = size ?? layout.minTapTarget;
  const resolvedHitSlop = Math.max(6, (layout.minTapTarget - resolvedSize) / 2);
  const isDisabled = disabled || loading;
  const glass = appearance === 'glass';
  const dark = theme.name === 'dark';
  const tint = color ?? (glass ? theme.textSecondary : theme.textPrimary);
  const spinnerColor = color ?? theme.accentPrimary;
  const radius = shape === 'rounded' ? radii.md : resolvedSize / 2;
  const handlePress = () => {
    try {
      haptics.tap();
    } catch {
      // Best-effort haptics should never block the button action.
    }
    onPress();
  };
  const agent = useAgentUiTarget(testID, {
    label: accessibilityLabel,
    onPress: isDisabled ? undefined : handlePress,
  });
  return (
    <Pressable
      ref={agent.ref}
      testID={testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={resolvedHitSlop}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: resolvedSize,
          height: resolvedSize,
          borderRadius: radius,
          overflow: glass ? 'hidden' : undefined,
          backgroundColor: glass
            ? 'transparent'
            : (background ?? theme.backgroundSunken),
          borderColor: glass
            ? dark
              ? glassMaterials.border.darkStrong
              : glassMaterials.border.light
            : borderColor,
          borderWidth: glass || borderColor ? StyleSheet.hairlineWidth : 0,
          opacity: isDisabled && !loading ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}>
      {glass ? (
        Platform.OS === 'android' ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              dark ? styles.glassAndroidDark : styles.glassAndroidLight,
            ]}
          />
        ) : (
          <>
            <BlurView
              intensity={allowsBlur ? (dark ? 40 : 48) : 0}
              tint={dark ? 'dark' : 'light'}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: dark
                    ? allowsBlur
                      ? 'rgba(0, 0, 0, 0.28)'
                      : 'rgba(0, 0, 0, 0.45)'
                    : allowsBlur
                      ? 'rgba(255, 255, 255, 0.3)'
                      : 'rgba(255, 255, 255, 0.72)',
                },
              ]}
            />
          </>
        )
      ) : null}
      <View style={styles.iconButtonGlyph}>
        {loading ? (
          <LoadingSpinner size={Math.round(iconSizes.md * 0.95)} color={spinnerColor} />
        ) : (
          <Symbol name={icon} size={iconSize} color={tint} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  withTrailing: {
    justifyContent: 'center',
    position: 'relative',
  },
  trailingLabel: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  centeredTrailingLabel: {
    width: '100%',
    flexShrink: 1,
    minWidth: 0,
  },
  trailingAbsolute: {
    position: 'absolute',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  iconButtonGlyph: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassAndroidLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.52)',
    experimental_backgroundImage:
      'linear-gradient(160deg, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0.38) 45%, rgba(255,255,255,0.56) 100%)',
  },
  glassAndroidDark: {
    backgroundColor: 'rgba(12, 16, 24, 0.3)',
    experimental_backgroundImage:
      'linear-gradient(160deg, rgba(36,42,54,0.36) 0%, rgba(12,16,24,0.24) 50%, rgba(8,12,18,0.32) 100%)',
  },
});
