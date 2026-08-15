import { useState } from 'react';
import { View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  DateField,
  Input,
  SectionHeader,
} from '@/components/primitives';
import { useResponsive } from '@/hooks/use-responsive';
import { usePreferences } from '@/store/preferences';
import type {
  Vehicle,
  VehicleMaintenanceLog,
  VehicleMaintenanceSchedule,
} from '@/features/vehicles/types';
import { isMaintenanceDue, nextDueDate, nextDueMiles } from '@/features/vehicles/maintenance-due';
import { formatMoney } from '@/features/travel/expenses/format-money';
import { confirmDestructiveAction } from '@/utils/confirm-destructive';
import { formatDateKey, todayKey } from '@/utils/date';
import { newUuid } from '@/utils/id';
import { asFiniteNonNegative, asPositiveNumber } from '@/utils/parse';

export function VehicleMaintenancePanel({
  vehicle,
  onChange,
}: {
  vehicle: Vehicle;
  onChange: (next: Vehicle, summary: string, entityType: 'maintenance_schedule' | 'maintenance_log', entityId?: string) => void;
}) {
  const { spacing: gap } = useResponsive();
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const [title, setTitle] = useState('');
  const [intervalMiles, setIntervalMiles] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('');
  const [logTitle, setLogTitle] = useState('');
  const [logDate, setLogDate] = useState(todayKey());
  const [logMiles, setLogMiles] = useState(
    vehicle.odometerMiles !== undefined ? String(vehicle.odometerMiles) : '',
  );
  const [logCost, setLogCost] = useState('');

  const addSchedule = () => {
    const name = title.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const schedule: VehicleMaintenanceSchedule = {
      id: newUuid(),
      title: name,
      intervalMiles: asPositiveNumber(Number(intervalMiles)),
      intervalMonths: asPositiveNumber(Number(intervalMonths)),
      createdAt: now,
      updatedAt: now,
    };
    onChange(
      {
        ...vehicle,
        maintenanceSchedules: [...vehicle.maintenanceSchedules, schedule],
        updatedAt: now,
      },
      `Added schedule “${name}”`,
      'maintenance_schedule',
      schedule.id,
    );
    setTitle('');
    setIntervalMiles('');
    setIntervalMonths('');
  };

  const removeSchedule = (schedule: VehicleMaintenanceSchedule) => {
    confirmDestructiveAction({
      title: 'Remove schedule?',
      message: `Remove “${schedule.title}” from this vehicle?`,
      actionLabel: 'Remove',
      onConfirm: () => {
        onChange(
          {
            ...vehicle,
            maintenanceSchedules: vehicle.maintenanceSchedules.filter(
              (item) => item.id !== schedule.id,
            ),
            updatedAt: new Date().toISOString(),
          },
          `Removed schedule “${schedule.title}”`,
          'maintenance_schedule',
          schedule.id,
        );
      },
    });
  };

  const addLog = () => {
    const name = logTitle.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const miles = asFiniteNonNegative(Number(logMiles));
    const log: VehicleMaintenanceLog = {
      id: newUuid(),
      title: name,
      date: logDate,
      miles,
      cost: asPositiveNumber(Number(logCost)),
      currency: vehicle.baseCurrency,
      createdAt: now,
      updatedAt: now,
    };
    let next = {
      ...vehicle,
      maintenanceLogs: [log, ...vehicle.maintenanceLogs],
      updatedAt: now,
    };
    if (miles !== undefined) {
      next = {
        ...next,
        odometerMiles: miles,
        odometerUpdatedAt: now,
      };
    }
    onChange(next, `Logged service “${name}”`, 'maintenance_log', log.id);
    setLogTitle('');
    setLogCost('');
  };

  return (
    <View style={{ gap: gap.lg }}>
      <View style={{ gap: gap.md }}>
        <SectionHeader title="Schedules" />
        {vehicle.maintenanceSchedules.length === 0 ? (
          <AppText variant="caption" color="secondary">
            Add oil changes, inspections, tire rotations, and more.
          </AppText>
        ) : (
          vehicle.maintenanceSchedules.map((schedule) => {
            const due = isMaintenanceDue(schedule, vehicle.odometerMiles, todayKey());
            const dueMiles = nextDueMiles(schedule, vehicle.odometerMiles);
            const dueDate = nextDueDate(schedule);
            return (
              <Card key={schedule.id} onPress={() => removeSchedule(schedule)}>
                <AppText variant="heading" fit numberOfLines={1}>
                  {schedule.title}
                </AppText>
                <AppText variant="caption" color={due ? 'danger' : 'secondary'} numberOfLines={2}>
                  {due ? 'Due now · ' : ''}
                  {dueMiles !== undefined ? `Next ~${dueMiles.toLocaleString()} mi` : ''}
                  {dueMiles !== undefined && dueDate ? ' · ' : ''}
                  {dueDate ? `Next ${dueDate}` : ''}
                  {!dueMiles && !dueDate
                    ? [
                        schedule.intervalMiles
                          ? `Every ${schedule.intervalMiles.toLocaleString()} mi`
                          : null,
                        schedule.intervalMonths
                          ? `Every ${schedule.intervalMonths} mo`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'No interval set'
                    : ''}
                </AppText>
              </Card>
            );
          })
        )}
        <Input label="Schedule title" value={title} onChangeText={setTitle} placeholder="Oil change" />
        <Input
          label="Every (miles)"
          value={intervalMiles}
          onChangeText={setIntervalMiles}
          keyboardType="number-pad"
        />
        <Input
          label="Every (months)"
          value={intervalMonths}
          onChangeText={setIntervalMonths}
          keyboardType="number-pad"
        />
        <Button onPress={addSchedule} accessibilityLabel="Add maintenance schedule">
          Add schedule
        </Button>
      </View>

      <View style={{ gap: gap.md }}>
        <SectionHeader title="Service log" />
        {vehicle.maintenanceLogs.slice(0, 8).map((log) => (
          <Card key={log.id}>
            <AppText variant="heading" fit numberOfLines={1}>
              {log.title}
            </AppText>
            <AppText variant="caption" color="secondary" fit numberOfLines={1}>
              {formatDateKey(log.date, dateDisplayFormat)}
              {log.miles !== undefined ? ` · ${log.miles.toLocaleString()} mi` : ''}
              {log.cost !== undefined
                ? ` · ${formatMoney(log.cost, log.currency ?? vehicle.baseCurrency)}`
                : ''}
            </AppText>
          </Card>
        ))}
        <Input label="Service title" value={logTitle} onChangeText={setLogTitle} />
        <DateField label="Date" value={logDate} onChange={setLogDate} />
        <Input
          label="Miles"
          value={logMiles}
          onChangeText={setLogMiles}
          keyboardType="number-pad"
        />
        <Input
          label="Cost"
          value={logCost}
          onChangeText={setLogCost}
          keyboardType="decimal-pad"
        />
        <Button onPress={addLog} accessibilityLabel="Add maintenance log">
          Log service
        </Button>
      </View>
    </View>
  );
}
