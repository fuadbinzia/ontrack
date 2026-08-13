export const STAY_PACKAGE_VERSION = 1 as const;

export const PARTNER_SCOPES = ['identity.link', 'stay.read', 'stay.write'] as const;
export type PartnerScope = (typeof PARTNER_SCOPES)[number];

export const PARTNER_STRAIAWAY = 'straiaway' as const;
export type PartnerId = typeof PARTNER_STRAIAWAY;

/** Narrow stay handoff DTO shared with StraiAway. Flights/expenses/host ops stay local. */
export type StayPackage = {
  version: typeof STAY_PACKAGE_VERSION;
  updatedAt: string;
  propertyName: string;
  address?: string;
  checkInDate: string;
  checkOutDate?: string;
  checkInMinutes?: number;
  checkOutMinutes?: number;
  confirmationCode?: string;
  guestDisplayName?: string;
  bookingUrl?: string;
  notes?: string;
  ontrackPlanId?: string;
  ontrackItemId?: string;
  straiawayPropertyId?: string;
  straiawayReservationId?: string;
};

export type StraiAwayLinkStatus = {
  connected: boolean;
  partnerUserId?: string;
  partnerDisplayName?: string;
  scopes: PartnerScope[];
  connectedAt?: string;
  lastSyncedAt?: string;
};

export type StraiAwayConnectResult = {
  authorizeUrl: string;
  code: string;
  expiresAt: string;
};
