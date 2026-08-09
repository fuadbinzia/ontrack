import type { FlightDetailsDraft } from '@/features/travel/flight-details';
import { FlightDetailsCardEditor } from '@/features/travel/flight-details-card-editor';
import { FlightDetailsSummary } from '@/features/travel/flight-details-summary';
import type { FlightScheduleDraft } from '@/features/travel/flight-schedule';
import type { RentalDetailsDraft } from '@/features/travel/rental-details';
import { RentalDetailsCardEditor } from '@/features/travel/rental-details-card-editor';
import { RentalDetailsSummary } from '@/features/travel/rental-details-summary';
import type { StayDetailsDraft } from '@/features/travel/stay-details';
import { StayDetailsCardEditor } from '@/features/travel/stay-details-card-editor';
import { StayDetailsSummary } from '@/features/travel/stay-details-summary';
import { TransportDetailsCardEditor } from '@/features/travel/transport-details-card-editor';
import { TransportDetailsSummary } from '@/features/travel/transport-details-summary';
import type { TravelRangeScheduleDraft } from '@/features/travel/travel-range-schedule';
import { TimelineItemToolbar } from '@/features/travel/travel-timeline-node-chrome';
import type {
    TravelItineraryItem,
    TravelTransportDetails,
} from '@/features/travel/types';
import type { DateDisplayFormat } from '@/utils/date';

type TravelTimelineNodeStructuredProps = {
  item: TravelItineraryItem;
  dateDisplayFormat: DateDisplayFormat;
  allowStructuredEditing: boolean;
  showStructuredDetails: boolean;
  isMoment: boolean;
  isCompactFlight: boolean;
  editingFlight: boolean;
  editingRental: boolean;
  editingStay: boolean;
  editingTransport: boolean;
  editingStructured: boolean;
  editedFlightDetails: FlightDetailsDraft;
  editedFlightDetailsError?: string;
  editedFlightFileName?: string;
  importingFlight: boolean;
  editedRentalDetails: RentalDetailsDraft;
  editedRentalDetailsError?: string;
  editedRentalFileName?: string;
  importingRental: boolean;
  editedStayDetails: StayDetailsDraft;
  editedStayDetailsError?: string;
  editedStayFileName?: string;
  importingStay: boolean;
  planStartDate: string;
  planEndDate: string;
  toolbarActionSize: number;
  canShare: boolean;
  dense: boolean;
  onGlass: boolean;
  onEditedFlightDetailsChange: (value: FlightDetailsDraft) => void;
  onImportFlight: () => void;
  onSaveFlightDetails: (schedule: FlightScheduleDraft) => void;
  onCancelFlightEdit: () => void;
  onBeginFlightEdit: () => void;
  onEditedRentalDetailsChange: (value: RentalDetailsDraft) => void;
  onImportRental: () => void;
  onSaveRentalDetails: (schedule: TravelRangeScheduleDraft) => void;
  onCancelRentalEdit: () => void;
  onBeginRentalEdit: () => void;
  onEditedStayDetailsChange: (value: StayDetailsDraft) => void;
  onImportStay: () => void;
  onSaveStayDetails: (schedule: TravelRangeScheduleDraft) => void;
  onCancelStayEdit: () => void;
  onBeginStayEdit: () => void;
  onSaveTransportDetails?: (
    details: TravelTransportDetails,
    schedule: TravelRangeScheduleDraft,
  ) => void;
  onBeginTransportEdit: () => void;
  onCancelTransportEdit: () => void;
  onBeginItemEdit?: () => void;
  onOpenNotes: () => void;
  onAddPhotos: () => void;
  onShare?: () => void;
  onOpenBooking: () => void;
  onRemove: () => void;
};

/** Kind summaries, structured editors, and the item toolbar for a timeline node. */
export function TravelTimelineNodeStructured({
  item,
  dateDisplayFormat,
  allowStructuredEditing,
  showStructuredDetails,
  isMoment,
  isCompactFlight,
  editingFlight,
  editingRental,
  editingStay,
  editingTransport,
  editingStructured,
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
  toolbarActionSize,
  canShare,
  dense,
  onGlass,
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
  onBeginTransportEdit,
  onCancelTransportEdit,
  onBeginItemEdit,
  onOpenNotes,
  onAddPhotos,
  onShare,
  onOpenBooking,
  onRemove,
}: TravelTimelineNodeStructuredProps) {
  return (
    <>
      {showStructuredDetails &&
      item.kind === 'flight' &&
      item.flight &&
      !editingFlight ? (
        <FlightDetailsSummary
          itemId={item.id}
          details={item.flight}
          date={item.date}
          startMinutes={item.startMinutes}
          durationMinutes={item.durationMinutes}
          hideHero={isCompactFlight}
          bare={isCompactFlight}
        />
      ) : null}
      {showStructuredDetails &&
      item.kind === 'transport' &&
      item.transport &&
      !editingTransport ? (
        <TransportDetailsSummary
          itemId={item.id}
          details={item.transport}
          departureDate={item.date}
          departureMinutes={item.startMinutes}
          dateDisplayFormat={dateDisplayFormat}
        />
      ) : null}
      {showStructuredDetails &&
      item.kind === 'rental' &&
      item.rental &&
      !editingRental ? (
        <RentalDetailsSummary
          details={item.rental}
          pickupDate={item.date}
          pickupMinutes={item.startMinutes}
          dateDisplayFormat={dateDisplayFormat}
        />
      ) : null}
      {showStructuredDetails &&
      item.kind === 'stay' &&
      item.stay &&
      !editingStay ? (
        <StayDetailsSummary
          details={item.stay}
          title={item.title}
          address={item.details}
          bookingUrl={item.bookingUrl}
          photoUris={item.photoUris}
          checkinDate={item.date}
          checkinMinutes={item.startMinutes}
          dateDisplayFormat={dateDisplayFormat}
        />
      ) : null}
      {item.kind === 'flight' && editingFlight ? (
        <FlightDetailsCardEditor
          value={editedFlightDetails}
          error={editedFlightDetailsError}
          importedFileName={editedFlightFileName}
          importing={importingFlight}
          item={item}
          onChange={onEditedFlightDetailsChange}
          onImport={onImportFlight}
          onSave={onSaveFlightDetails}
          onCancel={onCancelFlightEdit}
          onRemove={onRemove}
        />
      ) : null}
      {item.kind === 'rental' && editingRental ? (
        <RentalDetailsCardEditor
          key={editedRentalFileName ?? item.id}
          value={editedRentalDetails}
          onChange={onEditedRentalDetailsChange}
          error={editedRentalDetailsError}
          importedFileName={editedRentalFileName}
          importing={importingRental}
          item={item}
          onImport={onImportRental}
          planStartDate={planStartDate}
          planEndDate={planEndDate}
          onSave={onSaveRentalDetails}
          onCancel={onCancelRentalEdit}
          onRemove={onRemove}
        />
      ) : null}
      {item.kind === 'stay' && editingStay ? (
        <StayDetailsCardEditor
          key={editedStayFileName ?? item.id}
          value={editedStayDetails}
          onChange={onEditedStayDetailsChange}
          error={editedStayDetailsError}
          importedFileName={editedStayFileName}
          importing={importingStay}
          item={item}
          onImport={onImportStay}
          planStartDate={planStartDate}
          planEndDate={planEndDate}
          onSave={onSaveStayDetails}
          onCancel={onCancelStayEdit}
          onRemove={onRemove}
        />
      ) : null}
      {item.kind === 'transport' && editingTransport ? (
        <TransportDetailsCardEditor
          item={item}
          planStartDate={planStartDate}
          planEndDate={planEndDate}
          onSave={(nextDetails, schedule) => {
            onSaveTransportDetails?.(nextDetails, schedule);
            onCancelTransportEdit();
          }}
          onCancel={onCancelTransportEdit}
          onRemove={onRemove}
        />
      ) : null}
      {!editingStructured ? (
        <TimelineItemToolbar
          item={item}
          size={toolbarActionSize}
          allowStructuredEditing={allowStructuredEditing}
          showStructuredDetails={showStructuredDetails}
          isMoment={isMoment}
          canShare={canShare}
          align={dense ? 'left' : 'center'}
          onGlass={onGlass}
          onOpenNotes={onOpenNotes}
          onAddPhotos={onAddPhotos}
          onShare={onShare}
          onBeginFlightEdit={onBeginFlightEdit}
          onBeginRentalEdit={onBeginRentalEdit}
          onBeginStayEdit={onBeginStayEdit}
          onBeginTransportEdit={onBeginTransportEdit}
          onBeginItemEdit={onBeginItemEdit}
          onOpenBooking={onOpenBooking}
          onRemove={onRemove}
        />
      ) : null}
    </>
  );
}
