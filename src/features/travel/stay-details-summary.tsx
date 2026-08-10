import { StayLocationThumbnail } from '@/features/travel/stay-location-thumbnail';
import { kindAccent } from '@/features/travel/travel-kind-chrome';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/hooks/use-theme';
import {
    formatDateKeyMedium,
    formatMinutes,
    type DateDisplayFormat,
} from '@/utils/date';

import {
    confirmationUrisForDisplay,
    openConfirmationAttachments,
} from './confirmation-attachments';
import { ConfirmationDocumentCue } from './confirmation-document-cue';
import { TravelDetailsSummaryCard } from './travel-details-summary-card';
import type { TravelStayDetails } from './types';

function formatStamp(
  date: string | undefined,
  minutes: number | undefined,
): string | undefined {
  const parts = [
    date ? formatDateKeyMedium(date) : undefined,
    minutes !== undefined ? formatMinutes(minutes) : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

export function StayDetailsSummary({
  details,
  title,
  address,
  bookingUrl,
  photoUris,
  checkinDate,
  checkinMinutes,
  dateDisplayFormat: _dateDisplayFormat = 'mdy',
}: {
  details: TravelStayDetails;
  /** Hotel / property name for brand + place-photo lookup. */
  title?: string;
  /** Stay address (itinerary `details`) for place-photo lookup. */
  address?: string;
  bookingUrl?: string;
  photoUris?: string[];
  checkinDate?: string;
  checkinMinutes?: number;
  /** Kept for call-site compatibility; board chrome always uses medium dates. */
  dateDisplayFormat?: DateDisplayFormat;
}) {
  const theme = useTheme();
  const { s } = useResponsive();
  const accent = kindAccent('stay', theme);
  const markSize = Math.max(44, s(48));
  const checkinStamp = formatStamp(checkinDate, checkinMinutes);
  const checkoutStamp = formatStamp(
    details.checkoutDate,
    details.checkoutMinutes,
  );
  const confirmationUris = confirmationUrisForDisplay(
    details.confirmationUris,
    'stay',
  );
  const openConfirmation = () => {
    if (!confirmationUris.length) return;
    void openConfirmationAttachments(confirmationUris);
  };

  const hasBody =
    Boolean(details.confirmationCode) ||
    Boolean(details.reservationEmail) ||
    Boolean(details.notes) ||
    details.price !== undefined ||
    Boolean(checkinStamp) ||
    Boolean(checkoutStamp) ||
    confirmationUris.length > 0;
  if (!hasBody) return null;

  const rows = [
    checkinStamp
      ? { label: 'Check In', value: checkinStamp, icon: 'calendar' as const }
      : undefined,
    checkoutStamp
      ? { label: 'Check Out', value: checkoutStamp, icon: 'calendar' as const }
      : undefined,
    details.price !== undefined
      ? {
          label: 'Price',
          value: `${details.currency ? `${details.currency} ` : ''}${details.price.toFixed(2)}`,
          icon: 'currency' as const,
        }
      : undefined,
    details.reservationEmail
      ? {
          label: 'Reservation Email',
          value: details.reservationEmail,
          icon: 'personal' as const,
        }
      : undefined,
    details.notes
      ? { label: 'Notes', detail: details.notes, icon: 'note' as const }
      : undefined,
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));

  return (
    <TravelDetailsSummaryCard
      title={title?.trim() || 'Stay'}
      icon="lodging"
      markStandalone
      mark={
        <StayLocationThumbnail
          size={markSize}
          title={title}
          address={address}
          bookingUrl={bookingUrl}
          photoUris={photoUris}
          fallbackColor={accent}
        />
      }
      accentColor={accent}
      confirmationCode={details.confirmationCode}
      onPressConfirmation={
        confirmationUris.length ? openConfirmation : undefined
      }
      rows={rows}>
      <ConfirmationDocumentCue
        uris={details.confirmationUris}
        kind="stay"
        accessibilityLabel="View uploaded stay confirmation"
      />
    </TravelDetailsSummaryCard>
  );
}
