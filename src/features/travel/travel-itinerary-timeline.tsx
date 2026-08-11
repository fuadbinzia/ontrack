import { useEffect, useMemo, useState, type RefObject } from 'react';

import { travelItineraryTimelineStyles as styles } from './travel-itinerary-timeline-styles';
import { View, type ScrollView } from 'react-native';

import { AppText, Symbol } from '@/components/primitives';
import { radii } from '@/design-system';
import type { FlightDetailsDraft } from '@/features/travel/flight-details';
import type { FlightScheduleDraft } from '@/features/travel/flight-schedule';
import type { RentalDetailsDraft } from '@/features/travel/rental-details';
import type { StayDetailsDraft } from '@/features/travel/stay-details';
import { travelEditorialTextStyle } from '@/features/travel/travel-chrome';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import type { TravelRangeScheduleDraft } from '@/features/travel/travel-range-schedule';
import { TravelTimelineDaySkeleton } from '@/features/travel/travel-plan-detail-body-skeleton';
import { TRAVEL_EDITORIAL_ACCENT } from '@/features/travel/travel-surface';
import {
  expandTimelineEntries,
  groupTimelineDaysForPlan,
} from '@/features/travel/travel-timeline-entries';
import { TravelItineraryTimelineDays } from '@/features/travel/travel-itinerary-timeline-days';
import {
  resolveJourneyTraveler,
  summarizeTimelineProgress,
} from '@/features/travel/travel-timeline-progress';
import { TimelineProgressStrip } from '@/features/travel/travel-timeline-progress-chrome';
import type { TravelItineraryItem, TravelPlan } from '@/features/travel/types';
import {
  useTravelItineraryInk,
  useTravelItineraryMistProps,
  useTravelItineraryOnGlass,
} from '@/features/travel/use-travel-itinerary-glass';
import { useResponsive } from '@/hooks/use-responsive';
import { useRouteIsActive } from '@/hooks/use-app-activity';
import { useTheme } from '@/hooks/use-theme';
import { type DateDisplayFormat } from '@/utils/date';

/** First paint: a couple of days, then fill the rest so long trips don't stall. */
const TIMELINE_DAY_BATCH = 2;

export function TravelItineraryTimeline({
  plan,
  items,
  minimizedItemIds,
  collapsedDayDates,
  dateDisplayFormat,
  editingFlightItemId,
  editedFlightDetails,
  editedFlightDetailsError,
  editedFlightFileName,
  importingFlightTarget,
  editingRentalItemId,
  editedRentalDetails,
  editedRentalDetailsError,
  editedRentalFileName,
  importingRentalTarget,
  editingStayItemId,
  editedStayDetails,
  editedStayDetailsError,
  editedStayFileName,
  importingStayTarget,
  onToggle,
  onToggleDay,
  onEditedFlightDetailsChange,
  onImportFlight,
  onSaveFlightDetails,
  onCancelFlightEdit,
  onBeginFlightEdit,
  onEditedRentalDetailsChange,
  onImportRental,
  onSaveRentalDetails,
  onCancelRentalEdit,
  onBeginRentalEdit,
  onEditedStayDetailsChange,
  onImportStay,
  onSaveStayDetails,
  onCancelStayEdit,
  onBeginStayEdit,
  onBeginItemEdit,
  onAddPhotos,
  onRemove,
  onSaveNotes,
  pendingFocusEntryKey,
  onFocusEntryHandled,
  scrollRef,
  scrollOffsetYRef,
}: {
  plan: TravelPlan;
  items: TravelItineraryItem[];
  minimizedItemIds: Set<string>;
  collapsedDayDates: Set<string>;
  dateDisplayFormat: DateDisplayFormat;
  pendingFocusEntryKey?: string;
  onFocusEntryHandled?: () => void;
  scrollRef?: RefObject<ScrollView | null>;
  scrollOffsetYRef?: RefObject<number>;
  editingFlightItemId?: string;
  editedFlightDetails: FlightDetailsDraft;
  editedFlightDetailsError?: string;
  editedFlightFileName?: string;
  importingFlightTarget?: string;
  editingRentalItemId?: string;
  editedRentalDetails: RentalDetailsDraft;
  editedRentalDetailsError?: string;
  editedRentalFileName?: string;
  importingRentalTarget?: string;
  editingStayItemId?: string;
  editedStayDetails: StayDetailsDraft;
  editedStayDetailsError?: string;
  editedStayFileName?: string;
  importingStayTarget?: string;
  onToggle: (itemId: string) => void;
  onToggleDay: (date: string) => void;
  onEditedFlightDetailsChange: (value: FlightDetailsDraft) => void;
  onImportFlight: (itemId: string) => void;
  onSaveFlightDetails: (itemId: string, schedule: FlightScheduleDraft) => void;
  onCancelFlightEdit: () => void;
  onBeginFlightEdit: (
    itemId: string,
    flight: TravelItineraryItem['flight'],
  ) => void;
  onEditedRentalDetailsChange: (value: RentalDetailsDraft) => void;
  onImportRental: (itemId: string) => void;
  onSaveRentalDetails: (
    itemId: string,
    schedule: TravelRangeScheduleDraft,
  ) => void;
  onCancelRentalEdit: () => void;
  onBeginRentalEdit: (
    itemId: string,
    rental: TravelItineraryItem['rental'],
  ) => void;
  onEditedStayDetailsChange: (value: StayDetailsDraft) => void;
  onImportStay: (itemId: string) => void;
  onSaveStayDetails: (
    itemId: string,
    schedule: TravelRangeScheduleDraft,
  ) => void;
  onCancelStayEdit: () => void;
  onBeginStayEdit: (itemId: string, stay: TravelItineraryItem['stay']) => void;
  onBeginItemEdit?: (item: TravelItineraryItem) => void;
  onAddPhotos: (itemId: string) => void;
  onRemove: (item: TravelItineraryItem) => void;
  onSaveNotes: (
    itemId: string,
    notes: NonNullable<TravelItineraryItem['notes']>,
  ) => void;
}) {
  const theme = useTheme();
  const { s, spacing: rs, typography } = useResponsive();
  const mistProps = useTravelItineraryMistProps();
  const onGlass = useTravelItineraryOnGlass();
  const primaryInk = useTravelItineraryInk();
  const secondaryInk = useTravelItineraryInk('secondary');
  const routeIsActive = useRouteIsActive();
  const [now, setNow] = useState(() => new Date());
  const days = useMemo(
    () =>
      groupTimelineDaysForPlan(
        expandTimelineEntries(items),
        plan.startDate,
        plan.endDate,
      ),
    [items, plan.endDate, plan.startDate],
  );
  const progress = useMemo(
    () =>
      summarizeTimelineProgress({
        planStartDate: plan.startDate,
        planEndDate: plan.endDate,
        days,
        now,
      }),
    [plan.startDate, plan.endDate, days, now],
  );
  const traveler = useMemo(
    () =>
      resolveJourneyTraveler({
        planStartDate: plan.startDate,
        planEndDate: plan.endDate,
        days,
        summary: progress,
        now,
      }),
    [plan.startDate, plan.endDate, days, progress, now],
  );
  const spineWidth = Math.max(16, s(18));
  const dayMarkerSize = Math.max(8, s(8));
  const dayTap = Math.max(32, s(32));
  const [mountedDayCount, setMountedDayCount] = useState(() =>
    Math.min(TIMELINE_DAY_BATCH, Math.max(days.length, 0)),
  );
  const visibleDays = useMemo(
    () => days.slice(0, mountedDayCount),
    [days, mountedDayCount],
  );
  const pendingDayBones = Math.max(0, days.length - mountedDayCount);

  useEffect(() => {
    if (!routeIsActive) return;
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 60_000);
    tick();
    return () => clearInterval(interval);
  }, [routeIsActive]);

  // Keep mounted window in sync when itinerary shrinks / expands.
  useEffect(() => {
    setMountedDayCount((count) => {
      if (days.length === 0) return 0;
      if (count === 0) return Math.min(TIMELINE_DAY_BATCH, days.length);
      return Math.min(Math.max(count, TIMELINE_DAY_BATCH), days.length);
    });
  }, [days.length]);

  // Reveal target day immediately when scrolling to a newly added stop.
  useEffect(() => {
    if (!pendingFocusEntryKey) return;
    const focusIndex = days.findIndex((day) =>
      day.entries.some((entry) => entry.key === pendingFocusEntryKey),
    );
    if (focusIndex < 0) return;
    setMountedDayCount((count) => Math.max(count, focusIndex + 1));
  }, [days, pendingFocusEntryKey]);

  // Progressive fill — paint the first days, then batch in the rest.
  useEffect(() => {
    if (!routeIsActive || mountedDayCount >= days.length) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        setMountedDayCount((count) =>
          Math.min(count + TIMELINE_DAY_BATCH, days.length),
        );
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [routeIsActive, mountedDayCount, days.length]);

  if (days.length === 0) {
    const emptyIconBg = onGlass
      ? 'rgba(255,255,255,0.12)'
      : 'rgba(17, 74, 110, 0.08)';
    return (
      <TravelHomeGlass
        {...mistProps}
        style={[
          styles.emptyCard,
          {
            padding: rs.lg,
            gap: rs.md,
            borderRadius: 18,
            borderCurve: 'continuous',
          },
        ]}
      >
        <View
          style={[
            styles.emptyIcon,
            {
              backgroundColor: emptyIconBg,
              width: Math.max(56, s(64)),
              height: Math.max(56, s(64)),
              borderRadius: radii.xl,
            },
          ]}
        >
          <Symbol name="flight" size="lg" color={primaryInk} />
        </View>
        <AppText
          variant="subheading"
          style={[travelEditorialTextStyle, { color: primaryInk }]}
        >
          Your Journey Starts Here
        </AppText>
        <AppText
          variant="body"
          style={[travelEditorialTextStyle, { color: secondaryInk }]}
        >
          Add flights, stays, activities, or moments with photos and notes —
          they show up here day by day. Tap + above to begin.
        </AppText>
      </TravelHomeGlass>
    );
  }

  /** Compact bridge so day sections read as one joined stack. */
  const dayGap = Math.max(16, s(18));
  const dayBodyPadLeft = rs.sm;

  return (
    <View style={styles.timeline}>
      <TimelineProgressStrip
        summary={progress}
        traveler={traveler}
        accent={TRAVEL_EDITORIAL_ACCENT}
      />
      <TravelItineraryTimelineDays
        plan={plan}
        days={visibleDays}
        now={now}
        collapsedDayDates={collapsedDayDates}
        dayGap={dayGap}
        dayBodyPadLeft={dayBodyPadLeft}
        spineWidth={spineWidth}
        dayMarkerSize={dayMarkerSize}
        rs={rs}
        s={s}
        theme={theme}
        mistProps={mistProps}
        primaryInk={primaryInk}
        typography={typography}
        dayTap={dayTap}
        dateDisplayFormat={dateDisplayFormat}
        minimizedItemIds={minimizedItemIds}
        editingFlightItemId={editingFlightItemId}
        editedFlightDetails={editedFlightDetails}
        editedFlightDetailsError={editedFlightDetailsError}
        editedFlightFileName={editedFlightFileName}
        importingFlightTarget={importingFlightTarget}
        editingRentalItemId={editingRentalItemId}
        editedRentalDetails={editedRentalDetails}
        editedRentalDetailsError={editedRentalDetailsError}
        editedRentalFileName={editedRentalFileName}
        importingRentalTarget={importingRentalTarget}
        editingStayItemId={editingStayItemId}
        editedStayDetails={editedStayDetails}
        editedStayDetailsError={editedStayDetailsError}
        editedStayFileName={editedStayFileName}
        importingStayTarget={importingStayTarget}
        onToggle={onToggle}
        onToggleDay={onToggleDay}
        onEditedFlightDetailsChange={onEditedFlightDetailsChange}
        onImportFlight={onImportFlight}
        onSaveFlightDetails={onSaveFlightDetails}
        onCancelFlightEdit={onCancelFlightEdit}
        onBeginFlightEdit={onBeginFlightEdit}
        onEditedRentalDetailsChange={onEditedRentalDetailsChange}
        onImportRental={onImportRental}
        onSaveRentalDetails={onSaveRentalDetails}
        onCancelRentalEdit={onCancelRentalEdit}
        onBeginRentalEdit={onBeginRentalEdit}
        onEditedStayDetailsChange={onEditedStayDetailsChange}
        onImportStay={onImportStay}
        onSaveStayDetails={onSaveStayDetails}
        onCancelStayEdit={onCancelStayEdit}
        onBeginStayEdit={onBeginStayEdit}
        onBeginItemEdit={onBeginItemEdit}
        onAddPhotos={onAddPhotos}
        onRemove={onRemove}
        onSaveNotes={onSaveNotes}
        pendingFocusEntryKey={pendingFocusEntryKey}
        onFocusEntryHandled={onFocusEntryHandled}
        scrollRef={scrollRef}
        scrollOffsetYRef={scrollOffsetYRef}
      />
      {pendingDayBones > 0 ? (
        <TravelTimelineDaySkeleton count={Math.min(2, pendingDayBones)} />
      ) : null}
    </View>
  );
}
