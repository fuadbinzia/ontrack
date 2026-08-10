import { View } from 'react-native';

import {
    ErrorMessage,
    Input,
} from '@/components/primitives';
import { AddressAutofindField } from '@/features/travel/address-autofind-field';
import { TravelDateRangeEditor } from '@/features/travel/travel-date-range-editor';
import {
    itinerarySheetChrome,
    itinerarySheetFieldProps,
} from '@/features/travel/travel-itinerary-sheet-chrome';
import { TravelSheetPrimaryAction } from '@/features/travel/travel-list-actions';
import { TravelSheetModal } from '@/features/travel/travel-sheet';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

interface TravelNewTripSheetProps {
  visible: boolean;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  notes: string;
  error?: string;
  onTitleChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
}

/** Bottom-sheet composer for starting a new trip from Travel home. */
export function TravelNewTripSheet({
  visible,
  title,
  destination,
  startDate,
  endDate,
  notes,
  error,
  onTitleChange,
  onDestinationChange,
  onStartDateChange,
  onEndDateChange,
  onNotesChange,
  onCreate,
  onClose,
}: TravelNewTripSheetProps) {
  const theme = useTheme();
  const chrome = itinerarySheetChrome(theme);
  const { spacing } = useResponsive();

  return (
    <TravelSheetModal
      visible={visible}
      title="Start a New Trip"
      subtitle="Name the trip, pick dates, and you’re ready to plan."
      onClose={onClose}
      closeAccessibilityLabel="Cancel New Trip"
      closeTestID={AgentUiIds.travel.newTrip.cancel}
      footer={
        <TravelSheetPrimaryAction
          label="Create Trip"
          icon="flight"
          testID={AgentUiIds.travel.newTrip.create}
          onPress={onCreate}
        />
      }>
      <View style={{ gap: spacing.md }}>
        <Input
          testID={AgentUiIds.travel.newTrip.title}
          icon="flight"
          stackedLabel="Trip Name"
          value={title}
          onChangeText={onTitleChange}
          placeholder="Fun in the Sun!"
          accessibilityLabel="Trip Name"
          {...itinerarySheetFieldProps(chrome, 'flight')}
        />
        <AddressAutofindField
          testID={AgentUiIds.travel.newTrip.destination}
          icon="location"
          stackedLabel="Destination"
          value={destination}
          onChange={onDestinationChange}
          placeholder="Anywhere Sunny"
          accessibilityLabel="Destination"
          {...itinerarySheetFieldProps(chrome, 'location')}
        />
        <TravelDateRangeEditor
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          testID={AgentUiIds.travel.newTrip.dates}
          calendarTestID={AgentUiIds.travel.newTrip.calendar}
          closeTestID={AgentUiIds.travel.newTrip.datesClose}
          saveTestID={AgentUiIds.travel.newTrip.datesSave}
        />
        <Input
          testID={AgentUiIds.travel.newTrip.notes}
          icon="note"
          stackedLabel="Notes"
          value={notes}
          onChangeText={onNotesChange}
          placeholder="Ideas, budgets, must-dos…"
          multiline
          accessibilityLabel="Notes"
          {...itinerarySheetFieldProps(chrome, 'note')}
        />
        {error ? <ErrorMessage message={error} align="center" /> : null}
      </View>
    </TravelSheetModal>
  );
}
