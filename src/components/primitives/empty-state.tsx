import {
    Pressable,
    StyleSheet,
    View,
    type StyleProp,
    type TextStyle,
} from 'react-native';

import { radii, type AppIconName } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

import { AppText } from './app-text';
import { fieldTitleCase, formatEmptyStateTitle } from './field-title-case';
import { GlassPlate } from './glass-plate';
import { Symbol } from './symbol';

interface EmptyStateProps {
  icon: AppIconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionTestID?: string;
  titleStyle?: StyleProp<TextStyle>;
  messageStyle?: StyleProp<TextStyle>;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  actionTestID,
  titleStyle,
  messageStyle,
}: EmptyStateProps) {
  const theme = useTheme();
  const { spacing, layout } = useResponsive();
  const titleText = formatEmptyStateTitle(title);
  const actionTitle = actionLabel ? fieldTitleCase(actionLabel) : undefined;
  const handleAction = () => {
    if (!onAction) return;
    haptics.tap();
    onAction();
  };
  const agent = useAgentUiTarget(actionTestID, {
    label: actionTitle,
    onPress: actionTitle && onAction ? handleAction : undefined,
  });

  return (
    <View
      style={[
        styles.container,
        {
          gap: spacing.md,
          paddingVertical: spacing.xxxl,
          paddingHorizontal: spacing.xl,
        },
      ]}>
      <Symbol name={icon} size={40} color={theme.textTertiary} />
      <AppText
        variant="heading"
        align="center"
        numberOfLines={2}
        adjustsFontSizeToFit
        style={titleStyle}>
        {titleText}
      </AppText>
      <AppText
        variant="callout"
        color="secondary"
        align="center"
        numberOfLines={4}
        style={messageStyle}>
        {message}
      </AppText>
      {actionTitle && onAction ? (
        <Pressable
          ref={agent.ref}
          testID={actionTestID}
          onLayout={agent.onLayout}
          accessibilityRole="button"
          accessibilityLabel={actionTitle}
          onPress={handleAction}
          style={({ pressed }) => [
            styles.actionHit,
            { marginTop: spacing.sm, opacity: pressed ? 0.88 : 1 },
          ]}>
          <GlassPlate
            style={[
              styles.actionGlass,
              {
                minHeight: layout.minTapTarget,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.md,
                borderRadius: radii.pill,
                gap: spacing.sm,
              },
            ]}>
            {/* Self-sized pill: never AppText fit — Android truncates/left-packs (e.g. "Add Activity"). */}
            <AppText variant="callout" align="center" numberOfLines={1}>
              {actionTitle}
            </AppText>
          </GlassPlate>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  actionHit: {
    alignSelf: 'center',
  },
  actionGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
