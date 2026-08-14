export type EventProvider = 'thesportsdb' | 'ticketmaster' | 'espn';
/** `nba` / `ufc` remain readable for existing local follows and imported events. */
export type EventKind = 'sports' | 'concert' | 'nba' | 'ufc';
export type EventSport =
  | 'all'
  | 'basketball'
  | 'football'
  | 'baseball'
  | 'hockey'
  | 'soccer'
  | 'combat'
  | 'motorsport';
export type ExternalEventStatus =
  | 'scheduled'
  | 'postponed'
  | 'cancelled'
  | 'in-progress'
  | 'completed'
  | 'unknown';

export interface EventBroadcast {
  name: string;
  countryCode?: string;
  url?: string;
}

export interface EventVenue {
  name?: string;
  address?: string;
  city?: string;
  region?: string;
  countryCode?: string;
}

export type EventCardSection = 'main' | 'prelims' | 'early-prelims';

export interface EventFighter {
  providerAthleteId: string;
  name: string;
  shortName?: string;
  imageUrl?: string;
  record?: string;
  country?: string;
  countryFlagUrl?: string;
  winner?: boolean;
  age?: number;
  height?: string;
  weight?: string;
  reach?: string;
  stance?: string;
}

export type EventFighterProfile = Pick<EventFighter, 'providerAthleteId'> &
  Partial<Pick<EventFighter, 'age' | 'height' | 'weight' | 'reach' | 'stance'>>;

export interface EventFighterProfilesResponse {
  profiles: EventFighterProfile[];
}

export interface EventBout {
  providerCompetitionId: string;
  cardSection: EventCardSection;
  startDateTime?: string;
  weightClass?: string;
  title?: string;
  status?: string;
  period?: number;
  displayClock?: string;
  fighters: EventFighter[];
}

export interface EventDetails {
  activityId: string;
  provider: EventProvider;
  providerEventId: string;
  kind: EventKind;
  sourceName: string;
  sourceUrl?: string;
  imageUrl?: string;
  participants: string[];
  card?: string[];
  bouts?: EventBout[];
  venue?: EventVenue;
  broadcasts: EventBroadcast[];
  ticketUrl?: string;
  watchUrl?: string;
  status: ExternalEventStatus;
  followId?: string;
  importMode: 'manual' | 'auto' | 'review';
  syncState: 'linked' | 'detached';
  lastSyncedAt: string;
}

export interface EventSearchResult extends Omit<EventDetails, 'activityId' | 'followId' | 'importMode' | 'syncState' | 'lastSyncedAt'> {
  title: string;
  startDateTime?: string;
  date: string;
  allDay: boolean;
  durationMinutes: number;
  notes?: string;
}

export interface EventSearchResponse {
  results: EventSearchResult[];
  page: number;
  hasMore: boolean;
}

export interface EventLiveResponse {
  results: EventSearchResult[];
  syncedAt: string;
}

export type EventFollowTargetKind = 'team' | 'league' | 'promotion' | 'artist';
export type EventFollowMode = 'auto' | 'review';

export interface EventFollowTarget {
  provider: EventProvider;
  providerTargetId: string;
  kind: EventKind;
  targetKind: EventFollowTargetKind;
  name: string;
  imageUrl?: string;
  subtitle?: string;
}

export interface EventFollow extends EventFollowTarget {
  id: string;
  mode: EventFollowMode;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
  lastSyncError?: string;
}

export interface EventSuggestion {
  id: string;
  followId: string;
  event: EventSearchResult;
  createdAt: string;
}

export interface EventFollowTargetsResponse {
  results: EventFollowTarget[];
}

export interface EventFollowSyncResponse {
  results: { followId: string; events: EventSearchResult[] }[];
  syncedAt: string;
}

export function externalEventKey(provider: EventProvider, providerEventId: string) {
  return `${provider}:${providerEventId}`;
}
