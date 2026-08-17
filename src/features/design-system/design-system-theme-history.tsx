import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AppText, Card, CollapsibleSection, GlassPlate } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useThemeOverrides } from '@/store/theme-overrides';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';

const VISIBLE_HISTORY_CARDS = 3;

function formatHistoryWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function DesignSystemThemeHistory() {
  const { spacing, s } = useResponsive();
  const history = useThemeOverrides((state) => state.history);
  const clearHistory = useThemeOverrides((state) => state.clearHistory);
  const [cardHeight, setCardHeight] = useState(0);

  const estimatedCard = Math.max(s(88), 72);
  const gap = spacing.sm;
  const measuredCard = cardHeight > 0 ? cardHeight : estimatedCard;
  const listMaxHeight =
    measuredCard * VISIBLE_HISTORY_CARDS + gap * (VISIBLE_HISTORY_CARDS - 1);

  const clearHistoryAction = () =>
    confirmDestructiveAction({
      title: 'Clear change history?',
      message: 'Theme colors stay as they are. Only the log is removed.',
      actionLabel: 'Clear History',
      onConfirm: clearHistory,
    });

  return (
    <CollapsibleSection
      title="Change history"
      defaultExpanded
      testID={AgentUiIds.designSystem.historySection}
      actionLabel={history.length > 0 ? 'Clear' : undefined}
      actionTestID={history.length > 0 ? AgentUiIds.designSystem.clearHistory : undefined}
      onAction={history.length > 0 ? clearHistoryAction : undefined}>
      <Card airy style={{ gap: spacing.md }}>
        <AppText variant="caption" color="secondary">
          What changed, when, and who edited colors or fonts on this device.
        </AppText>

        {history.length === 0 ? (
          <AppText variant="callout" color="tertiary">
            No theme edits yet.
          </AppText>
        ) : (
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            // Nested in Screen's ScrollView: use fixed height (not maxHeight) so the
            // list actually clips to ~3 cards instead of expanding with content.
            style={
              history.length > VISIBLE_HISTORY_CARDS ? { height: listMaxHeight } : undefined
            }
            contentContainerStyle={{ gap }}>
            {history.map((entry, index) => (
              <View
                key={entry.id}
                onLayout={
                  index === 0
                    ? (event) => {
                        const next = Math.round(event.nativeEvent.layout.height);
                        if (next > 0 && next !== cardHeight) setCardHeight(next);
                      }
                    : undefined
                }>
                <AgentTestId
                  testID={AgentUiIds.designSystem.historyEntry(entry.id)}
                  label={entry.summary}>
                  <GlassPlate
                    mist
                    style={{
                      gap: spacing.xs,
                      padding: spacing.md,
                      borderRadius: s(14),
                    }}>
                    <AppText variant="callout" bold>
                      {entry.summary}
                    </AppText>
                    {entry.from || entry.to ? (
                      <AppText variant="caption" color="tertiary" fit>
                        {entry.from ?? 'default'} → {entry.to ?? 'default'}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" color="secondary" fit>
                      {formatHistoryWhen(entry.at)} · {entry.by}
                    </AppText>
                  </GlassPlate>
                </AgentTestId>
              </View>
            ))}
          </ScrollView>
        )}
      </Card>
    </CollapsibleSection>
  );
}
