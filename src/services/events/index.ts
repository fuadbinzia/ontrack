import { apiRequest } from '@/services/http/api-client';
import { resolveExpoApiUrl } from '@/services/http/api-url';

import type {
  EventFollow,
  EventFollowSyncResponse,
  EventFollowTargetsResponse,
  EventFighterProfilesResponse,
  EventKind,
  EventLiveResponse,
  EventSport,
  EventSearchResponse,
} from './types';

export * from './types';

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

export function searchEvents(
  kind: EventKind,
  query: string,
  page = 0,
  signal?: AbortSignal,
  sport: EventSport = 'all',
) {
  const params = new URLSearchParams({ kind, q: query.trim(), page: String(page), sport });
  return request<EventSearchResponse>(`/api/events/search?${params}`, { signal });
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
