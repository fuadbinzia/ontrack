import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
    appPrompt,
    AppText,
    Button,
    Card,
    GlassMetaChip,
    GlassPlate,
    Input,
    Screen,
    SectionHeader,
} from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import { plantImageSource } from '@/features/plants/sample';
import { FeatureThemeProvider, useTheme } from '@/hooks/use-theme';
import {
    addPruningActivity,
    deletePlant,
    logPlantWatering,
    undoPlantWatering,
} from '@/services/plants/schedule';
import { usePlants } from '@/store/plants';
import { AgentUiIds } from '@/utils/agent-ui';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { formatCount } from '@/utils/grammar';
import { DAY_MS, formatDueLabel, formatMinutes, fromDateKey, toDateKey, todayKey } from '@/utils/date';
import { openHttpsUrl } from '@/utils/safe-url';

function wateringCountdownLabel(dueKey: string) {
  const days = Math.round((fromDateKey(dueKey).getTime() - fromDateKey(todayKey()).getTime()) / DAY_MS);
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Water check due today';
  if (days === 1) return 'Next watering in 1 day';
  return `Next watering in ${formatCount(days, 'day')}`;
}

export default function PlantDetailScreen() {
  return (
    <FeatureThemeProvider feature="plants">
      <PlantDetailContent />
    </FeatureThemeProvider>
  );
}

function PlantDetailContent() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plant = usePlants((state) => state.plants.find((item) => item.id === id));
  const [amount, setAmount] = useState('');

  if (!plant) {
    return <Screen><AppText variant="title">Plant Not Found</AppText></Screen>;
  }

  const dueKey = toDateKey(new Date(plant.nextWateringAt));
  const due = formatDueLabel(dueKey, { overduePrefix: 'Overdue since' });
  const latestLog = plant.wateringLogs.at(-1);
  const soil = plant.carePlan.soil;

  const remove = () =>
    confirmDestructiveAction({
      title: 'Delete Plant',
      message: `Remove ${plant.nickname}, its care tasks, and locally saved photos?`,
      onConfirm: () => void deletePlant(plant.id).then(() => router.replace('/plants')),
    });

  return (
    <Screen contentStyle={styles.content}>
      <Image source={plantImageSource(plant.photoUri)} style={styles.hero} contentFit="cover" transition={0} cachePolicy="memory-disk" />
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <AppText variant="title">{plant.nickname}</AppText>
          <AppText variant="callout" color="secondary">{plant.identity.commonName}</AppText>
          <AppText variant="caption" color="tertiary" style={styles.italic}>{plant.identity.scientificName}</AppText>
        </View>
        <Button
          variant="secondary"
          testID={AgentUiIds.plants.detail.edit}
          onPress={() => router.push({ pathname: '/plants/[id]/edit', params: { id: plant.id } })}>
          Edit
        </Button>
      </View>

      <SectionHeader
        title="Watering schedule"
        detail={`Every ${formatCount(plant.carePlan.watering.intervalDays, 'day')}`}
      />
      <Card style={styles.careCard}>
        <GlassPlate airy style={styles.scheduleBadge}>
          <AppText variant="heading" color="accent">{wateringCountdownLabel(dueKey)}</AppText>
          <AppText variant="caption" color="secondary">{due} · reminder at {formatMinutes(plant.reminderMinutes)}</AppText>
        </GlassPlate>
        <AppText color="secondary">{plant.carePlan.watering.soilCheck}</AppText>
        <AppText variant="callout">
          Start with {Math.round(plant.carePlan.watering.minMl)}–{Math.round(plant.carePlan.watering.maxMl)} mL only when the soil check says it is needed.
        </AppText>
        <AppText variant="caption" color="tertiary">{plant.carePlan.watering.notes}</AppText>
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
        <Button
          variant="secondary"
          testID={AgentUiIds.plants.detail.adjustSchedule}
          onPress={() => router.push({ pathname: '/plants/[id]/edit', params: { id: plant.id } })}>
          Adjust schedule
        </Button>
        {latestLog?.activityId ? (
          <Button
            variant="ghost"
            testID={AgentUiIds.plants.detail.undoWatering}
            onPress={() => void undoPlantWatering(latestLog.activityId!)}>
            Undo Last Watering
          </Button>
        ) : null}
      </Card>

      <SectionHeader title="Health check-in" detail={`${Math.round(plant.health.confidence * 100)}% confidence`} />
      <Card style={styles.careCard}>
        <AppText variant="heading" color={plant.health.status === 'healthy' ? 'success' : plant.health.status === 'urgent' ? 'danger' : 'primary'}>
          {plant.health.status === 'healthy' ? 'Looking healthy' : plant.health.status === 'urgent' ? 'Needs prompt attention' : 'Keep watching'}
        </AppText>
        <AppText>{plant.health.summary}</AppText>
        {plant.health.visibleSigns.map((item) => <AppText key={item} color="secondary">Observed: {item}</AppText>)}
        {plant.health.possibleCauses.map((item) => <AppText key={item} variant="caption" color="tertiary">Possible, not diagnosed: {item}</AppText>)}
        {plant.health.actions.length ? (
          <View style={styles.actionsBlock}>
            <AppText variant="overline" color="tertiary">Recommendations</AppText>
            {plant.health.actions.map((item) => (
              <AppText key={item} color="secondary">• {item}</AppText>
            ))}
          </View>
        ) : null}
        <Button
          testID={AgentUiIds.plants.detail.checkIn}
          onPress={() => router.push({ pathname: '/plants/[id]/check-in', params: { id: plant.id } })}
          icon="camera">
          Take photo for health status
        </Button>
      </Card>

      <SectionHeader title="Soil" detail={`pH ${soil.phMin.toFixed(1)}–${soil.phMax.toFixed(1)}`} />
      <Card style={styles.careCard}>
        <AppText variant="heading">{soil.soilType}</AppText>
        <GlassPlate airy style={styles.soilMetrics}>
          <View style={[styles.soilMetricsInner, styles.glassContent]}>
            <View style={styles.soilMetric}>
              <AppText variant="overline" color="tertiary">Target pH</AppText>
              <AppText variant="heading" color="accent">{soil.phMin.toFixed(1)}–{soil.phMax.toFixed(1)}</AppText>
            </View>
            <View style={styles.soilMetric}>
              <AppText variant="overline" color="tertiary">Mix style</AppText>
              <AppText variant="callout">{soil.soilType}</AppText>
            </View>
          </View>
        </GlassPlate>
        <AppText>{soil.mixNotes}</AppText>
        <AppText color="secondary">{soil.drainageNotes}</AppText>
        {soil.amendments.length ? (
          <View style={styles.chipRow}>
            {soil.amendments.map((item) => (
              <GlassMetaChip key={item}>
                <AppText variant="caption" color="accent">
                  {item}
                </AppText>
              </GlassMetaChip>
            ))}
          </View>
        ) : null}
      </Card>

      <SectionHeader title="Placement" />
      <Card style={styles.careCard}>
        <AppText variant="heading">{plant.carePlan.placement.location}</AppText>
        <AppText color="secondary">{plant.carePlan.placement.windowDistance}</AppText>
        <AppText>{plant.carePlan.placement.light}</AppText>
        {plant.carePlan.placement.avoid.map((item) => <AppText key={item} variant="caption" color="secondary">Avoid: {item}</AppText>)}
      </Card>

      <SectionHeader title="Pruning" detail={plant.carePlan.pruning.urgency.replace('-', ' ')} />
      <Card style={styles.careCard}>
        <AppText>{plant.carePlan.pruning.reason}</AppText>
        {plant.carePlan.pruning.steps.map((item) => <AppText key={item} color="secondary">• {item}</AppText>)}
        {plant.carePlan.pruning.urgency !== 'not-needed' ? <Button variant="secondary" onPress={() => { addPruningActivity(plant.id); appPrompt.alert('Added to Today', `“Prune ${plant.nickname}” is now on your schedule.`); }}>Add Pruning Task</Button> : null}
      </Card>

      <SectionHeader
        title="History"
        detail={`${formatCount(plant.wateringLogs.length, 'watering')} · ${formatCount(plant.checkIns.length, 'check-in')}`}
      />
      {plant.checkIns.slice().reverse().map((checkIn) => (
        <Card key={checkIn.id} style={styles.historyRow}>
          <Image source={plantImageSource(checkIn.photoUri)} style={styles.historyPhoto} contentFit="cover" />
          <View style={styles.flex}><AppText variant="callout">{new Date(checkIn.createdAt).toLocaleDateString()}</AppText><AppText variant="caption" color="secondary">{checkIn.assessment.summary}</AppText></View>
        </Card>
      ))}
      {plant.wateringLogs.slice().reverse().slice(0, 5).map((log) => <AppText key={log.id} variant="caption" color="secondary">Watered {new Date(log.wateredAt).toLocaleString()}{log.amountMl ? ` · ${log.amountMl} mL` : ''}</AppText>)}

      <SectionHeader title="Care Sources" />
      {plant.carePlan.sources.map((source) => (
        <AppText
          key={source.url}
          color="accent"
          onPress={() => void openHttpsUrl(source.url)}>
          {source.title}
        </AppText>
      ))}
      <AppText variant="caption" color="tertiary">{plant.carePlan.disclaimer}</AppText>
      <Button
        variant="danger"
        testID={AgentUiIds.plants.detail.delete}
        onPress={remove}>
        Delete Plant
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  hero: { width: '100%', aspectRatio: 4 / 3, borderRadius: radii.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  italic: { fontStyle: 'italic' },
  careCard: { gap: spacing.sm },
  glassContent: { zIndex: 1 },
  scheduleBadge: { borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
  actionsBlock: { gap: spacing.xs, marginTop: spacing.xs },
  soilMetrics: { borderRadius: radii.md, overflow: 'hidden' },
  soilMetricsInner: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, zIndex: 1 },
  soilMetric: { flex: 1, gap: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  historyPhoto: { width: 64, height: 64, borderRadius: radii.sm },
});
