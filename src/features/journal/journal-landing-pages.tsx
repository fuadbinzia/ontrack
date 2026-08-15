import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  AppText,
  Card,
  GlassTonePill,
  SectionHeader,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { formatDateKeyMedium, formatWeekday } from '@/utils/date';

import { journalIndexTime, pagePreview } from './model';
import type { JournalPage } from './types';

export function JournalLandingPages({
  pages,
  today,
  onOpen,
}: {
  pages: readonly JournalPage[];
  today: string;
  onOpen: (dateKey: string) => void;
}) {
  const theme = useTheme();
  const { spacing, s } = useResponsive();
  const focusEntrance = useSharedValue(1);
  const focusEntranceStyle = useAnimatedStyle(() => ({
    opacity: focusEntrance.value,
    transform: [{ translateY: (1 - focusEntrance.value) * 12 }],
  }));
  useFocusEffect(
    useCallback(() => {
      cancelAnimation(focusEntrance);
      focusEntrance.value = 0;
      focusEntrance.value = withTiming(1, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      });
      return () => cancelAnimation(focusEntrance);
    }, [focusEntrance]),
  );

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ height: Math.max(10, s(12)) }} />
      <AgentTestId testID={AgentUiIds.journal.pages}>
        <SectionHeader
          flush
          title="Your Pages"
          detail={pages.length === 1 ? '1 Page' : `${pages.length} Pages`}
        />
      </AgentTestId>
      <Animated.View style={[{ gap: spacing.sm }, focusEntranceStyle]}>
        {pages.map((entry) => {
          const isToday = entry.dateKey === today;
          const time = journalIndexTime(entry);
          const dateLabel = formatDateKeyMedium(entry.dateKey);
          const label = isToday
            ? dateLabel
            : `${formatWeekday(entry.dateKey)} · ${dateLabel}`;
          const a11yLabel = isToday ? `Today · ${dateLabel}` : label;
          return (
            <Card
              key={entry.id}
              airy
              accessibilityLabel={a11yLabel}
              testID={
                isToday
                  ? AgentUiIds.journal.openToday
                  : AgentUiIds.journal.page(entry.dateKey)
              }
              onPress={() => onOpen(entry.dateKey)}>
              <View style={{ gap: spacing.xs }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                  }}>
                  <AppText
                    variant="callout"
                    bold
                    fit
                    titleCase
                    style={{ flex: 1, minWidth: 0 }}>
                    {label}
                  </AppText>
                  {isToday ? (
                    <GlassTonePill
                      label="Today"
                      toneColor={theme.accentPrimary}
                      showDot={false}
                    />
                  ) : time ? (
                    <AppText variant="caption" color="tertiary" fit>
                      {time}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="body" color="secondary" numberOfLines={2}>
                  {pagePreview(entry)}
                </AppText>
                {isToday && time ? (
                  <AppText variant="caption" color="tertiary">
                    {time}
                  </AppText>
                ) : null}
              </View>
            </Card>
          );
        })}
      </Animated.View>
    </View>
  );
}
