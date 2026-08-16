import { View } from 'react-native';

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
      <View style={{ gap: spacing.sm }}>
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
      </View>
    </View>
  );
}
