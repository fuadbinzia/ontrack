export type TravelPlanMode =
  'flight' | 'road' | 'train' | 'bus' | 'ferry' | 'transit' | 'mixed' | 'other';

export type TravelTransportMode =
  | 'driving'
  | 'train'
  | 'bus'
  | 'subway'
  | 'tram'
  | 'ferry'
  | 'rideshare'
  | 'taxi'
  | 'shuttle'
  | 'other';

export type TravelItemKind =
  'flight' | 'transport' | 'stay' | 'activity' | 'rental' | 'moment';

export interface TravelRouteStop {
  id: string;
  name: string;
  address?: string;
  /** Optional local calendar day YYYY-MM-DD. Date and time are stored together. */
  arrivalDate?: string;
  /** Optional minutes from midnight. Date and time are stored together. */
  arrivalMinutes?: number;
  notes?: string;
}

export interface TravelTransportDetails {
  mode: TravelTransportMode;
  operator?: string;
  serviceNumber?: string;
  origin: string;
  destination: string;
  arrivalDate: string;
  arrivalMinutes: number;
  platform?: string;
  seat?: string;
  vehicle?: string;
  confirmationCode?: string;
  confirmationUris?: string[];
  distance?: number;
  distanceUnit?: 'mi' | 'km';
  fare?: number;
  currency?: string;
  stops?: TravelRouteStop[];
}

export interface TravelFlightLeg {
  airline?: string;
  flightNumber?: string;
  departureAirport?: string;
  /** Flight-specific terminal at the departure airport. */
  departureTerminal?: string;
  /** Flight-specific gate at the departure airport. */
  departureGate?: string;
  arrivalAirport?: string;
  /** Flight-specific terminal at the arrival airport. */
  arrivalTerminal?: string;
  /** Flight-specific gate at the arrival airport. */
  arrivalGate?: string;
  /** Local calendar day YYYY-MM-DD for this leg’s departure. */
  date?: string;
  /** Minutes from midnight for departure local time. */
  departureMinutes?: number;
  /** Local calendar day YYYY-MM-DD for this leg’s arrival. */
  arrivalDate?: string;
  /** Minutes from midnight for arrival local time. */
  arrivalMinutes?: number;
  durationMinutes?: number;
  /** Optional aircraft type from the confirmation (e.g. Boeing 737-800). */
  aircraft?: string;
  /** Minutes spent connecting after this leg before the next flight. */
  layoverMinutesAfter?: number;
}

export interface TravelFlightDetails {
  airline?: string;
  flightNumber?: string;
  confirmationCode?: string;
  departureAirport?: string;
  /** Flight-specific terminal at the departure airport. */
  departureTerminal?: string;
  /** Flight-specific gate at the departure airport. */
  departureGate?: string;
  arrivalAirport?: string;
  /** Flight-specific terminal at the arrival airport. */
  arrivalTerminal?: string;
  /** Flight-specific gate at the arrival airport. */
  arrivalGate?: string;
  seat?: string;
  /** Lead traveler on the booking, when the confirmation names one. */
  passengerName?: string;
  /** Travelers covered by this booking; defaults to a single traveler in UI. */
  passengerCount?: number;
  /** Minutes spent connecting after this leg before the next flight. */
  layoverMinutesAfter?: number;
  /**
   * Airport where the connection happens (e.g. IAH). Distinct from
   * `arrivalAirport` when a review draft collapses a multi-leg trip to the
   * final destination while still showing layover details.
   */
  connectionAirport?: string;
  /** Local minutes from midnight when the connecting arrival lands. */
  connectionArrivalMinutes?: number;
  /** Local minutes from midnight when the onward flight departs. */
  connectionDepartureMinutes?: number;
  /**
   * Per-leg itinerary for connecting trips. When present (length > 1), the
   * expanded flight card renders the multi-leg journey view.
   */
  legs?: TravelFlightLeg[];
  /** Durable file:// URIs for the uploaded confirmation document/screenshots. */
  confirmationUris?: string[];
}

export interface TravelRentalDetails {
  company?: string;
  confirmationCode?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  vehicleClass?: string;
  /** Local calendar day YYYY-MM-DD for return/drop-off. */
  dropoffDate?: string;
  /** Minutes from midnight for drop-off local time. */
  dropoffMinutes?: number;
  /** Durable file:// URIs for the uploaded confirmation document/screenshots. */
  confirmationUris?: string[];
}

export interface TravelStayDetails {
  confirmationCode?: string;
  /** Email used when making the reservation (provider manage-booking gate). */
  reservationEmail?: string;
  /** Local calendar day YYYY-MM-DD for check-out. */
  checkoutDate?: string;
  /** Minutes from midnight for check-out local time. */
  checkoutMinutes?: number;
  /** Durable file:// URIs for the uploaded confirmation document/screenshots. */
  confirmationUris?: string[];
  /** Freeform stay notes (wifi, door codes, parking, etc.). */
  notes?: string;
  /** Total price for the stay. */
  price?: number;
  /** Currency code for the stay price, e.g. USD. */
  currency?: string;
}

/** Collaborative trips share every stop with the roster. */
export type TravelItemShareMode = 'trip';

export interface TravelItineraryItem {
  id: string;
  kind: TravelItemKind;
  title: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  details?: string;
  bookingUrl?: string;
  /** Durable file:// URIs for trip photos attached to this item. */
  photoUris?: string[];
  /** Collaborative notes from the host and friends. */
  notes?: TravelItemNote[];
  /**
   * Auth user id of the traveler who owns this stop. Missing/legacy local items
   * are treated as owned by the current signed-in user (or local-only).
   */
  ownerUserId?: string;
  /** Always trip-wide for co-travelers (legacy private/selected normalize to trip). */
  shareMode?: TravelItemShareMode;
  /** Per-item LWW timestamp for live itinerary collaboration. */
  sharedUpdatedAt?: string;
  flight?: TravelFlightDetails;
  transport?: TravelTransportDetails;
  rental?: TravelRentalDetails;
  stay?: TravelStayDetails;
}

/** A short collaborative note on an itinerary stop. */
export interface TravelItemNote {
  id: string;
  body: string;
  /** `TRAVEL_EXPENSE_SELF_ID` or a participant id. */
  authorId: string;
  authorName: string;
  createdAt: string;
  /** Set when the author edits the body. */
  updatedAt?: string;
}

export interface TravelParticipant {
  id: string;
  name: string;
  email?: string;
  inviteCode: string;
  invitedAt: string;
  acceptedAt?: string;
}

/** Server roster person from list_travel_trip_roster (auth user ids + roles). */
export interface TravelTripRosterPerson {
  userId: string;
  displayName: string;
  email?: string;
  role: 'host' | 'cohost' | 'member';
  inviteCode?: string;
  acceptedAt?: string;
  avatarKind?: 'initials' | 'icon' | 'photo';
  avatarColor?: string;
  avatarIconId?: string;
  avatarPhotoPath?: string;
}

export type TravelExpenseCategory =
  'flight' | 'stay' | 'food' | 'transport' | 'activity' | 'shopping' | 'other';

/** Local trip owner in expense paid-by / split lists (not a TravelParticipant id). */
export const TRAVEL_EXPENSE_SELF_ID = 'self';

/**
 * On member copies, shared expenses paid by the trip host use this id so it
 * does not collide with the member’s local `self` (“You”).
 */
export const TRAVEL_EXPENSE_HOST_ID = 'host';

export interface TravelExpense {
  id: string;
  title: string;
  /** Original amount in `currency` (> 0). */
  amount: number;
  /** ISO 4217 uppercase. */
  currency: string;
  /** Local calendar day YYYY-MM-DD. */
  date: string;
  category: TravelExpenseCategory;
  notes?: string;
  /** `TRAVEL_EXPENSE_SELF_ID` or a participant id. */
  paidById: string;
  /** Equal shares among these people (≥ 1). */
  splitWithIds: string[];
  createdAt: string;
  updatedAt: string;
  /** Itinerary leg that created this expense, when applicable. */
  travelItemId?: string;
}

export interface TravelPlan {
  id: string;
  /** Hosted invite capability used by an invited member to join this trip's chat. */
  chatAccessCode?: string;
  /** Open join link code; anyone can request, host must approve. */
  openJoinCode?: string;
  /** Host's canonical trip id when this local plan is a member copy. */
  hostTripId?: string;
  /** Host display name for shared expense `self` labels on member copies. */
  hostDisplayName?: string;
  /** Extra roster from the shared expenses document (host + members). */
  sharedExpensePeople?: { id: string; name: string }[];
  /** Last shared expenses document timestamp (LWW sync). */
  sharedExpensesUpdatedAt?: string;
  title: string;
  /** Defaults to `flight` for plans created before multi-mode trips. */
  mode?: TravelPlanMode;
  /** Optional starting city/place shared by flight and transport prefills. */
  origin?: string;
  destination: string;
  startDate: string;
  endDate: string;
  notes?: string;
  /**
   * User-uploaded trip cover photos (durable file:// / ontrack-media:), max 3.
   * Drives the Travel Home hero carousel; destination placeholders never mix in.
   */
  coverUris?: string[];
  /** First of `coverUris` — legacy alias for older payloads / cloud media. */
  coverUri?: string;
  itinerary: TravelItineraryItem[];
  participants: TravelParticipant[];
  /** ISO 4217 for trip totals / settle-up. */
  baseCurrency: string;
  expenses: TravelExpense[];
  createdAt: string;
  updatedAt: string;
}

export type TravelOpenJoinStatus =
  'none' | 'pending' | 'approved' | 'rejected' | 'host';

export interface TravelOpenJoinPreview {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripId: string;
}

export interface TravelOpenJoinRequest {
  id: string;
  requesterName: string;
  requesterEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  grantedInviteCode?: string;
}
