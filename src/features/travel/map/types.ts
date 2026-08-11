import type { ProfileAvatarMeta } from '@/features/account/profile-avatar-model';

export interface TravelDestinationLocation {
  label: string;
  countryName: string;
  /** ISO 3166-1 alpha-2 code. */
  countryCode: string;
  latitude: number;
  longitude: number;
}

export interface TravelMapTripSummary {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
}

export interface TravelMapPlacePin {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export interface TravelMapVisit {
  id: string;
  /** Omitted when the user pins a place without linking it to a trip. */
  tripId?: string;
  /** Host-scoped id used only to determine whether a friend may open the trip. */
  canonicalTripId?: string;
  countryCode: string;
  countryName: string;
  places: TravelMapPlacePin[];
  tripSummary?: TravelMapTripSummary;
  createdAt: string;
  updatedAt: string;
}

export interface TravelMapSettings {
  shareWithFriends: boolean;
  selectedFriendIds: string[];
  dismissedSuggestionFingerprints: string[];
}

export interface TravelMapPerson {
  userId: string;
  displayName: string;
  avatar?: ProfileAvatarMeta;
  color: string;
  isSelf?: boolean;
}

export interface TravelMapFriendLayer {
  person: TravelMapPerson;
  visits: TravelMapVisit[];
}

export interface TravelMapFriendProfile {
  userId: string;
  displayName: string;
  avatar?: ProfileAvatarMeta;
}
