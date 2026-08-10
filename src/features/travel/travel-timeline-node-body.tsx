import { Pressable, View } from 'react-native';

import {
  AppText,
  CollapsibleBody,
  DisclosureChevron,
  GlassIconWell,
  GlassPlate,
  Symbol,
} from '@/components/primitives';
import { radii } from '@/design-system';
import { AirlineLogo } from '@/features/travel/airline-logo';
import { openAddressWithMapsChooser } from '@/features/travel/open-address-with-maps';
import { RentalCompanyLogo } from '@/features/travel/rental-company-logo';
import { StayLocationThumbnail } from '@/features/travel/stay-location-thumbnail';
import { TRAVEL_TITLE_ICON_GAP } from '@/features/travel/travel-chrome';
import {
  PhotoStrip,
  TimelineFlightCaption,
  TimelineItemTitle,
} from '@/features/travel/travel-timeline-node-chrome';
import type { TravelTimelineNodeBodyProps } from '@/features/travel/travel-timeline-node-body-props';
import { travelTimelineNodeStyles as styles } from '@/features/travel/travel-timeline-node-styles';
import { TravelTimelineNodeStructured } from '@/features/travel/travel-timeline-node-structured';

export type { TravelTimelineNodeBodyProps } from '@/features/travel/travel-timeline-node-body-props';

export function TravelTimelineNodeBody(props: TravelTimelineNodeBodyProps) {
  const {
    item,
    isExpanded,
    dense,
    compact,
    isCompactBoardCard,
    isCompactFlight,
    isMoment,
    isStructuredTravelKind,
    title,
    caption,
    flightCaption,
    shareCue,
    photos,
    icon,
    accent,
    onGlass,
    primaryInk,
    secondaryInk,
    tertiaryInk,
    mistProps,
    showKindBadgeResolved,
    showHeaderCaption,
    showDenseMeta,
    showStructuredDetails,
    allowStructuredEditing,
    hasDenseTimeSlot,
    leadingTimeLabel,
    denseTimeWidth,
    denseIconGap,
    denseDetailsInset,
    denseChromeTextStyle,
    kindPillSize,
    boardIconSize,
    compactActionSize,
    toolbarActionSize,
    collapsedBoardMinHeight,
    rs,
    s,
    toggleAgent,
    addressAgent,
    onToggle,
    editingFlight,
    editingRental,
    editingStay,
    editingTransport,
    editingStructured,
    dateDisplayFormat,
    editedFlightDetails,
    editedFlightDetailsError,
    editedFlightFileName,
    importingFlight,
    editedRentalDetails,
    editedRentalDetailsError,
    editedRentalFileName,
    importingRental,
    editedStayDetails,
    editedStayDetailsError,
    editedStayFileName,
    importingStay,
    planStartDate,
    planEndDate,
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
    onRemovePhoto,
    onRemove,
    setEditingTransport,
    setNotesOpen,
    openBooking,
  } = props;

  return (

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
              item.kind === 'stay' ? (
                <StayLocationThumbnail
                  size={kindPillSize}
                  title={item.title}
                  address={item.details}
                  bookingUrl={item.bookingUrl}
                  photoUris={item.photoUris}
                  fallbackIconSize={boardIconSize}
                  fallbackColor={accent}
                />
              ) : (
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
                  ) : (
                    <Symbol name={icon} size={boardIconSize} color={accent} />
                  )}
                </GlassIconWell>
              )
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
                    {...(flightCaption as any)}
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
              onBeginItemEdit={onBeginItemEdit}
              onOpenNotes={() => setNotesOpen(true)}
              onAddPhotos={onAddPhotos}
              onOpenBooking={openBooking}
              onRemove={onRemove}
            />
          </View>
        </CollapsibleBody>
      </View>
  );
}
