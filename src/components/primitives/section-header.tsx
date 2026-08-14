import { Pressable, StyleSheet, View, type TextStyle } from 'react-native';

import { useResponsive } from '@/hooks/use-responsive';
import { useAgentUiTarget } from '@/utils/agent-ui';

import { AppText } from './app-text';
import { fieldTitleCase } from './field-title-case';

interface SectionHeaderProps {
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Stable `ontrack.*` testID for the trailing action control. */
  actionTestID?: string;
  actionDisabled?: boolean;
  titleStyle?: TextStyle;
  titleColor?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'danger' | 'success';
  /**
   * Drop built-in vertical margins when the parent owns rhythm
   * (e.g. `Screen contentStyle` gap). Default keeps legacy profile-style spacing.
   */
  flush?: boolean;
}

export function SectionHeader({
  title,
  detail,
  actionLabel,
  onAction,
  actionTestID,
  actionDisabled,
  titleStyle,
  titleColor = 'secondary',
  flush = false,
}: SectionHeaderProps) {
  const { spacing, layout } = useResponsive();
  const titleText = fieldTitleCase(title);
  const actionText = actionLabel ? fieldTitleCase(actionLabel) : undefined;
  const handleAction = onAction && !actionDisabled ? onAction : undefined;
  const agent = useAgentUiTarget(actionTestID, {
    label: actionText,
    onPress: handleAction,
  });

  return (
    <View
      style={[
        styles.row,
        {
          gap: spacing.md,
          marginTop: flush ? 0 : spacing.xl,
          marginBottom: flush ? 0 : spacing.md,
        },
      ]}>
      <AppText
        variant="overline"
        color={titleColor}
        style={[styles.title, titleStyle]}
        fit>
        {titleText}
      </AppText>
      {actionText && onAction ? (
        <Pressable
          ref={agent.ref}
          onLayout={agent.onLayout}
          testID={agent.testID}
          accessibilityRole="button"
          accessibilityLabel={actionText}
          accessibilityState={{ disabled: Boolean(actionDisabled) }}
          disabled={actionDisabled}
          onPress={handleAction}
          hitSlop={8}
          style={{
            minHeight: layout.minTapTarget,
            minWidth: layout.minTapTarget,
            justifyContent: 'center',
            alignItems: 'flex-end',
            flexShrink: 0,
            opacity: actionDisabled ? 0.45 : 1,
          }}>
          <AppText variant="caption" color="accent" fit>
            {actionText}
          </AppText>
        </Pressable>
      ) : detail ? (
        <AppText variant="caption" color="tertiary" style={styles.detail} fit titleCase>
          {detail}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  detail: {
    flexShrink: 1,
    maxWidth: '42%',
    textAlign: 'right',
  },
});
