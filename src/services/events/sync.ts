import { useSchedule } from '@/store/schedule';

import { fetchLiveUfcEvents, searchEvents, syncEventFollows } from './index';
import type { EventDetails, EventSearchResult } from './types';

export const EVENT_FOLLOW_STALE_MS = 6 * 60 * 60 * 1000;
let inFlight: Promise<void> | undefined;
const ufcDetailsInFlight = new Map<string, Promise<void>>();
const ufcLiveInFlight = new Map<string, Promise<void>>();

export const UFC_LIVE_POLL_MS = 45 * 1000;
const UFC_LIVE_LEAD_MS = 6 * 60 * 60 * 1000;
const UFC_LIVE_TAIL_MS = 10 * 60 * 60 * 1000;

export function shouldPollUfcLiveUpdates(
  activity: { date: string; startMinutes: number; title: string },
  status: EventDetails['status'],
  now = Date.now(),
) {
  if (!/\bufc\b/i.test(activity.title)) return false;
  if (status === 'completed' || status === 'cancelled' || status === 'postponed') return false;
  if (status === 'in-progress') return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(activity.date);
  if (!match) return false;
  const start = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    0,
    activity.startMinutes,
  ).getTime();
  return Number.isFinite(start)
    && now >= start - UFC_LIVE_LEAD_MS
    && now <= start + UFC_LIVE_TAIL_MS;
}

function ufcNumber(title: string) {
  return title.match(/\bufc\s+(\d+)\b/i)?.[1];
}

export function matchingUfcEvent(
  current: Pick<EventDetails, 'provider' | 'providerEventId'>,
  title: string,
  date: string,
  candidates: readonly EventSearchResult[],
) {
  const numbered = ufcNumber(title);
  return candidates.find((candidate) =>
    candidate.provider === current.provider
      && candidate.providerEventId === current.providerEventId,
  ) ?? candidates.find((candidate) =>
    Boolean(numbered) && ufcNumber(candidate.title) === numbered,
  ) ?? candidates.find((candidate) =>
    candidate.date === date
      && candidate.title.toLowerCase().includes('ufc'),
  );
}

export function mergeRichUfcDetails(
  current: EventDetails,
  candidate: EventSearchResult,
  syncedAt: string,
): EventDetails {
  if (!candidate.bouts?.length) return current;
  return {
    ...current,
    sourceName: /\bespn\b/i.test(current.sourceName)
      ? current.sourceName
      : `${current.sourceName} · ESPN`,
    sourceUrl: candidate.sourceUrl ?? current.sourceUrl,
    imageUrl: candidate.imageUrl ?? current.imageUrl,
    participants: candidate.participants.length
      ? candidate.participants
      : current.participants,
    card: candidate.card?.length ? candidate.card : current.card,
    bouts: candidate.bouts,
    venue: candidate.venue?.name ? candidate.venue : current.venue,
    broadcasts: candidate.broadcasts.length
      ? candidate.broadcasts
      : current.broadcasts,
    watchUrl: candidate.watchUrl ?? current.watchUrl,
    status: candidate.status === 'unknown' ? current.status : candidate.status,
    lastSyncedAt: syncedAt,
  };
}

function isStale(lastSyncedAt: string | undefined, now: number) {
  if (!lastSyncedAt) return true;
  const stamp = new Date(lastSyncedAt).getTime();
  return !Number.isFinite(stamp) || now - stamp >= EVENT_FOLLOW_STALE_MS;
}

export function refreshEventFollows(options: {
  force?: boolean;
  followIds?: readonly string[];
} = {}) {
  if (inFlight) return inFlight;
  const state = useSchedule.getState();
  const selected = options.followIds
    ? state.eventFollows.filter((follow) => options.followIds?.includes(follow.id))
    : state.eventFollows;
  const now = Date.now();
  const follows = options.force ? selected : selected.filter((follow) => isStale(follow.lastSyncedAt, now));
  if (follows.length === 0) return Promise.resolve();

  inFlight = syncEventFollows(follows)
    .then((response) => useSchedule.getState().applyEventFollowSync(response))
    .catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return;
      const message = error instanceof Error ? error.message : 'Event schedules could not be refreshed.';
      useSchedule.getState().markEventFollowSyncError(message);
      throw error;
    })
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}

/** Backfills rich bout data for older/manual UFC imports that are not attached to a follow. */
export function refreshUfcEventDetails(activityId: string, signal?: AbortSignal) {
  const existingRequest = ufcDetailsInFlight.get(activityId);
  if (existingRequest) return existingRequest;
  const state = useSchedule.getState();
  const details = state.eventDetails.find((item) => item.activityId === activityId);
  const activity = state.activities.find((item) => item.id === activityId);
  if (!details || !activity || details.bouts?.length || !/\bufc\b/i.test(activity.title)) {
    return Promise.resolve();
  }

  const request = searchEvents('sports', 'UFC', 0, signal, 'combat')
    .then((response) => {
      const candidate = matchingUfcEvent(details, activity.title, activity.date, response.results);
      if (!candidate?.bouts?.length) return;
      const syncedAt = new Date().toISOString();
      useSchedule.setState((current) => ({
        eventDetails: current.eventDetails.map((item) =>
          item.activityId === activityId
            ? mergeRichUfcDetails(item, candidate, syncedAt)
            : item,
        ),
      }));
    })
    .finally(() => {
      ufcDetailsInFlight.delete(activityId);
    });
  ufcDetailsInFlight.set(activityId, request);
  return request;
}

/** Refreshes a saved UFC event from the short-cache live scoreboard endpoint. */
export function refreshLiveUfcEventDetails(activityId: string, signal?: AbortSignal) {
  const existingRequest = ufcLiveInFlight.get(activityId);
  if (existingRequest) return existingRequest;
  const state = useSchedule.getState();
  const details = state.eventDetails.find((item) => item.activityId === activityId);
  const activity = state.activities.find((item) => item.id === activityId);
  if (!details || !activity || !/\bufc\b/i.test(activity.title)) return Promise.resolve();

  const request = fetchLiveUfcEvents(activity.date, signal)
    .then((response) => {
      const candidate = matchingUfcEvent(
        details,
        activity.title,
        activity.date,
        response.results,
      );
      if (!candidate?.bouts?.length) return;
      useSchedule.setState((current) => ({
        eventDetails: current.eventDetails.map((item) =>
          item.activityId === activityId
            ? mergeRichUfcDetails(item, candidate, response.syncedAt)
            : item,
        ),
      }));
    })
    .finally(() => {
      ufcLiveInFlight.delete(activityId);
    });
  ufcLiveInFlight.set(activityId, request);
  return request;
}
