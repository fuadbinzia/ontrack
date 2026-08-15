import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';
import {
  asFiniteNonNegative,
  asNonEmptyString,
  asOneOf,
  asString,
} from '@/utils/parse';

import { searchEspnUfcFromDevice } from './espn-ufc-client';
import { usesEspnUfcDiscovery } from './espn-ufc';
import type {
  EventBroadcast,
  EventFighter,
  EventFollow,
  EventFollowSyncResponse,
  EventFollowTargetsResponse,
  EventFollowTarget,
  EventFighterProfilesResponse,
  EventKind,
  EventLiveResponse,
  EventSport,
  EventSearchResponse,
  EventSearchResult,
  EventVenue,
  ExternalEventStatus,
  EventBout,
} from './types';

export * from './types';

const EVENT_KIND_VALUES = ['sports', 'concert', 'nba', 'ufc'] as const;
const EVENT_PROVIDER_VALUES = ['thesportsdb', 'ticketmaster', 'espn'] as const;
const EVENT_STATUS_VALUES: readonly ExternalEventStatus[] = ['scheduled', 'postponed', 'cancelled', 'in-progress', 'completed', 'unknown'];
const EVENT_CARD_SECTION_VALUES = ['main', 'prelims', 'early-prelims'] as const;
const EVENT_TARGET_KIND_VALUES = ['team', 'league', 'promotion', 'artist'] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asEventVenue(value: unknown): EventVenue | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const venue = value as Record<string, unknown>;
  const normalized = {
    name: asNonEmptyString(venue.name),
    address: asNonEmptyString(venue.address),
    city: asNonEmptyString(venue.city),
    region: asNonEmptyString(venue.region),
    countryCode: asNonEmptyString(venue.countryCode),
  };
  return Object.keys(normalized).some((key) => normalized[key as keyof typeof normalized] !== undefined)
    ? normalized
    : undefined;
}

function asEventFighter(value: unknown): EventFighter | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const fighter = value as Record<string, unknown>;
  const name = asNonEmptyString(fighter.name);
  if (!name) return undefined;
  const providerAthleteId = asNonEmptyString(fighter.providerAthleteId)
    ?? `legacy-${name}`;
  const countryFlagUrl = asString(fighter.countryFlagUrl);
  const winner = typeof fighter.winner === 'boolean' ? fighter.winner : undefined;
  const age = asFiniteNonNegative(fighter.age);
  const height = asString(fighter.height);
  const weight = asString(fighter.weight);
  const reach = asString(fighter.reach);
  const stance = asString(fighter.stance);
  const record = asString(fighter.record);
  const imageUrl = asString(fighter.imageUrl);
  const shortName = asString(fighter.shortName);
  const country = asString(fighter.country);
  return {
    providerAthleteId,
    name,
    ...(shortName ? { shortName } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(country ? { country } : {}),
    ...(record ? { record } : {}),
    ...(countryFlagUrl ? { countryFlagUrl } : {}),
    ...(winner === undefined ? {} : { winner }),
    ...(age === undefined ? {} : { age }),
    ...(height ? { height } : {}),
    ...(weight ? { weight } : {}),
    ...(reach ? { reach } : {}),
    ...(stance ? { stance } : {}),
  };
}

function asEventBouts(value: unknown): EventBout[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const bouts = value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const providerCompetitionId = asNonEmptyString(row.providerCompetitionId);
    const cardSection = asOneOf(row.cardSection, EVENT_CARD_SECTION_VALUES);
    if (!providerCompetitionId || !cardSection) return [];
    const fighters = Array.isArray(row.fighters)
      ? row.fighters.map(asEventFighter).filter((fighter): fighter is EventFighter => Boolean(fighter))
      : [];
    if (!fighters.length) return [];
    const weightClass = asString(row.weightClass);
    const title = asString(row.title);
    const status = asString(row.status);
    const startDateTime = asString(row.startDateTime);
    const period = asFiniteNonNegative(row.period);
    const displayClock = asString(row.displayClock);
    return [{
      providerCompetitionId,
      cardSection,
      fighters,
      ...(startDateTime ? { startDateTime } : {}),
      ...(weightClass ? { weightClass } : {}),
      ...(title ? { title } : {}),
      ...(status ? { status } : {}),
      ...(period === undefined ? {} : { period }),
      ...(displayClock ? { displayClock } : {}),
    } satisfies EventBout];
  });
  return bouts.length ? bouts : undefined;
}

function asEventSearchResult(value: unknown): EventSearchResult | undefined {
  const event = asRecord(value);
  const provider = asOneOf(event.provider, EVENT_PROVIDER_VALUES);
  const kind = asOneOf(event.kind, EVENT_KIND_VALUES);
  const providerEventId = asNonEmptyString(event.providerEventId);
  const sourceName = asNonEmptyString(event.sourceName);
  const title = asNonEmptyString(event.title);
  const date = asNonEmptyString(event.date);
  if (!provider || !kind || !providerEventId || !sourceName || !title || !date) return undefined;
  const status = asOneOf(event.status, EVENT_STATUS_VALUES) ?? 'unknown';
  return {
    provider,
    providerEventId,
    kind,
    sourceName,
    sourceUrl: asString(event.sourceUrl),
    title,
    startDateTime: asString(event.startDateTime),
    date,
    allDay: typeof event.allDay === 'boolean' ? event.allDay : false,
    durationMinutes: asFiniteNonNegative(event.durationMinutes) ?? 120,
    participants: asEventStringList(event.participants),
    ...(asEventVenue(event.venue) ? { venue: asEventVenue(event.venue) } : {}),
    card: asEventStringList(event.card),
    ...(asEventBouts(event.bouts) ? { bouts: asEventBouts(event.bouts) } : {}),
    broadcasts: asEventBroadcasts(event.broadcasts),
    watchUrl: asString(event.watchUrl),
    ticketUrl: asString(event.ticketUrl),
    imageUrl: asString(event.imageUrl),
    status,
    notes: asNonEmptyString(event.notes),
  };
}

function asEventSearchResults(value: unknown): EventSearchResult[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asEventSearchResult(item))
    .filter((item): item is EventSearchResult => item !== undefined);
}

function asEventFollowTarget(value: unknown): EventFollowTarget | undefined {
  const raw = asRecord(value);
  const provider = asOneOf(raw.provider, EVENT_PROVIDER_VALUES);
  const kind = asOneOf(raw.kind, EVENT_KIND_VALUES);
  const targetKind = asOneOf(raw.targetKind, EVENT_TARGET_KIND_VALUES);
  const providerTargetId = asNonEmptyString(raw.providerTargetId);
  const name = asNonEmptyString(raw.name);
  if (!provider || !kind || !targetKind || !providerTargetId || !name) return undefined;
  return {
    provider,
    providerTargetId,
    kind,
    targetKind,
    name,
    imageUrl: asString(raw.imageUrl),
    subtitle: asNonEmptyString(raw.subtitle),
  };
}

function asEventFollowSyncGroup(value: unknown): { followId: string; events: EventSearchResult[] } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const followId = asNonEmptyString(raw.followId);
  if (!followId) return undefined;
  return {
    followId,
    events: asEventSearchResults(raw.events),
  };
}

export function asEventSearchResponse(value: unknown): EventSearchResponse {
  const raw = asRecord(value);
  const page = asFiniteNonNegative(raw.page);
  return {
    results: asEventSearchResults(raw.results),
    page: page === undefined ? 0 : Math.round(page),
    hasMore: typeof raw.hasMore === 'boolean' ? raw.hasMore : false,
  };
}

export function asEventLiveResponse(value: unknown): EventLiveResponse {
  const raw = asRecord(value);
  return {
    results: asEventSearchResults(raw.results),
    syncedAt: asNonEmptyString(raw.syncedAt) ?? new Date().toISOString(),
  };
}

export function asEventFollowTargetsResponse(value: unknown): EventFollowTargetsResponse {
  const raw = asRecord(value);
  const results = Array.isArray(raw.results)
    ? raw.results
      .map((item) => asEventFollowTarget(item))
      .filter((item): item is EventFollowTarget => item !== undefined)
    : [];
  return { results };
}

export function asEventFollowSyncResponse(value: unknown): EventFollowSyncResponse {
  const raw = asRecord(value);
  const results = Array.isArray(raw.results)
    ? raw.results
      .flatMap((group) => {
        const parsed = asEventFollowSyncGroup(group);
        return parsed ? [parsed] : [];
      })
    : [];
  return {
    results,
    syncedAt: asNonEmptyString(raw.syncedAt) ?? new Date().toISOString(),
  };
}

export function asEventBroadcasts(value: unknown): EventBroadcast[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return undefined;
      const itemRecord = item as Record<string, unknown>;
      const name = asNonEmptyString(itemRecord.name);
      if (!name) return undefined;
      const countryCode = asNonEmptyString(itemRecord.countryCode);
      const url = asString(itemRecord.url);
      return countryCode || url ? { name, countryCode, url } : { name };
    })
    .filter((item): item is EventBroadcast => Boolean(item));
}

export function asEventStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => asNonEmptyString(item) !== undefined) : [];
}

export class EventServiceError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message);
    this.name = 'EventServiceError';
  }
}

function apiUrl(path: string) {
  return resolveExpoApiUrl(path, {
    configuredBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    createNotConfiguredError: () => new EventServiceError('Event discovery is not configured for this build.'),
  });
}

function request<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal } = {}) {
  return apiRequest<T, EventServiceError>({
    url: apiUrl(path),
    method: options.method ?? 'GET',
    body: options.body,
    signal: options.signal,
    offlineMessage: 'Event discovery is offline. Your saved events and follows are still available.',
    unavailableMessage: 'Event discovery is temporarily unavailable.',
    createError: (message, _code, status) => new EventServiceError(message, status ?? 0),
  });
}

export async function searchEvents(
  kind: EventKind,
  query: string,
  page = 0,
  signal?: AbortSignal,
  sport: EventSport = 'all',
) {
  const params = new URLSearchParams({ kind, q: query.trim(), page: String(page), sport });
  const hostedSearch = () =>
    request<EventSearchResponse>(`/api/events/search?${params}`, { signal });
  if (!usesEspnUfcDiscovery(kind, query, sport)) return hostedSearch();
  try {
    return await searchEspnUfcFromDevice(query, signal);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    return hostedSearch();
  }
}

export function fetchLiveUfcEvents(date: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ date });
  return request<EventLiveResponse>(`/api/events/ufc-live?${params}`, { signal });
}

export function fetchUfcFighterProfiles(
  providerAthleteIds: readonly string[],
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ ids: providerAthleteIds.join(',') });
  return request<EventFighterProfilesResponse>(`/api/events/ufc-athletes?${params}`, { signal });
}

export function searchEventFollowTargets(
  kind: EventKind,
  query: string,
  signal?: AbortSignal,
  sport: EventSport = 'all',
) {
  const params = new URLSearchParams({ kind, q: query.trim(), sport });
  return request<EventFollowTargetsResponse>(`/api/events/targets?${params}`, { signal });
}

export function syncEventFollows(follows: EventFollow[], signal?: AbortSignal) {
  return request<EventFollowSyncResponse>('/api/events/sync', {
    method: 'POST',
    body: { follows },
    signal,
  });
}
