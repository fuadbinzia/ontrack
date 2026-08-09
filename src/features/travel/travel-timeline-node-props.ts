import type { FlightDetailsDraft } from '@/features/travel/flight-details';
import type { FlightScheduleDraft } from '@/features/travel/flight-schedule';
import type { RentalDetailsDraft } from '@/features/travel/rental-details';
import type { StayDetailsDraft } from '@/features/travel/stay-details';
import type { TravelRangeScheduleDraft } from '@/features/travel/travel-range-schedule';
import type { TravelTimelinePhase } from '@/features/travel/travel-timeline-entries';
import type {
  TravelItineraryItem,
  TravelItemNote,
  TravelPlan,
  TravelTransportDetails,
} from '@/features/travel/types';
import type { DateDisplayFormat } from '@/utils/date';

/** Props for the itinerary timeline / transport board node. */
export type TravelTimelineNodeProps = {
  item: TravelItineraryItem;
  plan: TravelPlan;
  expanded: boolean;
  dateDisplayFormat: DateDisplayFormat;
  /** Timeline action phase; defaults keep transport-section titles as stored. */
  phase?: TravelTimelinePhase;
  displayTitle?: string;
  /** Override date/time for land / drop-off markers. */
  entryDate?: string;
  entryStartMinutes?: number;
  /** Hide when the timeline spine already shows the kind icon. */
  showKindBadge?: boolean;
  compact?: boolean;
  /** Extra-tight timeline presentation; transport cards use regular compact density. */
  dense?: boolean;
  /** Hour label rendered in the dense title row (keeps time · icon · title vertically aligned). */
  leadingTimeLabel?: string;
  /** Kept for call-site compatibility; page reveal owns entrance motion. */
  index?: number;
  /** Structured flight/stay/rental editors belong only in the transport section. */
  allowStructuredEditing?: boolean;
  /** Structured summaries and transport actions belong only in the transport section. */
  showStructuredDetails?: boolean;
  accentColor?: string;
  editingFlightItemId?: string;
  editedFlightDetails: FlightDetailsDraft;
  editedFlightDetailsError?: string;
  editedFlightFileName?: string;
  importingFlight: boolean;
  editingRentalItemId?: string;
  editedRentalDetails: RentalDetailsDraft;
  editedRentalDetailsError?: string;
  editedRentalFileName?: string;
  importingRental: boolean;
  editingStayItemId?: string;
  editedStayDetails: StayDetailsDraft;
  editedStayDetailsError?: string;
  editedStayFileName?: string;
  importingStay: boolean;
  planStartDate: string;
  planEndDate: string;
  onToggle: () => void;
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
  /** Opens the itinerary add sheet to edit a moment/activity. */
  onBeginItemEdit?: () => void;
  onAddPhotos: () => void;
  onRemovePhoto: (uri: string) => void;
  onRemove: () => void;
  onSaveNotes: (notes: TravelItemNote[]) => void;
  onShare?: () => void;
};
