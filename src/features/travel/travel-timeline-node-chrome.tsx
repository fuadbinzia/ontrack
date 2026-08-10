import { StyleSheet, View } from 'react-native';

import { AppText, IconButton } from '@/components/primitives';
import { spacing } from '@/design-system';
import { travelEditorialTextStyle } from '@/features/travel/travel-chrome';
import { TravelItemNotesButton } from '@/features/travel/travel-item-notes-sheet';
import type { TravelItineraryItem } from '@/features/travel/types';
import {
    useTravelItineraryInk,
} from '@/features/travel/use-travel-itinerary-glass';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import { AgentUiIds } from '@/utils/agent-ui';
import { isHttpsUrl } from '@/utils/safe-url';

export { PhotoStrip } from '@/features/travel/travel-photo-strip';

export function validBookingUrl(value: string): boolean {
  return !value || isHttpsUrl(value);
}

/** Split “Company · Location” titles so the location is readable on its own line. */
export function TimelineItemTitle({
  title,
  compact = false,
  dense = false,
  emphasize = false,
  align = 'left',
  onGlass = false,
}: {
  title: string;
  compact?: boolean;
  dense?: boolean;
  /** Larger route header used by compact flight cards. */
  emphasize?: boolean;
  /** Center title copy in compact board cards. */
  align?: 'left' | 'center';
  /** Mist / artwork-dark boards — still passed for callers; ink is luminance-aware. */
  onGlass?: boolean;
}) {
  const { typography } = useResponsive();
  const primaryInk = useTravelItineraryInk();
  const secondaryInk = useTravelItineraryInk('secondary');
  const primaryVariant = dense
    ? 'caption'
    : emphasize
      ? 'heading'
      : compact
        ? 'callout'
        : 'subheading';
  // Dense mist rows: caption lineHeight leaves glyphs high in the box so the
  // title+cue stack looks top-heavy next to the kind pill — keep leading tight.
  const denseLine =
    dense && typography.caption.fontSize
      ? {
          lineHeight: Math.round(typography.caption.fontSize + 1),
        }
      : undefined;
  const separator = ' · ';
  const breakAt = title.indexOf(separator);
  if (breakAt <= 0) {
    return (
      <AppText
        variant={primaryVariant}
        bold={emphasize}
        fit
        align={align}
        style={[
          styles.editorial,
          compact && !emphasize ? styles.compactTitle : undefined,
          align === 'center' ? styles.fullWidthCopy : undefined,
          denseLine,
          { color: primaryInk },
        ]}>
        {title}
      </AppText>
    );
  }
  const head = title.slice(0, breakAt);
  const tail = title.slice(breakAt + separator.length);
  return (
    <View
      style={[
        styles.titleStack,
        align === 'center' ? styles.centeredStack : undefined,
        dense ? styles.denseTitleStack : undefined,
      ]}>
      <AppText
        variant={primaryVariant}
        fit
        align={align}
        style={[
          styles.editorial,
          compact ? styles.compactTitle : undefined,
          align === 'center' ? styles.fullWidthCopy : undefined,
          denseLine,
          { color: primaryInk },
        ]}>
        {head}
      </AppText>
      <AppText
        variant={compact ? 'caption' : 'subheading'}
        fit
        align={align}
        style={[
          styles.editorial,
          align === 'center' ? styles.fullWidthCopy : undefined,
          denseLine,
          { color: onGlass || compact ? secondaryInk : primaryInk },
        ]}>
        {tail}
      </AppText>
    </View>
  );
}

/** Compact flight meta under the route: `Sep 27 · 9h 59m total · 1 stop`. */
export function TimelineFlightCaption({
  dateLabel,
  durationLabel,
  stopsLabel,
  align = 'left',
}: {
  dateLabel: string;
  durationLabel: string;
  stopsLabel: string;
  align?: 'left' | 'center';
  /** @deprecated Ink follows artwork luminance via shared hooks. */
  onGlass?: boolean;
}) {
  const secondaryInk = useTravelItineraryInk('secondary');
  return (
    <AppText
      variant="caption"
      fit
      align={align}
      style={[
        align === 'center' ? styles.fullWidthCopy : undefined,
        { color: secondaryInk },
      ]}>
      {[dateLabel, durationLabel, stopsLabel].join(' · ')}
    </AppText>
  );
}

/** Icon row under an expanded itinerary item: notes, photos, share, edit, open, remove. */
export function TimelineItemToolbar({
  item,
  size,
  allowStructuredEditing,
  showStructuredDetails,
  isMoment,
  align = 'center',
  onGlass = false,
  onOpenNotes,
  onAddPhotos,
  onBeginFlightEdit,
  onBeginRentalEdit,
  onBeginStayEdit,
  onBeginTransportEdit,
  onBeginItemEdit,
  onOpenBooking,
  onRemove,
}: {
  item: TravelItineraryItem;
  size: number;
  allowStructuredEditing: boolean;
  showStructuredDetails: boolean;
  isMoment: boolean;
  /** Dense timeline stacks actions under the title — left-align with that column. */
  align?: 'center' | 'left';
  /** Mist / black-glass parents — frost wells + light glyphs. */
  onGlass?: boolean;
  onOpenNotes: () => void;
  onAddPhotos: () => void;
  onBeginFlightEdit: () => void;
  onBeginRentalEdit: () => void;
  onBeginStayEdit: () => void;
  onBeginTransportEdit: () => void;
  /** Opens the itinerary sheet to edit a moment/activity. */
  onBeginItemEdit?: () => void;
  onOpenBooking: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const { spacing: rs } = useResponsive();
  const primaryInk = useTravelItineraryInk();
  // IconButton defaults to glass — only override ink on dark mist boards.
  const shared = {
    size,
    iconSize: 'sm' as const,
    color: onGlass ? primaryInk : undefined,
  };
  const canEdit = (kind: TravelItineraryItem['kind']) =>
    allowStructuredEditing && item.kind === kind;
  const canEditSimpleStop =
    Boolean(onBeginItemEdit) &&
    (item.kind === 'moment' ||
      item.kind === 'activity' ||
      item.kind === 'event');

  return (
    <View
      style={[
        styles.toolbarWrap,
        align === 'left' ? styles.toolbarWrapLeft : undefined,
      ]}>
      <View
        style={[
          styles.toolbar,
          { gap: Math.max(8, rs.xs) },
          align === 'left' ? styles.toolbarLeft : undefined,
        ]}>
        <TravelItemNotesButton
          hasNotes={(item.notes?.length ?? 0) > 0}
          size={size}
          iconSize="sm"
          onGlass={onGlass}
          testID={AgentUiIds.travel.notes.open(item.id)}
          onPress={onOpenNotes}
        />
        <IconButton
          {...shared}
          icon="photo"
          accessibilityLabel="Add Photos"
          onPress={onAddPhotos}
        />
        {canEdit('flight') ? (
          <IconButton
            {...shared}
            testID={AgentUiIds.travel.timelineItem.editFlight(item.id)}
            icon="edit"
            accessibilityLabel={
              item.flight ? 'Edit Flight' : 'Add Flight Details'
            }
            onPress={onBeginFlightEdit}
          />
        ) : null}
        {canEdit('rental') ? (
          <IconButton
            {...shared}
            icon="edit"
            accessibilityLabel={
              item.rental ? 'Edit Rental' : 'Add Rental Details'
            }
            onPress={onBeginRentalEdit}
          />
        ) : null}
        {canEdit('transport') ? (
          <IconButton
            {...shared}
            icon="edit"
            accessibilityLabel="Edit Transport Details"
            testID={AgentUiIds.travel.transport.edit(item.id)}
            onPress={onBeginTransportEdit}
          />
        ) : null}
        {canEdit('stay') ? (
          <IconButton
            {...shared}
            icon="edit"
            accessibilityLabel={item.stay ? 'Edit Stay' : 'Add Stay Details'}
            onPress={onBeginStayEdit}
          />
        ) : null}
        {canEditSimpleStop && onBeginItemEdit ? (
          <IconButton
            {...shared}
            icon="edit"
            accessibilityLabel={
              item.kind === 'moment'
                ? 'Edit Moment'
                : item.kind === 'event'
                  ? 'Edit Event'
                  : 'Edit Activity'
            }
            testID={AgentUiIds.travel.timelineItem.edit(item.id)}
            onPress={onBeginItemEdit}
          />
        ) : null}
        {showStructuredDetails &&
        item.bookingUrl &&
        validBookingUrl(item.bookingUrl) ? (
          <IconButton
            {...shared}
            icon="open-external"
            accessibilityLabel="Open Booking"
            onPress={onOpenBooking}
          />
        ) : null}
        {isMoment ||
        (item.kind !== 'flight' &&
          item.kind !== 'rental' &&
          item.kind !== 'stay') ? (
          <IconButton
            {...shared}
            icon="delete"
            color={theme.danger}
            testID={AgentUiIds.travel.removeConfirm.open}
            accessibilityLabel={`Remove ${item.title}`}
            onPress={onRemove}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleStack: { gap: spacing.xxs, minWidth: 0, flexShrink: 1, width: '100%' },
  denseTitleStack: { gap: 0 },
  centeredStack: { alignItems: 'center', alignSelf: 'stretch' },
  fullWidthCopy: { width: '100%', alignSelf: 'stretch' },
  editorial: { ...travelEditorialTextStyle },
  toolbarWrap: { width: '100%', alignItems: 'center' },
  toolbarWrapLeft: { alignItems: 'flex-start' },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarLeft: { justifyContent: 'flex-start' },
  compactTitle: { fontWeight: '400' },
});
