import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import {
    AppText,
    Button,
    Card,
    EmptyState,
    GestureScrollView,
    GlassPlate,
    Screen,
} from '@/components/primitives';
import { radii, spacing } from '@/design-system';
import { ensurePlantSample, plantImageSource } from '@/features/plants/sample';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { FeatureThemeProvider, useTheme } from '@/hooks/use-theme';
import { usePlants } from '@/store/plants';
import type { Plant } from '@/types/models';
import { AgentUiIds } from '@/utils/agent-ui';
import { formatDueLabel, toDateKey, todayKey } from '@/utils/date';
import { deferAfterPageTransition } from '@/utils/defer-after-page-transition';
import { useWarmHrefs } from '@/utils/warm-navigation';

function renderPlantItem({ item }: { item: Plant }) {
  return (
    <View style={styles.row}>
      <PlantCard plant={item} />
    </View>
  );
}

function PlantCard({ plant }: { plant: Plant }) {
  const router = useRouter();
  const dueKey = toDateKey(new Date(plant.nextWateringAt));
  const dueLabel = formatDueLabel(dueKey);

  return (
    <Card
      padded={false}
      testID={AgentUiIds.plants.plant(plant.id)}
      onPress={() => router.push({ pathname: '/plants/[id]', params: { id: plant.id } })}
      accessibilityLabel={`${plant.nickname}, ${plant.identity.commonName}, ${dueLabel}`}>
      <View style={styles.cardRow}>
        <Image
          source={plantImageSource(plant.photoUri)}
          cachePolicy="memory-disk"
          transition={0}
          recyclingKey={plant.id}
          style={styles.photo}
          contentFit="cover"
        />
        <View style={styles.cardBody}>
          <AppText variant="heading" numberOfLines={1}>{plant.nickname}</AppText>
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {plant.identity.commonName} · {plant.identity.identificationSource === 'user-corrected'
              ? 'corrected by you'
              : plant.identity.identificationSource === 'user-confirmed'
                ? 'confirmed by you'
                : `${Math.round(plant.identity.confidence * 100)}% AI match`}
          </AppText>
          <AppText variant="callout" color={dueKey <= todayKey() ? 'accent' : 'secondary'}>{dueLabel}</AppText>
          <AppText variant="caption" color={plant.health.status === 'healthy' ? 'success' : plant.health.status === 'urgent' ? 'danger' : 'secondary'}>
            {plant.health.status === 'healthy' ? 'Looking healthy' : plant.health.status === 'urgent' ? 'Needs attention' : 'Keep watching'}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

/** Primary carousel section for plant care. */
export default function PlantsScreen() {
  return (
    <FeatureThemeProvider feature="plants">
      <PlantsScreenContent />
    </FeatureThemeProvider>
  );
}

function PlantsScreenContent() {
  const router = useRouter();
  const theme = useTheme();
  const { refreshControl } = usePullToRefresh();
  const plants = usePlants((state) => state.plants);
  const sampleVersion = usePlants((state) => state.sampleVersion);

  useEffect(() => {
    return deferAfterPageTransition(() => {
      const state = usePlants.getState();
      const upgraded = ensurePlantSample(
        state.plants,
        state.sampleVersion,
        state.sampleDismissed,
      );
      if (
        upgraded.sampleVersion !== state.sampleVersion
        || upgraded.sampleDismissed !== state.sampleDismissed
        || upgraded.plants.length !== state.plants.length
        || upgraded.plants.some((plant, index) => plant.id !== state.plants[index]?.id)
      ) {
        usePlants.setState({
          plants: upgraded.plants,
          sampleVersion: upgraded.sampleVersion,
          sampleDismissed: upgraded.sampleDismissed,
        });
      }
    });
  }, [plants, sampleVersion]);
  useWarmHrefs([
    '/plants/new',
    ...plants.slice(0, 4).map(
      (plant) => ({ pathname: '/plants/[id]', params: { id: plant.id } }) as const,
    ),
  ]);

  const sortedPlants = useMemo(
    () =>
      plants
        .slice()
        .sort((a, b) => a.nextWateringAt.localeCompare(b.nextWateringAt)),
    [plants],
  );

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      <FlashList
        data={sortedPlants}
        keyExtractor={(item) => item.id}
        renderScrollComponent={GestureScrollView}
        refreshControl={refreshControl}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <AppText variant="title">Plants</AppText>
              <AppText variant="callout" color="secondary">Care plans that learn from your check-ins.</AppText>
            </View>
            <Button
              testID={AgentUiIds.plants.add}
              onPress={() => router.push('/plants/new')}
              accessibilityLabel="Add a plant">
              Add
            </Button>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="plant"
            title="Grow your plant shelf"
            message="Photograph a plant to identify it, assess its health, and build a watering plan for your room."
            actionLabel="Analyze a Plant"
            onAction={() => router.push('/plants/new')}
          />
        }
        ListFooterComponent={
          sortedPlants.length ? (
            <GlassPlate style={styles.note}>
              <AppText variant="caption" color="secondary">
                Watering amounts are starting ranges. Always check the soil and drainage before watering.
              </AppText>
            </GlassPlate>
          ) : null
        }
        renderItem={renderPlantItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flex: 1 },
  listContent: { paddingBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  row: { marginBottom: spacing.md },
  cardRow: { flexDirection: 'row', gap: spacing.md },
  photo: { width: 112, minHeight: 138, borderTopLeftRadius: radii.lg, borderBottomLeftRadius: radii.lg },
  cardBody: { flex: 1, justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.lg, paddingRight: spacing.lg },
  note: {
    width: '100%',
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
});
