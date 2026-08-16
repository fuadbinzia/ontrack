import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  GlassIconWell,
  GlassPlate,
  Symbol,
} from '@/components/primitives';
import { radii, type AppIconName } from '@/design-system';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, useAgentUiTarget } from '@/utils/agent-ui';
import { haptics } from '@/utils/haptics';

import type { Activity } from '@/types/models';

import {
  allDayEventCaption,
  type AllDayCaption,
} from './calendar-day-events';

export type { AllDayCaption };

interface AllDayBannerProps {
  title: string;
  caption: AllDayCaption;
  testID: string;
  icon?: AppIconName;
  iconNode?: ReactNode;
  onPress?: () => void;
}

/**
 * Google-style all-day rail — static chrome above the timed timeline.
 * Holidays are display-only; user all-day events may open details.
 */
export function AllDayBanner({
  title,
  caption,
  testID,
  icon = 'calendar',
  iconNode,
  onPress,
}: AllDayBannerProps) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const label = `${title}, ${caption}`;
  const handlePress = onPress
    ? () => {
        haptics.select();
        onPress();
      }
    : undefined;
  const agent = useAgentUiTarget(testID, {
    label,
    onPress: handlePress,
  });

  const plate = (
    <GlassPlate
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      style={[
        styles.plate,
        {
          minHeight: s(52),
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radii.lg,
          gap: spacing.md,
        },
      ]}>
      <View
        style={[
          styles.ribbon,
          {
            backgroundColor: theme.accentPrimary,
            borderTopLeftRadius: radii.lg,
            borderBottomLeftRadius: radii.lg,
          },
        ]}
      />
      <GlassIconWell size={s(36)} borderRadius={s(12)}>
        {iconNode ?? (
          <Symbol
            name={icon}
            size="sm"
            color={theme.accentPrimary}
          />
        )}
      </GlassIconWell>
      <View style={styles.copy}>
        <AppText variant="bodyMedium" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="secondary" titleCase numberOfLines={1}>
          {caption}
        </AppText>
      </View>
    </GlassPlate>
  );

  if (!onPress) {
    return (
      <AgentTestId testID={testID} label={label}>
        {plate}
      </AgentTestId>
    );
  }

  return (
    <Pressable
      ref={agent.ref}
      testID={testID}
      onLayout={agent.onLayout}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={handlePress}
      style={({ pressed }) => (pressed ? styles.pressed : null)}>
      {plate}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plate: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  ribbon: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.78,
  },
});

export function AllDayActivityBanner({
  activity,
  testID,
  onPress,
}: {
  activity: Activity;
  testID: string;
  onPress: () => void;
}) {
  const caption = allDayEventCaption(activity);
  return (
    <AllDayBanner
      title={activity.title}
      caption={caption}
      icon={caption === 'Birthday' ? 'important' : 'calendar'}
      testID={testID}
      onPress={onPress}
    />
  );
}
