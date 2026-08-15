import { View } from 'react-native';

import { AppText, SectionHeader, SettingsGroup, SettingsRow } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { AgentUiIds } from '@/utils/agent-ui';
import { formatDateKeyMedium, formatWeekday } from '@/utils/date';

import { journalIndexTime, pagePreview } from './model';
import type { JournalPage } from './types';

export function JournalEarlierList({
  pages,
  onOpen,
}: {
  pages: readonly JournalPage[];
  onOpen: (dateKey: string) => void;
}) {
  const { spacing } = useResponsive();
  if (!pages.length) return null;

  return (
    <View style={{ gap: spacing.sm }} testID={AgentUiIds.journal.earlier}>
      <SectionHeader title="Earlier Pages" />
      <SettingsGroup>
        {pages.map((entry) => {
          const time = journalIndexTime(entry);
          return (
            <SettingsRow
              key={entry.id}
              label={`${formatWeekday(entry.dateKey)} · ${formatDateKeyMedium(entry.dateKey)}`}
              detail={pagePreview(entry)}
              trailing={
                time ? (
                  <AppText variant="caption" color="tertiary">
                    {time}
                  </AppText>
                ) : null
              }
              testID={AgentUiIds.journal.earlierPage(entry.dateKey)}
              onPress={() => onOpen(entry.dateKey)}
            />
          );
        })}
      </SettingsGroup>
    </View>
  );
}
