import { StyleSheet, View } from 'react-native';

import { AppText, DateField, TimeField } from '@/components/primitives';
import type { FlightTripType } from '@/features/travel/flight-roundtrip-draft';
import { travelOverlineStyle } from '@/features/travel/travel-chrome';
import {
  itinerarySheetChrome,
  itinerarySheetFieldProps,
} from '@/features/travel/travel-itinerary-sheet-chrome';
import type { TravelItemKind } from '@/features/travel/types';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

type TravelItineraryFormScheduleFieldsProps = {
  kind: TravelItemKind;
  flightTripType: FlightTripType;
  date: string;
  startMinutes: number | null;
  endDate: string;
  endMinutes: number | null;
  planStartDate: string;
  planEndDate: string;
  onDateChange: (value: string) => void;
  onStartMinutesChange: (value: number) => void;
  onEndDateChange: (value: string) => void;
  onEndMinutesChange: (value: number) => void;
};

export function TravelItineraryFormScheduleFields({
  kind,
  flightTripType,
  date,
  startMinutes,
  endDate,
  endMinutes,
  planStartDate,
  planEndDate,
  onDateChange,
  onStartMinutesChange,
  onEndDateChange,
  onEndMinutesChange,
}: TravelItineraryFormScheduleFieldsProps) {
  const theme = useTheme();
  const chrome = itinerarySheetChrome(theme);
  const { spacing: rs } = useResponsive();
  const usesRange = kind === 'stay' || kind === 'flight' || kind === 'rental';
  const showActivityTimes = kind === 'activity' || kind === 'event';
  const rangeStartLabel =
    kind === 'stay'
      ? 'Check-in'
      : kind === 'rental'
        ? 'Pick-up'
        : kind === 'flight'
          ? 'Departure'
          : undefined;
  const rangeEndLabel =
    kind === 'stay'
      ? 'Check-out'
      : kind === 'rental'
        ? 'Drop-off'
        : kind === 'flight'
          ? 'Arrival'
          : undefined;

  return (
    <View style={[styles.schedule, { gap: rs.sm }]}>
      {kind === 'flight' && flightTripType === 'round-trip' ? (
        <AppText variant="overline" color="accent" fit style={travelOverlineStyle}>
          Departing
        </AppText>
      ) : null}
      {usesRange && rangeStartLabel && rangeEndLabel ? (
        <>
          <View style={[styles.twoColumns, { gap: rs.sm }]}>
            <View style={styles.flex}>
              <DateField
                testID={AgentUiIds.travel.itineraryAdd.date}
                value={date}
                stackedLabel={`${rangeStartLabel} *`}
                placeholder="Select date"
                minimumDate={kind === 'flight' ? undefined : planStartDate}
                maximumDate={kind === 'flight' ? undefined : planEndDate}
                onChange={onDateChange}
                accessibilityLabel={`${rangeStartLabel} date, required`}
                {...itinerarySheetFieldProps(chrome, 'calendar')}
              />
            </View>
            <View style={styles.flex}>
              <TimeField
                testID={AgentUiIds.travel.itineraryAdd.time}
                value={startMinutes}
                stackedLabel="Time"
                placeholder="Select time"
                showChevron
                onChange={onStartMinutesChange}
                accessibilityLabel={`${rangeStartLabel} time, required`}
                {...itinerarySheetFieldProps(chrome, 'clock')}
              />
            </View>
          </View>
          <View style={[styles.twoColumns, { gap: rs.sm }]}>
            <View style={styles.flex}>
              <DateField
                testID={AgentUiIds.travel.itineraryAdd.endDate}
                value={endDate}
                stackedLabel={`${rangeEndLabel} *`}
                placeholder="Select date"
                minimumDate={date || (kind === 'flight' ? undefined : planStartDate)}
                maximumDate={kind === 'flight' ? undefined : planEndDate}
                onChange={onEndDateChange}
                accessibilityLabel={`${rangeEndLabel} date, required`}
                {...itinerarySheetFieldProps(chrome, 'calendar')}
              />
            </View>
            <View style={styles.flex}>
              <TimeField
                testID={AgentUiIds.travel.itineraryAdd.endTime}
                value={endMinutes}
                stackedLabel="Time"
                placeholder="Select time"
                showChevron
                onChange={onEndMinutesChange}
                accessibilityLabel={`${rangeEndLabel} time, required`}
                {...itinerarySheetFieldProps(chrome, 'clock')}
              />
            </View>
          </View>
        </>
      ) : showActivityTimes ? (
        <>
          <DateField
            testID={AgentUiIds.travel.itineraryAdd.date}
            value={date}
            stackedLabel="Date *"
            placeholder="Select date"
            minimumDate={planStartDate}
            maximumDate={planEndDate}
            onChange={onDateChange}
            {...itinerarySheetFieldProps(chrome, 'calendar')}
          />
          <View style={[styles.twoColumns, { gap: rs.sm }]}>
            <View style={styles.flex}>
              <TimeField
                testID={AgentUiIds.travel.itineraryAdd.time}
                value={startMinutes}
                stackedLabel="From *"
                placeholder="Select time"
                showChevron
                onChange={(next) => {
                  onStartMinutesChange(next);
                  if (endMinutes !== null && endMinutes <= next) {
                    onEndMinutesChange(Math.min(next + 60, 24 * 60 - 1));
                  }
                }}
                accessibilityLabel="From time, required"
                {...itinerarySheetFieldProps(chrome, 'clock')}
              />
            </View>
            <View style={styles.flex}>
              <TimeField
                testID={AgentUiIds.travel.itineraryAdd.endTime}
                value={endMinutes}
                stackedLabel="To *"
                placeholder="Select time"
                showChevron
                onChange={onEndMinutesChange}
                accessibilityLabel="To time, required"
                {...itinerarySheetFieldProps(chrome, 'clock')}
              />
            </View>
          </View>
        </>
      ) : (
        <View style={[styles.twoColumns, { gap: rs.sm }]}>
          <View style={styles.flex}>
            <DateField
              testID={AgentUiIds.travel.itineraryAdd.date}
              value={date}
              stackedLabel="Date *"
              placeholder="Select date"
              minimumDate={kind === 'moment' ? undefined : planStartDate}
              maximumDate={kind === 'moment' ? undefined : planEndDate}
              onChange={onDateChange}
              {...itinerarySheetFieldProps(chrome, 'calendar')}
            />
          </View>
          <View style={styles.flex}>
            <TimeField
              testID={AgentUiIds.travel.itineraryAdd.time}
              value={startMinutes}
              stackedLabel="Time *"
              placeholder="Select time"
              showChevron
              onChange={onStartMinutesChange}
              {...itinerarySheetFieldProps(chrome, 'clock')}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  schedule: {},
  twoColumns: { flexDirection: 'row' },
  flex: { flex: 1, minWidth: 0 },
});
