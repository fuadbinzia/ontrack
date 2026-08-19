import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import {
    AppText,
    Button,
    Card,
    EmptyState,
    GestureScrollView,
    GlassIconWell,
    Screen,
    Symbol,
} from '@/components/primitives';
import { isMaintenanceDue } from '@/features/vehicles/maintenance-due';
import {
    vehicleDisplayTitle,
    vehicleFitmentLabel,
    type Vehicle,
} from '@/features/vehicles/types';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useResponsive } from '@/hooks/use-responsive';
import { FeatureThemeProvider, useTheme } from '@/hooks/use-theme';
import { useVehicles } from '@/store/vehicles';
import { AgentUiIds } from '@/utils/agent-ui';
import { todayKey } from '@/utils/date';
import { useWarmHrefs } from '@/utils/warm-navigation';

function VehicleRow({ vehicle }: { vehicle: Vehicle }) {
  const { spacing: gap } = useResponsive();
  return (
    <View style={{ marginBottom: gap.md }}>
      <VehicleCard vehicle={vehicle} />
    </View>
  );
}

function renderVehicleItem({ item }: { item: Vehicle }) {
  return <VehicleRow vehicle={item} />;
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const router = useRouter();
  const theme = useTheme();
  const { spacing: gap, s } = useResponsive();
  const title = vehicleDisplayTitle(vehicle);
  const fitment = vehicleFitmentLabel(vehicle);
  const dueCount = vehicle.maintenanceSchedules.filter((schedule) =>
    isMaintenanceDue(schedule, vehicle.odometerMiles, todayKey()),
  ).length;
  const miles =
    vehicle.odometerMiles !== undefined
      ? `${vehicle.odometerMiles.toLocaleString()} mi`
      : 'No mileage yet';

  return (
    <Card
      onPress={() =>
        router.push({ pathname: '/vehicles/[id]', params: { id: vehicle.id } })
      }
      accessibilityLabel={`${title}, ${miles}`}
      testID={AgentUiIds.vehicles.vehicle(vehicle.id)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: gap.md }}>
        <GlassIconWell size={s(48)} borderRadius={s(14)}>
          <Symbol name="vehicles" size={s(24)} color={theme.accentPrimary} />
        </GlassIconWell>
        <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
          <AppText variant="heading" fit numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="caption" color="secondary" fit numberOfLines={1}>
            {fitment || 'Add year, make, and model'}
          </AppText>
          <AppText variant="callout" color={dueCount ? 'accent' : 'secondary'} fit numberOfLines={1}>
            {miles}
            {dueCount ? ` · ${dueCount} due` : ''}
            {vehicle.mode === 'shared' ? ' · Shared' : ''}
          </AppText>
        </View>
        <Symbol name="chevron-right" size={s(18)} color={theme.textTertiary} />
      </View>
    </Card>
  );
}

export default function VehiclesScreen() {
  return (
    <FeatureThemeProvider feature="vehicles">
      <VehiclesScreenContent />
    </FeatureThemeProvider>
  );
}

function VehiclesScreenContent() {
  const router = useRouter();
  const { spacing: gap } = useResponsive();
  const { refreshControl } = usePullToRefresh();
  const vehicles = useVehicles((state) => state.vehicles);
  const sorted = useMemo(
    () =>
      [...vehicles].sort((a, b) =>
        vehicleDisplayTitle(a).localeCompare(vehicleDisplayTitle(b)),
      ),
    [vehicles],
  );
  useWarmHrefs([
    '/vehicles/new',
    ...sorted.slice(0, 4).map(
      (vehicle) =>
        ({ pathname: '/vehicles/[id]', params: { id: vehicle.id } }) as const,
    ),
  ]);

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      <FlashList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderScrollComponent={GestureScrollView}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: gap.md }}
        ListHeaderComponent={
          <View style={[styles.header, { gap: gap.md, marginBottom: gap.lg }]}>
            <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
              <AppText variant="title" fit numberOfLines={1}>
                Vehicles
              </AppText>
              <AppText variant="callout" color="secondary" numberOfLines={2}>
                Maintenance, mileage, expenses, docs, and parts in one place.
              </AppText>
            </View>
            <Button
              onPress={() => router.push('/vehicles/new')}
              accessibilityLabel="Add a vehicle"
              testID={AgentUiIds.vehicles.add}>
              Add
            </Button>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="vehicles"
            title="Add your first vehicle"
            message="Track service schedules, odometer readings, expenses, registration, insurance, and compatible parts."
            actionLabel="Add Vehicle"
            onAction={() => router.push('/vehicles/new')}
          />
        }
        renderItem={renderVehicleItem}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
