import { useMemo } from 'react';
import { View } from 'react-native';

import { useWarmHrefs } from '@/utils/warm-navigation';

import { Presence, Screen, ScreenHeader } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { useAddons } from '@/store/addons';
import { useFinance } from '@/store/finance';
import { useMealPlan } from '@/store/food-meal-plan';
import { useHealth } from '@/store/health';
import { useOverviewAffinity } from '@/store/overview-affinity';
import { useOverviewAttention } from '@/store/overview-attention';
import { usePlants } from '@/store/plants';
import { useSchedule } from '@/store/schedule';
import { useChecklists } from '@/store/todos';
import { useTravel } from '@/store/travel';
import { useUI } from '@/store/ui';
import { useVehicles } from '@/store/vehicles';
import { useVisionBoard } from '@/store/vision-board';
import { nowMinutes, todayKey } from '@/utils/date';
import { AgentTestId, AgentUiIds } from '@/utils/agent-ui';

import { OverviewHero } from './overview-hero';
import { buildOverviewSummary } from './overview-model';
import { OverviewSummaryRow } from './overview-summary-row';

export function OverviewScreen() {
  const { spacing } = useResponsive();
  const enabledAddons = useAddons((state) => state.enabled);
  const activities = useSchedule((state) => state.activities);
  const categories = useSchedule((state) => state.categories);
  const eventDetails = useSchedule((state) => state.eventDetails);
  const eventFollows = useSchedule((state) => state.eventFollows);
  const lists = useChecklists((state) => state.lists);
  const tasks = useChecklists((state) => state.tasks);
  const plans = useTravel((state) => state.plans);
  const bills = useFinance((state) => state.bills);
  const plants = usePlants((state) => state.plants);
  const healthSummaries = useHealth((state) => state.dailySummaries);
  const moodEntries = useHealth((state) => state.moodEntries);
  const vehicles = useVehicles((state) => state.vehicles);
  const mealEntries = useMealPlan((state) => state.entries);
  const visionCategories = useVisionBoard((state) => state.categories);
  const visionItems = useVisionBoard((state) => state.items);
  const acknowledgedAttentionKeys = useOverviewAttention(
    (state) => state.acknowledgedKeys,
  );
  const acknowledgeAttention = useOverviewAttention(
    (state) => state.acknowledge,
  );
  const affinities = useOverviewAffinity((state) => state.byRoute);
  const setSelectedDate = useUI((state) => state.setSelectedDate);

  const summary = useMemo(
    () =>
      buildOverviewSummary({
        today: todayKey(),
        currentMinutes: nowMinutes(),
        activities,
        categories,
        eventDetails,
        eventFollows,
        listsCount: lists.length,
        openTaskCount: tasks.filter((task) => !task.completed).length,
        plans,
        bills,
        plants,
        healthSummaries,
        moodEntryCount: moodEntries.length,
        vehicles,
        mealEntries,
        visionCategoryCount: visionCategories.length,
        visionItems,
        acknowledgedAttentionKeys,
        enabledAddons,
        setSelectedDate,
        affinities,
      }),
    [
      affinities,
      acknowledgedAttentionKeys,
      activities,
      bills,
      categories,
      enabledAddons,
      eventDetails,
      eventFollows,
      healthSummaries,
      lists.length,
      mealEntries,
      moodEntries.length,
      plans,
      plants,
      setSelectedDate,
      tasks,
      vehicles,
      visionCategories.length,
      visionItems,
    ],
  );

  useWarmHrefs(summary.rows.map((row) => row.href));

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AgentTestId testID={AgentUiIds.overview.screen} label="Overview screen">
        <ScreenHeader eyebrow={summary.dateLabel} title="Overview" />
      </AgentTestId>

      <OverviewHero
        eventExcitement={summary.eventExcitement}
        eventArtwork={summary.eventArtwork}
        attentionCount={summary.attentionCount}
        attentionItems={summary.attentionItems}
        onAcknowledge={acknowledgeAttention}
      />

      <AgentTestId testID={AgentUiIds.overview.section} label="Across onTrack">
        <View style={{ gap: spacing.sm }}>
          {summary.rows.map((row) => (
            <Presence key={row.routeName} enter={false}>
              <OverviewSummaryRow row={row} />
            </Presence>
          ))}
        </View>
      </AgentTestId>
    </Screen>
  );
}
