import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import {
    AppText,
    CollapsibleBody,
    DisclosureChevron,
    GlassIconWell,
    GlassPlate,
    Symbol,
} from '@/components/primitives';
import { motion, radii, spacing } from '@/design-system';
import { useAuthSession } from '@/features/auth/auth-provider';
import { AirlineLogo } from '@/features/travel/airline-logo';
import {
    resolveStayBookingOpen,
    type StayBookingOpen,
} from '@/features/travel/booking-open';
import { BookingOpenSheet } from '@/features/travel/booking-open-sheet';
import { flightItineraryCaptionParts } from '@/features/travel/flight-arrival';
import { flightItemDisplayTitle } from '@/features/travel/flight-route-label';
import {
    isItineraryItemOwnedBy,
    itineraryShareCueLabel,
} from '@/features/travel/itinerary-visibility';
import { openAddressWithMapsChooser } from '@/features/travel/open-address-with-maps';
import { RentalCompanyLogo } from '@/features/travel/rental-company-logo';
import { StayLocationThumbnail } from '@/features/travel/stay-location-thumbnail';
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
import {
    PhotoStrip,
    TimelineFlightCaption,
    TimelineItemTitle,
} from '@/features/travel/travel-timeline-node-chrome';
import { useTravelItineraryMistProps, useTravelItineraryOnGlass, useTravelItineraryInk } from '@/features/travel/use-travel-itinerary-glass';
import type { TravelTimelineNodeProps } from '@/features/travel/travel-timeline-node-props';
import { TravelTimelineNodeStructured } from '@/features/travel/travel-timeline-node-structured';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds, useAgentUiTarget } from '@/utils/agent-ui';
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
  onAddPhotos,
  onRemovePhoto,
  onRemove,
  onSaveNotes,
  onShare,
}: TravelTimelineNodeProps) {
  const theme = useTheme();
  const { s, spacing: rs, typography } = useResponsive();
  const { user } = useAuthSession();
  /** Tight leading so dense mist-row glyphs sit in the vertical center of the row. */
  const denseChromeLineHeight = Math.round(typography.caption.fontSize + 1);
  const denseChromeTextStyle = {
    ...travelEditorialTextStyle,
    lineHeight: denseChromeLineHeight,
  };
  const localUserId = user?.id;
  const ownsItem = isItineraryItemOwnedBy(item, localUserId);
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
    void WebBrowser.openBrowserAsync(resolved.url);
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
      <View
        style={[
          styles.nodeBody,
          {
            padding:
              isExpanded && !dense
                ? rs.md
                : isCompactBoardCard
                  ? rs.md
                  : compact && !dense
                    ? undefined
                    : dense
                      ? undefined
                      : rs.sm,
            paddingHorizontal:
              !isExpanded && compact && !dense && !isCompactBoardCard
                ? rs.sm
                : dense
                  ? 0
                  : undefined,
            paddingVertical:
              !isExpanded && dense
                ? 0
                : !isExpanded && compact && !isCompactBoardCard
                  ? rs.xxs
                  : undefined,
            // Collapsed dense rows keep a zero-height CollapsibleBody sibling —
            // gap would bias the header toward the top of the event shell.
            gap:
              dense && !isExpanded && photos.length === 0
                ? 0
                : dense
                  ? rs.xs
                  : compact
                    ? rs.xs
                    : rs.sm,
            minHeight:
              !isExpanded && isCompactBoardCard
                ? collapsedBoardMinHeight
                : undefined,
            justifyContent:
              !isExpanded && (isCompactBoardCard || dense) ? 'center' : undefined,
          },
        ]}
      >
        <Pressable
          ref={toggleAgent.ref}
          testID={toggleAgent.testID}
          onLayout={toggleAgent.onLayout}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: isExpanded }}
          onPress={onToggle}
          hitSlop={8}
          style={[
            styles.itemHeader,
            {
              gap: dense
                ? denseIconGap
                : isCompactBoardCard || compact
                  ? Math.max(TRAVEL_TITLE_ICON_GAP, s(TRAVEL_TITLE_ICON_GAP))
                  : rs.sm,
              alignItems: dense
                ? 'center'
                : isCompactBoardCard || compact
                  ? 'center'
                  : 'flex-start',
              minHeight:
                !isExpanded && isCompactBoardCard
                  ? collapsedBoardMinHeight - rs.md * 2
                  : undefined,
            },
          ]}
        >
            {hasDenseTimeSlot ? (
              <View style={[styles.denseTime, { width: denseTimeWidth }]}>
                {leadingTimeLabel ? (
                  <AppText
                    variant="caption"
                    fit
                    style={[
                      styles.denseTimeLabel,
                      denseChromeTextStyle,
                      onGlass ? { color: secondaryInk } : undefined,
                    ]}>
                    {leadingTimeLabel}
                  </AppText>
                ) : null}
              </View>
            ) : null}
            {showKindBadgeResolved ? (
              <GlassIconWell
                size={kindPillSize}
                borderRadius={kindPillSize / 2}>
                {dense ? (
                  <Symbol name={icon} size={11} color={accent} />
                ) : item.kind === 'flight' ? (
                  <AirlineLogo
                    airline={item.flight?.airline}
                    flightNumber={item.flight?.flightNumber}
                    fallbackIconSize={boardIconSize}
                    fallbackColor={accent}
                  />
                ) : item.kind === 'rental' && item.rental?.company ? (
                  <RentalCompanyLogo
                    company={item.rental.company}
                    fallbackIconSize={boardIconSize}
                    fallbackColor={accent}
                  />
                ) : item.kind === 'stay' ? (
                  <StayLocationThumbnail
                    title={item.title}
                    address={item.details}
                    bookingUrl={item.bookingUrl}
                    photoUris={item.photoUris}
                    fallbackIconSize={boardIconSize}
                    fallbackColor={accent}
                  />
                ) : (
                  <Symbol name={icon} size={boardIconSize} color={accent} />
                )}
              </GlassIconWell>
            ) : null}
            <View
              style={[
                styles.flex,
                dense
                  ? styles.denseCopy
                  : isCompactBoardCard
                    ? {
                        gap: rs.xxs,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }
                    : null,
              ]}>
              <TimelineItemTitle
                title={title}
                compact={compact}
                dense={dense}
                align={isCompactBoardCard ? 'center' : 'left'}
                onGlass={onGlass}
              />
              {showHeaderCaption ? (
                flightCaption ? (
                  <TimelineFlightCaption
                    {...flightCaption}
                    align={isCompactBoardCard ? 'center' : 'left'}
                    onGlass={onGlass}
                  />
                ) : (
                  <AppText
                    variant="caption"
                    fit
                    align={isCompactBoardCard ? 'center' : undefined}
                    style={[
                      isCompactBoardCard ? styles.centeredCaption : undefined,
                      dense ? denseChromeTextStyle : undefined,
                      { color: secondaryInk },
                    ]}>
                    {caption}
                  </AppText>
                )
              ) : null}
              {shareCue && !isCompactBoardCard ? (
                <AppText
                  variant="caption"
                  fit
                  style={[
                    dense ? denseChromeTextStyle : undefined,
                    { color: secondaryInk },
                  ]}>
                  {shareCue}
                </AppText>
              ) : null}
            </View>
            <View
              style={[
                styles.itemSizeAction,
                {
                  width: dense
                    ? Math.max(18, s(18))
                    : compact
                      ? compactActionSize
                      : Math.max(28, s(32)),
                  height: dense
                    ? Math.max(18, s(18))
                    : compact
                      ? compactActionSize
                      : Math.max(28, s(32)),
                },
              ]}
            >
              <DisclosureChevron
                expanded={isExpanded}
                size={dense || compact ? 10 : 12}
                color={tertiaryInk}
              />
            </View>
        </Pressable>

        {!isExpanded && photos.length > 0 ? (
          <PhotoStrip uris={photos.slice(0, 4)} />
        ) : null}

        <CollapsibleBody expanded={isExpanded}>
          <View
            style={{
              gap: dense ? rs.xs : rs.md,
              paddingLeft: dense ? denseDetailsInset : undefined,
              paddingBottom: dense ? rs.xs : undefined,
            }}
          >
            {showDenseMeta ? (
              <AppText
                variant="caption"
                fit
                style={{ color: secondaryInk }}>
                {caption}
              </AppText>
            ) : null}
            {caption && !showHeaderCaption && !showDenseMeta ? (
              <AppText
                variant="caption"
                style={{ color: primaryInk }}>
                {caption}
              </AppText>
            ) : null}
            {item.details &&
            (!isStructuredTravelKind || showStructuredDetails) ? (
              item.kind === 'stay' ? (
                <Pressable
                  ref={addressAgent.ref}
                  testID={addressAgent.testID}
                  onLayout={addressAgent.onLayout}
                  collapsable={false}
                  accessibilityRole="button"
                  accessibilityLabel={`Open address ${item.details}`}
                  hitSlop={8}
                  onPress={() => {
                    openAddressWithMapsChooser(item.details!);
                  }}
                  style={({ pressed }) => [pressed && styles.pressed]}>
                  <GlassPlate
                    {...mistProps}
                    style={[
                      styles.addressLink,
                      {
                        minHeight: Math.max(48, s(48)),
                        paddingHorizontal: rs.sm,
                        paddingVertical: rs.xs,
                        gap: rs.sm,
                        borderRadius: radii.md,
                      },
                    ]}>
                    <Symbol name="location" size="sm" color={accent} />
                    <View style={styles.addressCopy}>
                      <AppText
                        variant="callout"
                        selectable
                        style={{ color: primaryInk }}>
                        {item.details}
                      </AppText>
                    </View>
                    <Symbol name="open-external" size="sm" color={accent} />
                  </GlassPlate>
                </Pressable>
              ) : (
                <AppText
                  variant="body"
                  style={{ color: secondaryInk }}>
                  {item.details}
                </AppText>
              )
            ) : null}

            <PhotoStrip uris={photos} onRemove={onRemovePhoto} />

            <TravelTimelineNodeStructured
              item={item}
              dateDisplayFormat={dateDisplayFormat}
              allowStructuredEditing={allowStructuredEditing}
              showStructuredDetails={showStructuredDetails}
              isMoment={isMoment}
              isCompactFlight={isCompactFlight}
              editingFlight={editingFlight}
              editingRental={editingRental}
              editingStay={editingStay}
              editingTransport={editingTransport}
              editingStructured={editingStructured}
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
              toolbarActionSize={toolbarActionSize}
              canShare={ownsItem && Boolean(onShare)}
              dense={dense}
              onGlass={onGlass}
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
              onBeginTransportEdit={() => setEditingTransport(true)}
              onCancelTransportEdit={() => setEditingTransport(false)}
              onOpenNotes={() => setNotesOpen(true)}
              onAddPhotos={onAddPhotos}
              onShare={onShare}
              onOpenBooking={openBooking}
              onRemove={onRemove}
            />
          </View>
        </CollapsibleBody>
      </View>
  );

  return (
    <Animated.View
      layout={LinearTransition.duration(motion.layout)}
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

const styles = StyleSheet.create({
  nodeCard: {
    flex: 1,
    minWidth: 0,
  },
  nodeBody: {
    flex: 1,
    minWidth: 0,
  },
  addressLink: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  addressCopy: { flex: 1, minWidth: 0, flexShrink: 1 },
  itemSizeAction: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center' },
  denseTime: {
    flexShrink: 0,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  denseTimeLabel: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'left',
  },
  pressed: { opacity: 0.6 },
  flex: { flex: 1, minWidth: 0, flexShrink: 1, gap: spacing.xxs },
  denseCopy: {
    gap: 0,
    justifyContent: 'center',
  },
  centeredCaption: { textAlign: 'center', width: '100%' },
});
