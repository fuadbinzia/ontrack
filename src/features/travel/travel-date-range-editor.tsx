import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
    AppText,
    DateFieldCalendar,
    ErrorMessage,
} from '@/components/primitives';
import { stackedFieldMinHeight } from '@/components/primitives/field-leading-icon-style';
import { StackedIconField } from '@/components/primitives/stacked-icon-field';
import { validateTravelDateRange } from '@/features/travel/date-range';
import {
    itinerarySheetChrome,
    itinerarySheetFieldProps,
} from '@/features/travel/travel-itinerary-sheet-chrome';
import { TravelSheetPrimaryAction } from '@/features/travel/travel-list-actions';
import { TravelSheetModal } from '@/features/travel/travel-sheet';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { usePreferences } from '@/store/preferences';
import { useAgentUiTarget } from '@/utils/agent-ui';
import {
    formatDateKey,
    fromDateKey,
    isDateKey,
    toDateKey,
    todayKey,
    type DateDisplayFormat,
} from '@/utils/date';
import { haptics } from '@/utils/haptics';

type RangePhase = 'start' | 'end';

interface TravelDateRangeEditorProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  /** @deprecated Kept for call-site compatibility. */
  startLabel?: string;
  /** @deprecated Kept for call-site compatibility. */
  endLabel?: string;
  /** @deprecated Kept for call-site compatibility. */
  stacked?: boolean;
  testID?: string;
  calendarTestID?: string;
  closeTestID?: string;
  saveTestID?: string;
  /** @deprecated Prefer `testID`. */
  startTestID?: string;
  /** @deprecated Prefer `testID`. */
  endTestID?: string;
}

function monthCursor(dateKey: string): Date {
  const date = fromDateKey(isDateKey(dateKey) ? dateKey : todayKey());
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function formatRangeDisplay(
  startDate: string,
  endDate: string,
  dateDisplayFormat: DateDisplayFormat,
): string {
  if (!isDateKey(startDate) || !isDateKey(endDate)) return '';
  const start = formatDateKey(startDate, dateDisplayFormat);
  const end = formatDateKey(endDate, dateDisplayFormat);
  return start === end ? start : `${start} → ${end}`;
}

/** Stacked Dates field that opens a multiselect range calendar modal. */
export function TravelDateRangeEditor({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  testID,
  calendarTestID,
  closeTestID,
  saveTestID,
  startTestID,
}: TravelDateRangeEditorProps) {
  const theme = useTheme();
  const chrome = itinerarySheetChrome(theme);
  const field = itinerarySheetFieldProps(chrome, 'calendar');
  const { spacing, s, typography, fontScale } = useResponsive();
  const dateDisplayFormat = usePreferences((state) => state.dateDisplayFormat);
  const fieldTestID = testID ?? startTestID;
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [phase, setPhase] = useState<RangePhase>('start');
  const [cursor, setCursor] = useState(() => monthCursor(startDate));
  const [error, setError] = useState<string>();

  const hasRange = isDateKey(startDate) && isDateKey(endDate);
  const displayValue = formatRangeDisplay(startDate, endDate, dateDisplayFormat);
  const draftHasStart = isDateKey(draftStart);
  const draftHasEnd = isDateKey(draftEnd);
  const activeKey =
    phase === 'end' && draftHasEnd
      ? draftEnd
      : draftHasStart
        ? draftStart
        : todayKey();
  const stackedMinHeight = stackedFieldMinHeight({
    baseMinHeight: Math.max(56, s(60)),
    fontScale,
    labelLineHeight: typography.caption.lineHeight,
    valueLineHeight: typography.body.lineHeight,
    verticalPadding: spacing.sm,
  });

  useEffect(() => {
    if (!open) return;
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setPhase('start');
    setCursor(monthCursor(startDate));
    setError(undefined);
  }, [endDate, open, startDate]);

  const openModal = () => {
    haptics.tap();
    setOpen(true);
  };
  const closeModal = () => setOpen(false);

  const agent = useAgentUiTarget(fieldTestID, {
    label: 'Dates',
    onPress: openModal,
  });

  const chooseDate = (date: Date) => {
    const key = toDateKey(date);
    setError(undefined);
    if (phase === 'start' || !draftHasStart) {
      setDraftStart(key);
      setDraftEnd(key);
      setPhase('end');
      setCursor(monthCursor(key));
      return;
    }
    if (key < draftStart) {
      setDraftStart(key);
      setDraftEnd(draftStart);
    } else {
      setDraftEnd(key);
    }
    setPhase('start');
    setCursor(monthCursor(key));
  };

  const save = () => {
    const validation = validateTravelDateRange(draftStart, draftEnd);
    if (validation.error) {
      setError(validation.error);
      return;
    }
    onStartDateChange(draftStart);
    onEndDateChange(draftEnd);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        ref={agent.ref}
        testID={fieldTestID}
        onLayout={agent.onLayout}
        accessibilityRole="button"
        accessibilityLabel="Dates"
        accessibilityHint="Opens a calendar to choose the trip date range"
        accessibilityValue={{ text: displayValue || 'Select Dates' }}
        onPress={openModal}
        style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
        <StackedIconField
          icon="calendar"
          stackedLabel="Dates"
          stackedLabelColor={field.stackedLabelColor}
          iconBackground={field.iconBackground}
          iconColor={field.iconColor}
          fieldBackground={field.fieldBackground}
          fieldBorderColor={field.fieldBorderColor}
          borderRadius={field.fieldBorderRadius}
          minHeight={stackedMinHeight}>
          <AppText
            variant="body"
            fit
            numberOfLines={1}
            style={{
              flexShrink: 1,
              minWidth: 0,
              color: hasRange ? theme.textPrimary : field.placeholderColor,
            }}>
            {hasRange ? displayValue : 'Select Dates'}
          </AppText>
        </StackedIconField>
      </Pressable>

      <TravelSheetModal
        visible={open}
        eyebrow="Travel dates"
        title="Choose Your Trip Range"
        subtitleIcon="calendar"
        onClose={closeModal}
        closeAccessibilityLabel="Close trip dates"
        closeTestID={closeTestID}
        scrollKey={`${phase}:${cursor.toISOString()}`}
        footer={
          <TravelSheetPrimaryAction
            label="Save Dates"
            icon="check"
            onPress={save}
            testID={saveTestID}
          />
        }>
        <View style={{ gap: spacing.md }}>
          <AppText variant="callout" align="center" fit>
            {draftHasStart && draftHasEnd
              ? formatRangeDisplay(draftStart, draftEnd, dateDisplayFormat)
              : 'No dates selected'}
          </AppText>
          <AppText variant="caption" color="secondary" align="center">
            {draftHasStart && draftHasEnd && phase === 'start'
              ? 'Tap save to update'
              : phase === 'start' || !draftHasStart
                ? 'Tap the first day of your trip.'
                : 'Tap the final day of your trip.'}
          </AppText>
          <DateFieldCalendar
            value={fromDateKey(activeKey)}
            cursor={cursor}
            rangeStart={draftHasStart ? fromDateKey(draftStart) : undefined}
            rangeEnd={draftHasEnd ? fromDateKey(draftEnd) : undefined}
            onCursorChange={setCursor}
            onValueChange={chooseDate}
            controlAppearance="glass"
            testID={calendarTestID}
          />
          {error ? <ErrorMessage message={error} selectable /> : null}
        </View>
      </TravelSheetModal>
    </>
  );
}
