import { StyleSheet, View } from 'react-native';

import { AppText, CollapsibleBody, Symbol } from '@/components/primitives';
import { radii } from '@/design-system';
import type { FlightDetailsDraft } from '@/features/travel/flight-details';
import type { RentalDetailsDraft } from '@/features/travel/rental-details';
import type { StayDetailsDraft } from '@/features/travel/stay-details';
import { travelEditorialTextStyle } from '@/features/travel/travel-chrome';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import {
  dayNumberFor,
  daySpineColor,
  TimelineDayBridge,
  TimelineDayHeader,
} from '@/features/travel/travel-timeline-day-chrome';
import { TravelTimelineFocusAnchor } from '@/features/travel/travel-timeline-focus-anchor';
import { TravelTimelineNode } from '@/features/travel/travel-timeline-node';
import {
  isTimelineEntryPast,
  timelineDayPhase,
} from '@/features/travel/travel-timeline-progress';
import { TimelineNowMarker } from '@/features/travel/travel-timeline-progress-chrome';
import type { TravelPlan } from '@/features/travel/types';
import {
  formatDateKeyMedium,
  formatMinutes,
  formatWeekday,
  type DateDisplayFormat,
} from '@/utils/date';
import { travelItineraryTimelineStyles as styles } from './travel-itinerary-timeline-styles';

export function TravelItineraryTimelineDays(p: Record<string, any>) {
  const {
    plan,
    days,
    now,
    collapsedDayDates,
    dayGap,
    dayBodyPadLeft,
    spineWidth,
    dayMarkerSize,
    rs,
    s,
    theme,
    mistProps,
    primaryInk,
    typography,
    dayTap,
    dateDisplayFormat,
    minimizedItemIds,
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
  } = p;

  return (
    <>
      {days.map((day: any, dayIndex: number) => {
        const zone = day.zone as 'pre' | 'trip' | 'post' | undefined;
        const dayNumber =
          zone === 'trip' || !zone
            ? dayNumberFor(plan.startDate, day.date)
            : 0;
        const rangeStart = (day.rangeStart as string | undefined) ?? day.date;
        const rangeEnd = (day.rangeEnd as string | undefined) ?? day.date;
        const dateLabel =
          rangeStart === rangeEnd
            ? formatDateKeyMedium(rangeStart)
            : `${formatDateKeyMedium(rangeStart)} – ${formatDateKeyMedium(rangeEnd)}`;
        const weekday =
          zone === 'pre'
            ? 'Before the trip'
            : zone === 'post'
              ? 'After the trip'
              : formatWeekday(day.date);
        const titleLabel =
          zone === 'pre' ? 'Pre-trip' : zone === 'post' ? 'Post Trip' : undefined;
        const dayExpanded = !collapsedDayDates.has(day.date);
        const entryCount = day.entries.length;
        const dayPhase = timelineDayPhase(day.date, day.entries, now);
        const spineColor = daySpineColor(dayIndex, theme.name);
        const prevSpineColor =
          dayIndex > 0 ? daySpineColor(dayIndex - 1, theme.name) : spineColor;
        const firstUpcomingIndex =
          dayPhase === 'current'
            ? day.entries.findIndex((entry: any) => !isTimelineEntryPast(entry, now))
            : -1;
        return (
          <View key={day.date}>
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
                      titleLabel={titleLabel}
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
                          {day.entries.map((entry: any, index: number) => {
                            const { item } = entry;
                            const prevMinutes =
                              index > 0
                                ? day.entries[index - 1].startMinutes
                                : undefined;
                            const showTime = prevMinutes !== entry.startMinutes;
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
                                <TravelTimelineFocusAnchor
                                  active={
                                    Boolean(pendingFocusEntryKey) &&
                                    pendingFocusEntryKey === entry.key
                                  }
                                  scrollRef={scrollRef}
                                  scrollOffsetYRef={scrollOffsetYRef}
                                  onHandled={onFocusEntryHandled}>
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
                                    onRemove={() => onRemove(item)}
                                    onSaveNotes={(notes) =>
                                      onSaveNotes(item.id, notes)
                                    }
                                  />
                                </View>
                                </TravelTimelineFocusAnchor>
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
    </>
  );
}
