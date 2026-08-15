import type { Activity } from '@/types/models';
import type {
  EventDetails,
  EventFollow,
  EventFollowSyncResponse,
  EventSearchResult,
  EventSuggestion,
} from '@/services/events';
import { asEventBroadcasts, asEventStringList } from '@/services/events';
import { externalEventKey } from '@/services/events';
import { todayKey } from '@/utils/date';
import { newId } from '@/utils/id';
import type { ScheduleState } from './schedule';

export type ScheduleEventState = {
  activities: Activity[];
  eventDetails: EventDetails[];
  eventFollows: EventFollow[];
  eventSuggestions: EventSuggestion[];
  suppressedExternalEvents: string[];
};

function localTiming(event: EventSearchResult) {
  if (!event.startDateTime) {
    return { date: event.date, startMinutes: 0, allDay: true };
  }
  const date = new Date(event.startDateTime);
  if (Number.isNaN(date.getTime())) {
    return { date: event.date, startMinutes: 0, allDay: true };
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return {
    date: `${yyyy}-${mm}-${dd}`,
    startMinutes: date.getHours() * 60 + date.getMinutes(),
    allDay: false,
  };
}

export function eventResultToActivity(
  event: EventSearchResult,
  id: string,
  createdAt: string,
  updatedAt = createdAt,
): Activity {
  const timing = localTiming(event);
  const broadcasts = asEventBroadcasts(event.broadcasts);
  return {
    id,
    categoryId: 'event',
    title: event.title,
    date: timing.date,
    allDay: timing.allDay || undefined,
    startMinutes: timing.startMinutes,
    durationMinutes: event.durationMinutes,
    notes: event.notes,
    status: 'upcoming',
    summary: [event.venue?.name, broadcasts.map((item) => item.name).join(', ')]
      .filter(Boolean)
      .join(' · ') || undefined,
    createdAt,
    updatedAt,
  };
}

export function eventResultToDetails(
  event: EventSearchResult,
  activityId: string,
  now: string,
  options: Pick<EventDetails, 'importMode'> & { followId?: string },
): EventDetails {
  const {
    title: _title,
    startDateTime: _start,
    date: _date,
    allDay: _allDay,
    durationMinutes: _duration,
    notes: _notes,
    participants,
    ...details
  } = event;
  return {
    ...details,
    participants: asEventStringList(participants),
    broadcasts: asEventBroadcasts(details.broadcasts),
    activityId,
    followId: options.followId,
    importMode: options.importMode,
    syncState: 'linked',
    lastSyncedAt: now,
  };
}

export function eventSyncStateAfterSave(
  existing: Activity | undefined,
  details: EventDetails | undefined,
  next: Pick<Activity, 'title' | 'date' | 'startMinutes' | 'durationMinutes'>,
) {
  if (!existing || details?.syncState !== 'linked') return details?.syncState ?? 'linked';
  return existing.title !== next.title
    || existing.date !== next.date
    || existing.startMinutes !== next.startMinutes
    || existing.durationMinutes !== next.durationMinutes
    ? 'detached'
    : 'linked';
}

export function reconcileEventFollows(
  state: ScheduleEventState,
  response: EventFollowSyncResponse,
): ScheduleEventState {
  const activities = [...state.activities];
  const details = [...state.eventDetails];
  const suggestions = [...state.eventSuggestions];
  const suppressed = new Set(state.suppressedExternalEvents);
  const followById = new Map(state.eventFollows.map((follow) => [follow.id, follow]));

  for (const group of response.results) {
    const follow = followById.get(group.followId);
    if (!follow) continue;
    for (const event of group.events) {
      const key = externalEventKey(event.provider, event.providerEventId);
      if (suppressed.has(key)) continue;
      const detailIndex = details.findIndex(
        (item) => item.provider === event.provider && item.providerEventId === event.providerEventId,
      );
      if (detailIndex >= 0) {
        const currentDetails = details[detailIndex];
        const activityIndex = activities.findIndex((item) => item.id === currentDetails.activityId);
        if (event.status === 'cancelled' && currentDetails.importMode === 'auto' && currentDetails.syncState === 'linked') {
          if (activityIndex >= 0) activities.splice(activityIndex, 1);
          details.splice(detailIndex, 1);
          continue;
        }
        details[detailIndex] = {
          ...eventResultToDetails(event, currentDetails.activityId, response.syncedAt, {
            importMode: currentDetails.importMode,
            followId: currentDetails.followId ?? follow.id,
          }),
          syncState: currentDetails.syncState,
        };
        if (activityIndex >= 0 && currentDetails.syncState === 'linked') {
          const current = activities[activityIndex];
          activities[activityIndex] = {
            ...eventResultToActivity(event, current.id, current.createdAt, response.syncedAt),
            status: current.status,
            notes: current.notes,
          };
        }
        continue;
      }

      const suggestionIndex = suggestions.findIndex(
        (item) => item.event.provider === event.provider && item.event.providerEventId === event.providerEventId,
      );
      if (follow.mode === 'review') {
        const suggestion: EventSuggestion = {
          id: suggestionIndex >= 0 ? suggestions[suggestionIndex].id : newId('event-suggestion'),
          followId: follow.id,
          event,
          createdAt: suggestionIndex >= 0 ? suggestions[suggestionIndex].createdAt : response.syncedAt,
        };
        if (suggestionIndex >= 0) suggestions[suggestionIndex] = suggestion;
        else suggestions.push(suggestion);
        continue;
      }

      if (event.status === 'cancelled') continue;
      const id = newId('external-event');
      activities.push(eventResultToActivity(event, id, response.syncedAt));
      details.push(eventResultToDetails(event, id, response.syncedAt, {
        importMode: 'auto',
        followId: follow.id,
      }));
    }
  }

  const syncedFollowIds = new Set(response.results.map((item) => item.followId));
  return {
    activities,
    eventDetails: details,
    eventSuggestions: suggestions,
    suppressedExternalEvents: [...suppressed],
    eventFollows: state.eventFollows.map((follow) => syncedFollowIds.has(follow.id)
      ? { ...follow, lastSyncedAt: response.syncedAt, lastSyncError: undefined, updatedAt: response.syncedAt }
      : follow),
  };
}

export function removeFollowFromSchedule(
  state: ScheduleEventState,
  followId: string,
  removeFuture: boolean,
): ScheduleEventState {
  const removedActivityIds = new Set(
    removeFuture
      ? state.eventDetails
          .filter((detail) => detail.followId === followId && detail.syncState === 'linked')
          .map((detail) => detail.activityId)
      : [],
  );
  const today = todayKey();
  return {
    ...state,
    activities: state.activities.filter(
      (activity) => !removedActivityIds.has(activity.id) || activity.date < today,
    ),
    eventDetails: state.eventDetails.filter((detail) => {
      if (!removedActivityIds.has(detail.activityId)) return true;
      const activity = state.activities.find((item) => item.id === detail.activityId);
      return Boolean(activity && activity.date < today);
    }),
    eventFollows: state.eventFollows.filter((follow) => follow.id !== followId),
    eventSuggestions: state.eventSuggestions.filter((suggestion) => suggestion.followId !== followId),
  };
}

type StoreSet = (
  updater: (state: ScheduleState) => Partial<ScheduleState> | ScheduleState,
) => void;

/** Event-domain actions extracted so the core schedule store stays below its locality budget. */
export function createScheduleEventActions(
  get: () => ScheduleState,
  set: StoreSet,
): Pick<
  ScheduleState,
  | 'addEventFollow'
  | 'removeEventFollow'
  | 'applyEventFollowSync'
  | 'markEventFollowSyncError'
  | 'acceptEventSuggestion'
  | 'dismissEventSuggestion'
> {
  return {
    addEventFollow: (target, mode) => {
      const existing = get().eventFollows.find(
        (follow) => follow.provider === target.provider
          && follow.providerTargetId === target.providerTargetId,
      );
      if (existing) return existing;
      const now = new Date().toISOString();
      const follow: EventFollow = {
        ...target,
        id: newId('event-follow'),
        mode,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({ eventFollows: [...state.eventFollows, follow] }));
      return follow;
    },
    removeEventFollow: (id, removeFuture) =>
      set((state) => removeFollowFromSchedule(state, id, removeFuture)),
    applyEventFollowSync: (response) =>
      set((state) => reconcileEventFollows(state, response)),
    markEventFollowSyncError: (followIds, message) => set((state) => {
      const failedFollowIds = new Set(followIds);
      return {
        eventFollows: state.eventFollows.map((follow) =>
          failedFollowIds.has(follow.id)
            ? { ...follow, lastSyncError: message }
            : follow,
        ),
      };
    }),
    acceptEventSuggestion: (id) => {
      const suggestion = get().eventSuggestions.find((item) => item.id === id);
      if (!suggestion) return undefined;
      const now = new Date().toISOString();
      const activityId = newId('external-event');
      const activity = eventResultToActivity(suggestion.event, activityId, now);
      const detail = eventResultToDetails(suggestion.event, activityId, now, {
        importMode: 'review',
        followId: suggestion.followId,
      });
      set((state) => ({
        activities: [...state.activities, activity],
        eventDetails: [...state.eventDetails, detail],
        eventSuggestions: state.eventSuggestions.filter((item) => item.id !== id),
      }));
      return activity;
    },
    dismissEventSuggestion: (id) => set((state) => {
      const suggestion = state.eventSuggestions.find((item) => item.id === id);
      if (!suggestion) return state;
      const key = externalEventKey(suggestion.event.provider, suggestion.event.providerEventId);
      return {
        eventSuggestions: state.eventSuggestions.filter((item) => item.id !== id),
        suppressedExternalEvents: state.suppressedExternalEvents.includes(key)
          ? state.suppressedExternalEvents
          : [...state.suppressedExternalEvents, key],
      };
    }),
  };
}
