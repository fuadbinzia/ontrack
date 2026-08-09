import { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AppText, CollapsibleBody, Symbol } from '@/components/primitives';
import { radii } from '@/design-system';
import type { FlightDetailsDraft } from '@/features/travel/flight-details';
import type { FlightScheduleDraft } from '@/features/travel/flight-schedule';
import type { RentalDetailsDraft } from '@/features/travel/rental-details';
import type { StayDetailsDraft } from '@/features/travel/stay-details';
import { travelEditorialTextStyle } from '@/features/travel/travel-chrome';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import type { TravelRangeScheduleDraft } from '@/features/travel/travel-range-schedule';
import {
    TRAVEL_EDITORIAL_ACCENT,
} from '@/features/travel/travel-surface';
import {
    dayNumberFor,
    daySpineColor,
    TimelineDayBridge,
    TimelineDayHeader,
} from '@/features/travel/travel-timeline-day-chrome';
import {
    expandTimelineEntries,
    groupTimelineEntriesByDate,
} from '@/features/travel/travel-timeline-entries';
import { TravelTimelineNode } from '@/features/travel/travel-timeline-node';
import {
    isTimelineEntryPast,
    resolveJourneyTraveler,
    summarizeTimelineProgress,
    timelineDayPhase,
} from '@/features/travel/travel-timeline-progress';
import {
    TimelineNowMarker,
    TimelineProgressStrip,
} from '@/features/travel/travel-timeline-progress-chrome';
import type {
    TravelItineraryItem,
    TravelPlan,
} from '@/features/travel/types';
import {
    useTravelItineraryInk,
    useTravelItineraryMistProps,
    useTravelItineraryOnGlass,
} from '@/features/travel/use-travel-itinerary-glass';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import {
    formatDateKeyMedium,
    formatMinutes,
    formatWeekday,
    type DateDisplayFormat,
} from '@/utils/date';

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
  onRemovePhoto,
  onRemove,
  onSaveNotes,
}: {
  plan: TravelPlan;
  items: TravelItineraryItem[];
  minimizedItemIds: Set<string>;
  collapsedDayDates: Set<string>;
  dateDisplayFormat: DateDisplayFormat;
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
  onBeginStayEdit: (
    itemId: string,
    stay: TravelItineraryItem['stay'],
  ) => void;
  onBeginItemEdit?: (item: TravelItineraryItem) => void;
  onAddPhotos: (itemId: string) => void;
  onRemovePhoto: (itemId: string, uri: string) => void;
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
  const [now, setNow] = useState(() => new Date());
  const days = useMemo(
    () => groupTimelineEntriesByDate(expandTimelineEntries(items)),
    [items],
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

  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

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
        ]}>
        <View
          style={[
            styles.emptyIcon,
            {
              backgroundColor: emptyIconBg,
              width: Math.max(56, s(64)),
              height: Math.max(56, s(64)),
              borderRadius: radii.xl,
            },
          ]}>
          <Symbol
            name="flight"
            size="lg"
            color={primaryInk}
          />
        </View>
        <AppText
          variant="subheading"
          style={[
            travelEditorialTextStyle,
            { color: primaryInk },
          ]}>
          Your Journey Starts Here
        </AppText>
        <AppText
          variant="body"
          style={[
            travelEditorialTextStyle,
            { color: secondaryInk },
          ]}>
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
      {days.map((day, dayIndex) => {
        const dayNumber = dayNumberFor(plan.startDate, day.date);
        const dateLabel = formatDateKeyMedium(day.date);
        const weekday = formatWeekday(day.date);
        const dayExpanded = !collapsedDayDates.has(day.date);
        const entryCount = day.entries.length;
        const dayPhase = timelineDayPhase(day.date, day.entries, now);
        const dayPast = dayPhase === 'past';
        const spineColor = daySpineColor(dayIndex, theme.name);
        const prevSpineColor =
          dayIndex > 0 ? daySpineColor(dayIndex - 1, theme.name) : spineColor;
        const firstUpcomingIndex =
          dayPhase === 'current'
            ? day.entries.findIndex((entry) => !isTimelineEntryPast(entry, now))
            : -1;
        return (
          <View key={day.date} style={{ opacity: dayPast ? 0.58 : 1 }}>
            {dayIndex > 0 ? (
              <View
                pointerEvents="none"
                style={[
                  styles.dayConnector,
                  {
                    height: dayGap,
                    paddingLeft: dayBodyPadLeft,
                  },
                ]}>
                <View
                  style={[
                    styles.spineColumn,
                    {
                      width: spineWidth,
                      height: dayGap,
                      justifyContent: 'center',
                    },
                  ]}>
                  <TimelineDayBridge
                    fromColor={prevSpineColor}
                    toColor={spineColor}
                    height={dayGap}
                    thickness={Math.max(2, s(2))}
                    dashLength={Math.max(3, s(3))}
                  />
                </View>
              </View>
            ) : null}
            <View
              style={[
                styles.dayBody,
                {
                  gap: rs.xs,
                  paddingTop: dayIndex === 0 ? rs.xs : 0,
                  // Keep joined days tight; give the final day room above the
                  // Timeline panel’s bottom radius / screen edge.
                  paddingBottom:
                    dayIndex === days.length - 1 ? rs.md : 0,
                  paddingLeft: dayBodyPadLeft,
                  paddingRight: rs.sm,
                },
              ]}>
              <View style={[styles.dayRow, { gap: rs.xs }]}>
                <View style={[styles.spineColumn, { width: spineWidth }]}>
                  <View
                    style={[
                      styles.dayMarker,
                      {
                        width:
                          dayPhase === 'current'
                            ? dayMarkerSize + Math.max(2, s(2))
                            : dayMarkerSize,
                        height:
                          dayPhase === 'current'
                            ? dayMarkerSize + Math.max(2, s(2))
                            : dayMarkerSize,
                        borderRadius:
                          (dayPhase === 'current'
                              ? dayMarkerSize + Math.max(2, s(2))
                              : dayMarkerSize) / 2,
                          backgroundColor: spineColor,
                          marginTop: Math.max(6, s(6)),
                          borderWidth:
                            dayPhase === 'current' ? Math.max(2, s(2)) : 0,
                          borderColor:
                            theme.name === 'dark'
                              ? 'rgba(255,255,255,0.55)'
                              : 'rgba(17, 74, 110, 0.22)',
                        },
                      ]}
                    />
                    {dayExpanded ? (
                      <View
                        style={[
                          styles.spineLine,
                          {
                            top:
                              Math.max(6, s(6)) +
                              (dayPhase === 'current'
                                ? dayMarkerSize + Math.max(2, s(2))
                                : dayMarkerSize),
                            bottom: 0,
                            backgroundColor: spineColor,
                            opacity: dayPast ? 0.55 : 1,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                  <View style={[styles.dayContent, { gap: rs.xs }]}>
                    <TimelineDayHeader
                      date={day.date}
                      dayNumber={dayNumber}
                      weekday={weekday}
                      dateLabel={dateLabel}
                      entryCount={entryCount}
                      dayPhase={dayPhase}
                      dayExpanded={dayExpanded}
                      dayTap={dayTap}
                      overlineSize={typography.overline.fontSize}
                      overlineLineHeight={typography.overline.lineHeight}
                      onToggleDay={onToggleDay}
                    />
                    <CollapsibleBody expanded={dayExpanded}>
                      <View style={{ gap: rs.xs }}>
                        {firstUpcomingIndex === 0 ? (
                          <TimelineNowMarker
                            accent={spineColor}
                            spineWidth={0}
                          />
                        ) : null}
                        <TravelHomeGlass
                          {...mistProps}
                          style={[
                            styles.eventStack,
                            {
                              borderRadius: Math.max(10, s(11)),
                              borderCurve: 'continuous',
                              // Match top/bottom so the first/last rows don’t
                              // sit flush against the glass radius unevenly.
                              paddingVertical: Math.max(2, s(2)),
                            },
                          ]}>
                          {day.entries.map((entry, index) => {
                            const { item } = entry;
                            const prevMinutes =
                              index > 0
                                ? day.entries[index - 1].startMinutes
                                : undefined;
                            const showTime = prevMinutes !== entry.startMinutes;
                            const entryPast = isTimelineEntryPast(entry, now);
                            const showNowBefore =
                              firstUpcomingIndex > 0 &&
                              index === firstUpcomingIndex;
                            return (
                              <View key={entry.key}>
                                {showNowBefore ? (
                                  <View
                                    style={[
                                      styles.nowInStack,
                                      {
                                        gap: rs.xs,
                                        paddingHorizontal: rs.sm,
                                        paddingVertical: Math.max(6, s(6)),
                                        borderTopWidth: StyleSheet.hairlineWidth,
                                        borderTopColor:
                                          theme.name === 'dark'
                                            ? 'rgba(255,255,255,0.18)'
                                            : 'rgba(17, 74, 110, 0.10)',
                                        backgroundColor:
                                          theme.name === 'dark'
                                            ? 'rgba(255,255,255,0.08)'
                                            : 'rgba(17, 74, 110, 0.06)',
                                      },
                                    ]}>
                                    <View
                                      style={{
                                        width: Math.max(8, s(8)),
                                        height: Math.max(8, s(8)),
                                        borderRadius: Math.max(4, s(4)),
                                        backgroundColor: spineColor,
                                      }}
                                    />
                                    <AppText
                                      variant="caption"
                                      fit
                                      style={[
                                        styles.nowInStackLabel,
                                        { color: primaryInk },
                                      ]}>
                                      Now
                                    </AppText>
                                  </View>
                                ) : null}
                                <View
                                  style={[
                                    styles.eventShell,
                                    {
                                      paddingLeft: rs.sm,
                                      paddingRight: rs.xs,
                                      paddingVertical: Math.max(8, s(8)),
                                      minHeight: Math.max(44, s(44)),
                                      justifyContent: 'center',
                                      alignItems: 'stretch',
                                      borderTopWidth:
                                        index > 0 || showNowBefore
                                          ? StyleSheet.hairlineWidth
                                          : 0,
                                      borderTopColor: theme.separator,
                                      opacity: entryPast ? 0.55 : 1,
                                    },
                                  ]}>
                                  <TravelTimelineNode
                                    item={item}
                                    plan={plan}
                                    phase={entry.phase}
                                    displayTitle={entry.title}
                                    entryDate={entry.date}
                                    entryStartMinutes={entry.startMinutes}
                                    leadingTimeLabel={
                                      showTime
                                        ? formatMinutes(entry.startMinutes)
                                        : ''
                                    }
                                    showKindBadge
                                    compact
                                    dense
                                    index={dayIndex * 4 + index}
                                    allowStructuredEditing={false}
                                    showStructuredDetails={false}
                                    expanded={!minimizedItemIds.has(entry.key)}
                                    dateDisplayFormat={dateDisplayFormat}
                                    editingFlightItemId={editingFlightItemId}
                                    editedFlightDetails={editedFlightDetails}
                                    editedFlightDetailsError={
                                      editedFlightDetailsError
                                    }
                                    editedFlightFileName={editedFlightFileName}
                                    importingFlight={
                                      importingFlightTarget === item.id
                                    }
                                    editingRentalItemId={editingRentalItemId}
                                    editedRentalDetails={editedRentalDetails}
                                    editedRentalDetailsError={
                                      editedRentalDetailsError
                                    }
                                    editedRentalFileName={editedRentalFileName}
                                    importingRental={
                                      importingRentalTarget === item.id
                                    }
                                    editingStayItemId={editingStayItemId}
                                    editedStayDetails={editedStayDetails}
                                    editedStayDetailsError={
                                      editedStayDetailsError
                                    }
                                    editedStayFileName={editedStayFileName}
                                    importingStay={
                                      importingStayTarget === item.id
                                    }
                                    planStartDate={plan.startDate}
                                    planEndDate={plan.endDate}
                                    onToggle={() => onToggle(entry.key)}
                                    onEditedFlightDetailsChange={
                                      onEditedFlightDetailsChange
                                    }
                                    onImportFlight={() => onImportFlight(item.id)}
                                    onSaveFlightDetails={(schedule) =>
                                      onSaveFlightDetails(item.id, schedule)
                                    }
                                    onCancelFlightEdit={onCancelFlightEdit}
                                    onBeginFlightEdit={() =>
                                      onBeginFlightEdit(item.id, item.flight)
                                    }
                                    onEditedRentalDetailsChange={
                                      onEditedRentalDetailsChange
                                    }
                                    onImportRental={() => onImportRental(item.id)}
                                    onSaveRentalDetails={(schedule) =>
                                      onSaveRentalDetails(item.id, schedule)
                                    }
                                    onCancelRentalEdit={onCancelRentalEdit}
                                    onBeginRentalEdit={() =>
                                      onBeginRentalEdit(item.id, item.rental)
                                    }
                                    onEditedStayDetailsChange={
                                      onEditedStayDetailsChange
                                    }
                                    onImportStay={() => onImportStay(item.id)}
                                    onSaveStayDetails={(schedule) =>
                                      onSaveStayDetails(item.id, schedule)
                                    }
                                    onCancelStayEdit={onCancelStayEdit}
                                    onBeginStayEdit={() =>
                                      onBeginStayEdit(item.id, item.stay)
                                    }
                                    onBeginItemEdit={
                                      onBeginItemEdit
                                        ? () => onBeginItemEdit(item)
                                        : undefined
                                    }
                                    onAddPhotos={() => onAddPhotos(item.id)}
                                    onRemovePhoto={(uri) =>
                                      onRemovePhoto(item.id, uri)
                                    }
                                    onRemove={() => onRemove(item)}
                                    onSaveNotes={(notes) =>
                                      onSaveNotes(item.id, notes)
                                    }
                                  />
                                </View>
                              </View>
                            );
                          })}
                        </TravelHomeGlass>
                      </View>
                    </CollapsibleBody>
                  </View>
                </View>
              </View>
            </View>
        );
      })}
    </View>
  );
}


const styles = StyleSheet.create({
  timeline: {},
  dayConnector: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  dayBody: {
    flex: 1,
    minWidth: 0,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minWidth: 0,
  },
  dayContent: {
    flex: 1,
    minWidth: 0,
  },
  eventStack: {
    width: '100%',
    minWidth: 0,
  },
  nowInStack: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
  },
  nowInStackLabel: {
    flexShrink: 1,
    minWidth: 0,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  eventShell: {
    width: '100%',
    minWidth: 0,
  },
  spineColumn: {
    alignItems: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  dayMarker: {
    zIndex: 1,
  },
  spineLine: {
    position: 'absolute',
    width: 2,
    borderRadius: 1,
  },
  emptyCard: {
    alignItems: 'flex-start',
  },
  emptyIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
