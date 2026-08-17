import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { appPrompt, AppText, Button, Screen } from '@/components/primitives';
import { ChipRow } from '@/components/shared';
import { VehicleActivityPanel } from '@/features/vehicles/vehicle-activity-panel';
import { VehicleDocsPanel } from '@/features/vehicles/vehicle-docs-panel';
import { VehicleExpensesPanel } from '@/features/vehicles/vehicle-expenses-panel';
import { VehicleMaintenancePanel } from '@/features/vehicles/vehicle-maintenance-panel';
import { VehicleMileagePanel } from '@/features/vehicles/vehicle-mileage-panel';
import { VehicleOverviewPanel } from '@/features/vehicles/vehicle-overview-panel';
import { VehiclePartsPanel } from '@/features/vehicles/vehicle-parts-panel';
import { VehiclePartsSearchSheet } from '@/features/vehicles/vehicle-parts-search-sheet';
import {
  vehicleDisplayTitle,
  type Vehicle,
  type VehicleActivityEntity,
  type VehiclePart,
} from '@/features/vehicles/types';
import { FeatureThemeProvider } from '@/hooks/use-theme';
import { useResponsive } from '@/hooks/use-responsive';
import { decodeVehicleVin, VehicleServiceError } from '@/services/vehicles';
import { useVehicles } from '@/store/vehicles';
import { asFiniteNonNegative } from '@/utils/parse';
import { newUuid } from '@/utils/id';
import { AgentUiIds } from '@/utils/agent-ui';

type Section =
  | 'overview'
  | 'maintenance'
  | 'mileage'
  | 'expenses'
  | 'parts'
  | 'docs'
  | 'activity';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'maintenance', label: 'Service' },
  { value: 'mileage', label: 'Mileage' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'parts', label: 'Parts' },
  { value: 'docs', label: 'Docs' },
  { value: 'activity', label: 'History' },
];

export default function VehicleDetailScreen() {
  return (
    <FeatureThemeProvider feature="vehicles">
      <VehicleDetailContent />
    </FeatureThemeProvider>
  );
}

function VehicleDetailContent() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { spacing: gap } = useResponsive();
  const vehicle = useVehicles((state) => state.vehicles.find((item) => item.id === id));
  const saveVehicle = useVehicles((state) => state.saveVehicle);
  const enqueueMutation = useVehicles((state) => state.enqueueMutation);
  const [section, setSection] = useState<Section>('overview');
  const [odometerDraft, setOdometerDraft] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string>();
  const [partsOpen, setPartsOpen] = useState(false);

  useEffect(() => {
    if (!vehicle) return;
    setOdometerDraft(
      vehicle.odometerMiles !== undefined ? String(vehicle.odometerMiles) : '',
    );
  }, [vehicle?.id, vehicle?.odometerMiles]);

  const title = useMemo(
    () => (vehicle ? vehicleDisplayTitle(vehicle) : 'Vehicle'),
    [vehicle],
  );

  if (!vehicle) {
    return (
      <Screen>
        <AppText variant="title">Vehicle not found</AppText>
        <Button onPress={() => router.replace('/(tabs)/vehicles')}>Back</Button>
      </Screen>
    );
  }

  const persist = (
    next: Vehicle,
    summary: string,
    entityType: VehicleActivityEntity,
    entityId?: string,
  ) => {
    const withActivity: Vehicle = {
      ...next,
      activity: [
        {
          id: newUuid(),
          actorDisplayName: 'You',
          action: 'update',
          entityType,
          entityId,
          summary,
          createdAt: new Date().toISOString(),
        },
        ...next.activity,
      ].slice(0, 100),
    };
    saveVehicle(withActivity);
    if (withActivity.mode === 'shared') {
      enqueueMutation({
        vehicleId: withActivity.id,
        op: { type: 'upsert_vehicle', vehicle: withActivity },
      });
    }
  };

  const saveOdometer = () => {
    const miles = asFiniteNonNegative(Number(odometerDraft));
    if (miles === undefined) {
      appPrompt.alert('Check the Mileage', 'Use a number 0 or higher.');
      return;
    }
    const now = new Date().toISOString();
    persist(
      {
        ...vehicle,
        odometerMiles: miles,
        odometerUpdatedAt: now,
        mileageLogs: [
          {
            id: newUuid(),
            date: now.slice(0, 10),
            miles,
            createdAt: now,
          },
          ...vehicle.mileageLogs,
        ],
        updatedAt: now,
      },
      `Updated odometer to ${miles.toLocaleString()} mi`,
      'mileage',
    );
  };

  const decodeVin = async () => {
    if (!vehicle.vin) return;
    setDecoding(true);
    setDecodeError(undefined);
    try {
      const result = await decodeVehicleVin(vehicle.vin);
      if (result.errorText) {
        setDecodeError(result.errorText);
        return;
      }
      const now = new Date().toISOString();
      persist(
        {
          ...vehicle,
          year: result.year ?? vehicle.year,
          make: result.make ?? vehicle.make,
          model: result.model ?? vehicle.model,
          trim: result.trim ?? vehicle.trim,
          engine: result.engine ?? vehicle.engine,
          updatedAt: now,
        },
        `Decoded VIN ${vehicle.vin}`,
        'vehicle',
        vehicle.id,
      );
    } catch (caught) {
      setDecodeError(
        caught instanceof VehicleServiceError
          ? caught.message
          : 'VIN decode failed.',
      );
    } finally {
      setDecoding(false);
    }
  };

  const savePart = (part: VehiclePart) => {
    persist(
      {
        ...vehicle,
        parts: [part, ...vehicle.parts],
        updatedAt: new Date().toISOString(),
      },
      `Added part “${part.name}”`,
      'part',
      part.id,
    );
    setPartsOpen(false);
  };

  return (
    <Screen contentStyle={{ gap: gap.lg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: gap.md,
        }}>
        <View style={{ flex: 1, minWidth: 0, gap: gap.xs }}>
          <AppText variant="title" fit numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="caption" color="secondary" fit numberOfLines={1}>
            Vehicle tracker
          </AppText>
        </View>
        <Button
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/vehicles/[id]/settings',
              params: { id: vehicle.id },
            })
          }
          accessibilityLabel="Vehicle settings"
          testID={AgentUiIds.vehicles.settings}>
          Settings
        </Button>
      </View>

      <ChipRow
        options={SECTIONS}
        selected={section}
        onSelect={setSection}
        scrollable
        testIDForOption={AgentUiIds.vehicles.section}
      />

      {section === 'overview' ? (
        <VehicleOverviewPanel
          vehicle={vehicle}
          odometerDraft={odometerDraft}
          onOdometerDraftChange={setOdometerDraft}
          onSaveOdometer={saveOdometer}
          onDecodeVin={() => void decodeVin()}
          onOpenSettings={() =>
            router.push({
              pathname: '/vehicles/[id]/settings',
              params: { id: vehicle.id },
            })
          }
          decoding={decoding}
          decodeError={decodeError}
        />
      ) : null}
      {section === 'maintenance' ? (
        <VehicleMaintenancePanel
          vehicle={vehicle}
          onChange={(next, summary, entityType, entityId) =>
            persist(next, summary, entityType, entityId)
          }
        />
      ) : null}
      {section === 'mileage' ? (
        <VehicleMileagePanel
          vehicle={vehicle}
          onChange={(next, summary, entityId) =>
            persist(next, summary, 'mileage', entityId)
          }
        />
      ) : null}
      {section === 'expenses' ? (
        <VehicleExpensesPanel
          vehicle={vehicle}
          onChange={(next, summary, entityId) =>
            persist(next, summary, 'expense', entityId)
          }
        />
      ) : null}
      {section === 'parts' ? (
        <VehiclePartsPanel
          vehicle={vehicle}
          onChange={(next, summary, entityId) =>
            persist(next, summary, 'part', entityId)
          }
          onOpenSearch={() => setPartsOpen(true)}
        />
      ) : null}
      {section === 'docs' ? (
        <VehicleDocsPanel
          vehicle={vehicle}
          onChange={(next, summary, entityType) =>
            persist(next, summary, entityType)
          }
        />
      ) : null}
      {section === 'activity' ? <VehicleActivityPanel vehicle={vehicle} /> : null}

      <VehiclePartsSearchSheet
        vehicle={vehicle}
        visible={partsOpen}
        onClose={() => setPartsOpen(false)}
        onSavePart={savePart}
      />
    </Screen>
  );
}
