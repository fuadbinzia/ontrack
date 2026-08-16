import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, GlassPlate, Input } from '@/components/primitives';
import { findCategory } from '@/constants/categories';
import { radii, spacing } from '@/design-system';
import { CalendarDetailSheet } from '@/features/daily-tracking/calendar-detail-sheet';
import { useDismissCalendarDetail } from '@/features/daily-tracking/dismiss-calendar-detail';
import { plantImageSource } from '@/features/plants/sample';
import { useResponsive } from '@/hooks/use-responsive';
import { logPlantWatering, undoPlantWatering } from '@/services/plants/schedule';
import { usePlants } from '@/store/plants';
import { useSchedule } from '@/store/schedule';
import { activityTimingLabel } from '@/utils/activity-time';
import { AgentUiIds } from '@/utils/agent-ui';
import {
  DAY_MS,
  formatDueLabel,
  formatMinutes,
  fromDateKey,
  toDateKey,
  todayKey,
} from '@/utils/date';
import { formatCount } from '@/utils/grammar';

function wateringCountdownLabel(dueKey: string) {
  const days = Math.round(
    (fromDateKey(dueKey).getTime() - fromDateKey(todayKey()).getTime()) / DAY_MS,
  );
  if (days < 0) return `Overdue by ${formatCount(Math.abs(days), 'day')}`;
  if (days === 0) return 'Water check due today';
  if (days === 1) return 'Next watering in 1 day';
  return `Next watering in ${formatCount(days, 'day')}`;
}

export default function PlantCalendarDetailScreen() {
  const router = useRouter();
  const { s } = useResponsive();
  const { id: activityId } = useLocalSearchParams<{ id: string }>();
  const activity = useSchedule((state) =>
    state.activities.find((candidate) => candidate.id === activityId),
  );
  const categories = useSchedule((state) => state.categories);
  const plant = usePlants((state) =>
    state.plants.find((candidate) => candidate.id === activity?.plantId),
  );
  const [amount, setAmount] = useState('');
  const close = useDismissCalendarDetail(!activity || !plant);

  if (!activity || !plant) return null;

  const category = findCategory(categories, activity.categoryId);
  const dueKey = toDateKey(new Date(plant.nextWateringAt));
  const due = formatDueLabel(dueKey, { overduePrefix: 'Overdue since' });
  const latestLog = plant.wateringLogs.at(-1);
  const watering = activity.careKind === 'watering';

  return (
    <CalendarDetailSheet
      kind="plant"
      eyebrow={category.name}
      title={plant.nickname}
      subtitle={`${activityTimingLabel(activity)} · ${plant.identity.commonName}`}
      subtitleIcon="clock"
      onClose={close}>
      <Image
        source={plantImageSource(plant.photoUri)}
        style={[styles.hero, { height: s(220) }]}
        contentFit="cover"
        transition={0}
        cachePolicy="memory-disk"
      />

      {watering ? (
        <Card style={styles.careCard}>
          <View style={styles.scheduleHeading}>
            <AppText variant="overline" color="tertiary">
              Watering schedule
            </AppText>
            <AppText variant="caption" color="secondary">
              Every {formatCount(plant.carePlan.watering.intervalDays, 'day')}
            </AppText>
          </View>
          <GlassPlate airy style={styles.scheduleBadge}>
            <AppText variant="heading" color="accent">
              {wateringCountdownLabel(dueKey)}
            </AppText>
            <AppText variant="caption" color="secondary">
              {due} · reminder at {formatMinutes(plant.reminderMinutes)}
            </AppText>
          </GlassPlate>
          <AppText color="secondary">{plant.carePlan.watering.soilCheck}</AppText>
          <AppText variant="callout">
            Start with {Math.round(plant.carePlan.watering.minMl)}–
            {Math.round(plant.carePlan.watering.maxMl)} mL only when the soil check says it is needed.
          </AppText>
          <Input
            label="Amount Used (mL, Optional)"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            testID={AgentUiIds.plants.detail.amount}
          />
          <Button
            testID={AgentUiIds.plants.detail.logWatering}
            onPress={() => {
              const parsed = Number(amount);
              void logPlantWatering(
                plant.id,
                amount.trim() && Number.isFinite(parsed) && parsed >= 0
                  ? parsed
                  : undefined,
              );
            }}>
            Log Watering Now
          </Button>
          {latestLog?.activityId ? (
            <Button
              variant="secondary"
              testID={AgentUiIds.plants.detail.undoWatering}
              onPress={() => void undoPlantWatering(latestLog.activityId!)}>
              Undo Last Watering
            </Button>
          ) : null}
        </Card>
      ) : (
        <Card style={styles.careCard}>
          <AppText variant="heading">{activity.title}</AppText>
          {activity.summary ? <AppText color="secondary">{activity.summary}</AppText> : null}
          {activity.notes ? <AppText>{activity.notes}</AppText> : null}
          <AppText variant="caption" color="tertiary">
            {plant.health.summary}
          </AppText>
        </Card>
      )}

      <Button
        variant="secondary"
        testID={AgentUiIds.plants.calendarSheet.openDetails}
        onPress={() =>
          router.push({ pathname: '/plants/[id]', params: { id: plant.id } })
        }>
        Open Plant Details
      </Button>
    </CalendarDetailSheet>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    borderRadius: radii.lg,
  },
  careCard: { gap: spacing.md },
  scheduleHeading: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  scheduleBadge: {
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
