import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
    Button,
    DangerZone,
    DateField,
    DestructiveSection,
    ErrorMessage,
    HeaderBackButton,
    Input,
} from '@/components/primitives';
import { AddressAutofindField } from '@/features/travel/address-autofind-field';
import {
    itinerarySheetChrome,
    itinerarySheetFieldProps,
} from '@/features/travel/travel-itinerary-sheet-chrome';
import {
    TRIP_DESTINATION_PLACEHOLDER,
    TRIP_NOTES_PLACEHOLDER,
    TRIP_TITLE_PLACEHOLDER,
} from '@/features/travel/travel-plan-details';
import {
    TravelRemoveConfirmModal,
    type TravelRemoveConfirmPayload,
} from '@/features/travel/travel-remove-confirm-modal';
import { TravelScreenHeader } from '@/features/travel/travel-screen-header';
import {
    TravelSurfaceCard,
} from '@/features/travel/travel-surface';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';

import { TravelPlanCoverField } from './travel-plan-cover-field';
import type { TravelPlan } from './types';

interface TravelPlanDetailsEditorProps {
  plan: TravelPlan;
  title: string;
  destination: string;
  notes: string;
  startDate: string;
  endDate: string;
  coverUris: string[];
  error?: string;
  onTitleChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onCoverUrisChange: (uris: string[]) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  /** DEV: auto-open Trip Cover Photo picker. */
  initialCoverPickerOpen?: boolean;
}

export function TravelPlanDetailsEditor({
  plan,
  title,
  destination,
  notes,
  startDate,
  endDate,
  coverUris,
  error,
  onTitleChange,
  onDestinationChange,
  onNotesChange,
  onStartDateChange,
  onEndDateChange,
  onCoverUrisChange,
  onSave,
  onCancel,
  onDelete,
  initialCoverPickerOpen = false,
}: TravelPlanDetailsEditorProps) {
  const theme = useTheme();
  const chrome = itinerarySheetChrome(theme);
  const { spacing: rs } = useResponsive();
  const [removeConfirm, setRemoveConfirm] =
    useState<TravelRemoveConfirmPayload | null>(null);
  const openDeleteTrip = () => {
    setRemoveConfirm({
      title: 'Delete Trip?',
      message: `This action will permanently remove “${plan.title}”.`,
      actionLabel: 'Delete Trip',
      onConfirm: onDelete,
    });
  };

  const changeStartDate = (value: string) => {
    onStartDateChange(value);
    if (endDate < value) onEndDateChange(value);
  };

  return (
    <>
    <View style={[styles.page, { gap: rs.lg }]}>
      <TravelScreenHeader
        title="Edit Trip"
        leading={
          <HeaderBackButton
            compact
            accessibilityLabel="Back to trips"
            testID={AgentUiIds.travel.editTrip.cancel}
            onPress={onCancel}
          />
        }
      />

      <TravelSurfaceCard padding={0}>
        <View style={{ padding: rs.lg, gap: rs.lg }}>
          <View style={{ gap: rs.md }}>
            <TravelPlanCoverField
              plan={plan}
              coverUris={coverUris}
              onCoverUrisChange={onCoverUrisChange}
              initialPickerOpen={initialCoverPickerOpen}
            />
            <View style={[styles.divider, { backgroundColor: chrome.fieldBorder }]} />
          </View>

          <View style={{ gap: rs.sm }}>
            <Input
              testID={AgentUiIds.travel.editTrip.title}
              value={title}
              onChangeText={onTitleChange}
              icon="flight"
              stackedLabel="Trip Name"
              placeholder={TRIP_TITLE_PLACEHOLDER}
              accessibilityLabel="Trip Name"
              {...itinerarySheetFieldProps(chrome, 'flight')}
            />
            <AddressAutofindField
              testID={AgentUiIds.travel.editTrip.destination}
              value={destination}
              onChange={onDestinationChange}
              icon="location"
              stackedLabel="Destination"
              placeholder={TRIP_DESTINATION_PLACEHOLDER}
              accessibilityLabel="Destination"
              {...itinerarySheetFieldProps(chrome, 'location')}
            />
            <View style={[styles.dateRow, { gap: rs.sm }]}>
              <View style={styles.dateCol}>
                <DateField
                  testID={AgentUiIds.travel.editTrip.startDate}
                  value={startDate}
                  stackedLabel="Start"
                  placeholder="Select date"
                  onChange={changeStartDate}
                  accessibilityLabel="Start date"
                  {...itinerarySheetFieldProps(chrome, 'calendar')}
                />
              </View>
              <View style={styles.dateCol}>
                <DateField
                  testID={AgentUiIds.travel.editTrip.endDate}
                  value={endDate}
                  stackedLabel="End"
                  placeholder="Select date"
                  minimumDate={startDate}
                  onChange={onEndDateChange}
                  accessibilityLabel="End date"
                  {...itinerarySheetFieldProps(chrome, 'calendar')}
                />
              </View>
            </View>
            <Input
              testID={AgentUiIds.travel.editTrip.notes}
              value={notes}
              onChangeText={onNotesChange}
              icon="note"
              stackedLabel="Notes"
              placeholder={TRIP_NOTES_PLACEHOLDER}
              multiline
              accessibilityLabel="Notes"
              {...itinerarySheetFieldProps(chrome, 'note')}
            />
          </View>

          {error ? <ErrorMessage message={error} selectable /> : null}

          <View style={[styles.actions, { gap: rs.lg }]}>
            <Button
              variant="primary"
              testID={AgentUiIds.travel.editTrip.save}
              accessibilityLabel="Save Details"
              onPress={onSave}>
              Save Details
            </Button>
            <DangerZone
              title={null}
              testID={AgentUiIds.travel.editTrip.dangerZone}>
              <DestructiveSection
                flush
                icon={null}
                descriptionAlign="center"
                label="Delete Trip"
                description="Permanently removes this trip and its itinerary from this device."
                testID={AgentUiIds.travel.removeConfirm.open}
                accessibilityLabel={`Delete ${plan.title}`}
                onPress={openDeleteTrip}
              />
            </DangerZone>
          </View>
        </View>
      </TravelSurfaceCard>
    </View>
    <TravelRemoveConfirmModal
      payload={removeConfirm}
      onCancel={() => setRemoveConfirm(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
  },
  actions: {
    width: '100%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  dateRow: {
    flexDirection: 'row',
  },
  dateCol: {
    flex: 1,
    minWidth: 0,
  },
});
