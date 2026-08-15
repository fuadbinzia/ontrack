import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, DateField, Input, SectionHeader } from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { usePreferences } from '@/store/preferences';
import type { Vehicle, VehicleMileageLog } from '@/features/vehicles/types';
import { formatDateKey, todayKey } from '@/utils/date';
import { newUuid } from '@/utils/id';
import { asFiniteNonNegative } from '@/utils/parse';

export function VehicleMileagePanel({
  vehicle,
  onChange,
}: {
  vehicle: Vehicle;
  onChange: (next: Vehicle, summary: string, entityId?: string) => void;
}) {
  const { spacing: gap } = useResponsive();
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const [date, setDate] = useState(todayKey());
  const [miles, setMiles] = useState(
    vehicle.odometerMiles !== undefined ? String(vehicle.odometerMiles) : '',
  );
  const [notes, setNotes] = useState('');

  const addLog = () => {
    const value = asFiniteNonNegative(Number(miles));
    if (value === undefined) return;
    const now = new Date().toISOString();
    const log: VehicleMileageLog = {
      id: newUuid(),
      date,
      miles: value,
      notes: notes.trim() || undefined,
      createdAt: now,
    };
    onChange(
      {
        ...vehicle,
        mileageLogs: [log, ...vehicle.mileageLogs],
        odometerMiles: value,
        odometerUpdatedAt: now,
        updatedAt: now,
      },
      `Logged ${value.toLocaleString()} mi`,
      log.id,
    );
    setNotes('');
  };

  return (
    <View style={{ gap: gap.lg }}>
      <SectionHeader title="Mileage history" />
      {vehicle.mileageLogs.length === 0 ? (
        <AppText variant="caption" color="secondary">
          Record odometer readings over time.
        </AppText>
      ) : (
        vehicle.mileageLogs.slice(0, 20).map((log) => (
          <Card key={log.id}>
            <AppText variant="heading" fit numberOfLines={1}>
              {log.miles.toLocaleString()} mi
            </AppText>
            <AppText variant="caption" color="secondary" fit numberOfLines={1}>
              {formatDateKey(log.date, dateDisplayFormat)}
              {log.notes ? ` · ${log.notes}` : ''}
            </AppText>
          </Card>
        ))
      )}
      <DateField label="Date" value={date} onChange={setDate} />
      <Input label="Miles" value={miles} onChangeText={setMiles} keyboardType="number-pad" />
      <Input label="Notes" value={notes} onChangeText={setNotes} />
      <Button onPress={addLog} accessibilityLabel="Add mileage reading">
        Add reading
      </Button>
    </View>
  );
}
