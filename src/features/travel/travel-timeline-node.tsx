import Animated from 'react-native-reanimated';

import { useSettledListLayout } from '@/components/primitives';
import { useAuthSession } from '@/features/auth/auth-provider';
import {
    resolveStayBookingOpen,
    type StayBookingOpen,
} from '@/features/travel/booking-open';
import { BookingOpenSheet } from '@/features/travel/booking-open-sheet';
import { flightItineraryCaptionParts } from '@/features/travel/flight-arrival';
import { flightItemDisplayTitle } from '@/features/travel/flight-route-label';
import { itineraryShareCueLabel } from '@/features/travel/itinerary-visibility';
import { openAddressWithMapsChooser } from '@/features/travel/open-address-with-maps';
import {
    TRAVEL_TITLE_ICON_GAP,
    travelEditorialTextStyle,
} from '@/features/travel/travel-chrome';
import { TravelHomeGlass } from '@/features/travel/travel-home-glass';
import { TravelItemNotesSheet } from '@/features/travel/travel-item-notes-sheet';
import {
    kindAccent,
    kindIcon,
} from '@/features/travel/travel-kind-chrome';
import { resolveTravelPhotoUris } from '@/features/travel/travel-moment-media';
import { TRAVEL_CARD_SHADOW } from '@/features/travel/travel-surface';
import {
    flightCaptionInput,
    timelineEntryCaption,
} from '@/features/travel/travel-timeline-entries';
import { TravelTimelineNodeBody } from '@/features/travel/travel-timeline-node-body';
import type { TravelTimelineNodeProps } from '@/features/travel/travel-timeline-node-props';
import { travelTimelineNodeStyles as styles } from '@/features/travel/travel-timeline-node-styles';
import { useTravelItineraryMistProps, useTravelItineraryOnGlass, useTravelItineraryInk } from '@/features/travel/use-travel-itinerary-glass';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
import { openInAppBrowser } from '@/utils/safe-url';
import { useState } from 'react';

export function TravelTimelineNode({
  item,
  plan,
  expanded,
  dateDisplayFormat,
  phase = 'default',
  displayTitle,
  entryDate,
  entryStartMinutes,
  showKindBadge = true,
  compact = false,
  dense = false,
  leadingTimeLabel,
  allowStructuredEditing = true,
  showStructuredDetails = true,
  /** Kept for call-site compatibility; page reveal owns entrance motion. */
  index: _index = 0,
  accentColor,
  editingFlightItemId,
  editedFlightDetails,
  editedFlightDetailsError,
  editedFlightFileName,
  importingFlight,
  editingRentalItemId,
  editedRentalDetails,
  editedRentalDetailsError,
  editedRentalFileName,
  importingRental,
  editingStayItemId,
  editedStayDetails,
  editedStayDetailsError,
  editedStayFileName,
  importingStay,
  planStartDate,
  planEndDate,
  onToggle,
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
  onSaveTransportDetails,
  onBeginItemEdit,
  onAddPhotos,
  onRemove,
  onSaveNotes,
}: TravelTimelineNodeProps) {
  const theme = useTheme();
  const { layout: nodeLayout, onLayout: onNodeLayout } = useSettledListLayout();
  const { s, spacing: rs, typography } = useResponsive();
  const { user } = useAuthSession();
  /** Tight leading so dense mist-row glyphs sit in the vertical center of the row. */
  const denseChromeLineHeight = Math.round(typography.caption.fontSize + 1);
  const denseChromeTextStyle = {
    ...travelEditorialTextStyle,
    lineHeight: denseChromeLineHeight,
  };
  const localUserId = user?.id;
  const shareCue = itineraryShareCueLabel(item, localUserId);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editingTransport, setEditingTransport] = useState(false);
  const [bookingOpen, setBookingOpen] = useState<Extract<
    StayBookingOpen,
    { mode: 'webview' }
  > | null>(null);
  const isExpanded = expanded;
  const title =
    displayTitle ??
    (item.kind === 'flight' ? flightItemDisplayTitle(item) : item.title);
  const caption = timelineEntryCaption(
    {
      key: item.id,
      item,
      phase,
      date: entryDate ?? item.date,
      startMinutes: entryStartMinutes ?? item.startMinutes,
      title,
    },
    dateDisplayFormat,
  );
  const flightCaption =
    item.kind === 'flight'
      ? flightItineraryCaptionParts(flightCaptionInput(item, dateDisplayFormat))
      : undefined;
  const boardCardScheduleLabel = flightCaption
    ? [flightCaption.dateLabel, flightCaption.durationLabel, flightCaption.stopsLabel]
        .filter(Boolean)
        .join(' · ')
    : caption;
  const toggleLabel =
    dense && leadingTimeLabel
      ? `${leadingTimeLabel}. ${title}`
      : compact && !dense && boardCardScheduleLabel
        ? `${title}. ${boardCardScheduleLabel}`
        : title;
  const toggleAgent = useAgentUiTarget(
    AgentUiIds.travel.timelineItem.toggle(item.id, phase),
    { label: toggleLabel, onPress: onToggle },
  );
  const addressAgent = useAgentUiTarget(
    item.kind === 'stay' && item.details && isExpanded
      ? AgentUiIds.travel.timelineItem.openAddress(item.id)
      : undefined,
    {
      label: item.details ? `Open address ${item.details}` : undefined,
      onPress: () => {
        if (!item.details) return;
        openAddressWithMapsChooser(item.details);
      },
    },
  );

  const openBooking = () => {
    const resolved = resolveStayBookingOpen(item, {
      fallbackEmail: user?.email ?? undefined,
    });
    if (!resolved) return;
    if (resolved.mode === 'webview') {
      setBookingOpen(resolved);
      return;
    }
    void openInAppBrowser(resolved.url);
  };
  const isMoment = item.kind === 'moment';
  const isStructuredTravelKind =
    item.kind === 'flight' ||
    item.kind === 'transport' ||
    item.kind === 'rental' ||
    item.kind === 'stay';
  const editingFlight =
    allowStructuredEditing && editingFlightItemId === item.id;
  const editingRental =
    allowStructuredEditing && editingRentalItemId === item.id;
  const editingStay = allowStructuredEditing && editingStayItemId === item.id;
  const editingStructured =
    editingFlight || editingTransport || editingRental || editingStay;
  const photos = resolveTravelPhotoUris(item.photoUris);
  const icon = kindIcon(item.kind);
  // Transport board cards (flights/ground/stays/rentals) share one compact chrome.
  // Timeline day markers also pass `compact` with `dense` and keep smaller chrome.
  const isCompactBoardCard = compact && !dense && isStructuredTravelKind;
  // Dense day rows / board cards sit on mist. Dark / artwork-tinted boards
  // need light ink + dark-palette kind accents (readable blues on teal glass).
  const darkGlass = useTravelItineraryOnGlass();
  const mistProps = useTravelItineraryMistProps();
  const primaryInk = useTravelItineraryInk();
  const secondaryInk = useTravelItineraryInk('secondary');
  const tertiaryInk = useTravelItineraryInk('tertiary');
  const accent =
    accentColor ?? kindAccent(item.kind, theme, { darkGlass });
  const onGlass = (isCompactBoardCard || dense) && darkGlass;
  const isCompactFlight = isCompactBoardCard && item.kind === 'flight';
  const showKindBadgeResolved = showKindBadge;
  // Board cards always surface schedule meta under the title (including after a
  // “Company · Location” split) so pickup/drop-off / check-in/out dates stay visible.
  // Dense timeline keeps the title row single-line; caption stacks under the icon+title.
  const showHeaderCaption = isCompactBoardCard
    ? Boolean(flightCaption) || Boolean(caption)
    : compact &&
      !dense &&
      isStructuredTravelKind &&
      isExpanded &&
      Boolean(caption);
  const showDenseMeta = dense && isExpanded && Boolean(caption);
  const toolbarActionSize = Math.max(28, s(28));
  const compactActionSize = Math.max(32, s(34));
  const kindPillSize = dense
    ? Math.max(22, s(22))
    : isCompactBoardCard
      ? compactActionSize
      : compact
        ? Math.max(28, s(30))
        : Math.max(28, s(28));
  const boardIconSize = isCompactBoardCard ? 12 : compact ? 10 : 12;
  const denseIconGap = Math.max(TRAVEL_TITLE_ICON_GAP, s(TRAVEL_TITLE_ICON_GAP));
  const hasDenseTimeSlot = dense && leadingTimeLabel !== undefined;
  const denseTimeWidth = hasDenseTimeSlot ? Math.max(58, s(60)) : 0;
  /** Dense timeline: caption/actions stack under the title, indented past time + icon. */
  const denseDetailsInset =
    denseTimeWidth +
    (hasDenseTimeSlot ? denseIconGap : 0) +
    (showKindBadgeResolved ? kindPillSize + denseIconGap : 0);
  // Dense rows sit in a parent mist stack (transparent). Board + other cards use mist.
  const useMistShell = !dense;
  const collapsedBoardMinHeight = Math.max(64, s(68));
  const cardRadius = dense
    ? 0
    : isCompactBoardCard
      ? Math.max(16, s(18))
      : compact
        ? Math.max(10, s(11))
        : 13;

  const nodeBody = (
    <TravelTimelineNodeBody
      item={item}
      isExpanded={isExpanded}
      dense={dense}
      compact={compact}
      isCompactBoardCard={isCompactBoardCard}
      isCompactFlight={isCompactFlight}
      isMoment={isMoment}
      isStructuredTravelKind={isStructuredTravelKind}
      title={title}
      caption={caption}
      flightCaption={flightCaption}
      shareCue={shareCue}
      photos={photos}
      icon={icon}
      accent={accent}
      onGlass={onGlass}
      primaryInk={primaryInk}
      secondaryInk={secondaryInk}
      tertiaryInk={tertiaryInk}
      mistProps={mistProps}
      showKindBadgeResolved={showKindBadgeResolved}
      showHeaderCaption={showHeaderCaption}
      showDenseMeta={showDenseMeta}
      showStructuredDetails={showStructuredDetails}
      allowStructuredEditing={allowStructuredEditing}
      hasDenseTimeSlot={hasDenseTimeSlot}
      leadingTimeLabel={leadingTimeLabel}
      denseTimeWidth={denseTimeWidth}
      denseIconGap={denseIconGap}
      denseDetailsInset={denseDetailsInset}
      denseChromeTextStyle={denseChromeTextStyle}
      kindPillSize={kindPillSize}
      boardIconSize={boardIconSize}
      compactActionSize={compactActionSize}
      toolbarActionSize={toolbarActionSize}
      collapsedBoardMinHeight={collapsedBoardMinHeight}
      rs={rs}
      s={s}
      toggleAgent={toggleAgent}
      addressAgent={addressAgent}
      onToggle={onToggle}
      editingFlight={editingFlight}
      editingRental={editingRental}
      editingStay={editingStay}
      editingTransport={editingTransport}
      editingStructured={editingStructured}
      dateDisplayFormat={dateDisplayFormat}
      editedFlightDetails={editedFlightDetails}
      editedFlightDetailsError={editedFlightDetailsError}
      editedFlightFileName={editedFlightFileName}
      importingFlight={importingFlight}
      editedRentalDetails={editedRentalDetails}
      editedRentalDetailsError={editedRentalDetailsError}
      editedRentalFileName={editedRentalFileName}
      importingRental={importingRental}
      editedStayDetails={editedStayDetails}
      editedStayDetailsError={editedStayDetailsError}
      editedStayFileName={editedStayFileName}
      importingStay={importingStay}
      planStartDate={planStartDate}
      planEndDate={planEndDate}
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
      onSaveTransportDetails={onSaveTransportDetails}
      onBeginItemEdit={onBeginItemEdit}
      onAddPhotos={onAddPhotos}
      onRemove={onRemove}
      setEditingTransport={setEditingTransport}
      setNotesOpen={setNotesOpen}
      openBooking={openBooking}
    />
  );

  return (
    <Animated.View
      layout={nodeLayout}
      onLayout={onNodeLayout}
      style={[
        styles.nodeCard,
        {
          borderRadius: cardRadius,
          borderCurve: 'continuous',
          // Mist glass clips itself — parent overflow:hidden kills iOS frost.
          overflow: useMistShell ? 'visible' : 'hidden',
          boxShadow: useMistShell && !isCompactBoardCard ? TRAVEL_CARD_SHADOW : undefined,
        },
      ]}>
      {useMistShell ? (
        <TravelHomeGlass
          {...mistProps}
          style={[
            styles.nodeCard,
            {
              borderRadius: cardRadius,
              borderCurve: 'continuous',
            },
          ]}>
          {nodeBody}
        </TravelHomeGlass>
      ) : (
        nodeBody
      )}
      <TravelItemNotesSheet
        plan={plan}
        item={item}
        visible={notesOpen}
        onClose={() => setNotesOpen(false)}
        onSaveNotes={(notes) => {
          onSaveNotes(notes);
        }}
      />
      <BookingOpenSheet
        target={bookingOpen}
        onClose={() => setBookingOpen(null)}
      />
    </Animated.View>
  );
}
