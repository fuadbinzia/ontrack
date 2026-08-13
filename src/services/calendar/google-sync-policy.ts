import type { Activity } from '@/types/models';

import type {
  GoogleCalendarEvent,
  GoogleCalendarLinkRow,
  GoogleCalendarSyncDirection,
} from './google-types';
import { googleEventMatchesActivity } from './google-mapping';

// EAS Hosting runs on Cloudflare Workers. Keep ample headroom beneath the
// per-invocation subrequest ceiling for auth, token refresh, provider listing,
// redirects, and Supabase reads/writes.
export const GOOGLE_CALENDAR_MUTATIONS_PER_REQUEST = 20;

export function dedupeGoogleCalendarActivities(
  activities: Activity[],
  links: Pick<GoogleCalendarLinkRow, 'calendar_id' | 'google_event_id' | 'activity_id'>[],
) {
  const preferredActivityByEvent = new Map(links.map((link) => [`${link.calendar_id}:${link.google_event_id}`, link.activity_id]));
  const chosenByEvent = new Map<string, Activity>();
  const ordinary: Activity[] = [];
  for (const activity of activities) {
    const metadata = activity.googleCalendar;
    if (!metadata) {
      ordinary.push(activity);
      continue;
    }
    const key = `${metadata.calendarId}:${metadata.eventId}`;
    const current = chosenByEvent.get(key);
    const preferredId = preferredActivityByEvent.get(key);
    if (!current || (activity.id === preferredId && current.id !== preferredId)) chosenByEvent.set(key, activity);
  }
  return [...ordinary, ...chosenByEvent.values()];
}

/**
 * Only standalone events can be cleaned as duplicates. Google recurring
 * occurrences may inherit the same private marker from their parent series,
 * so sharing an activity marker is not evidence that an occurrence is a copy.
 */
export function googleCalendarDuplicateEventIds(
  events: GoogleCalendarEvent[],
  links: Pick<GoogleCalendarLinkRow, 'google_event_id' | 'activity_id'>[],
) {
  const linkedEventByActivity = new Map(
    links.map((link) => [link.activity_id, link.google_event_id]),
  );
  const standaloneByActivity = new Map<string, GoogleCalendarEvent[]>();
  for (const event of events) {
    const activityId = event.status !== 'cancelled' && !event.recurringEventId
      ? event.extendedProperties?.private?.ontrackActivityId
      : undefined;
    if (!activityId || !event.id) continue;
    const group = standaloneByActivity.get(activityId) ?? [];
    group.push(event);
    standaloneByActivity.set(activityId, group);
  }

  const duplicates = new Set<string>();
  for (const [activityId, group] of standaloneByActivity) {
    if (group.length < 2) continue;
    const linkedEventId = linkedEventByActivity.get(activityId);
    // If the recorded canonical event is outside the fetched window or no
    // longer returned by Google, deleting every visible candidate is unsafe.
    if (linkedEventId && !group.some((event) => event.id === linkedEventId)) continue;
    const canonical = linkedEventId
      ? group.find((event) => event.id === linkedEventId)!
      : [...group].sort((left, right) => String(left.id).localeCompare(String(right.id)))[0];
    for (const event of group) if (event.id !== canonical.id) duplicates.add(event.id!);
  }
  return duplicates;
}

/**
 * Repairs stale/crossed server links only when local Google-visible content
 * identifies one live provider event unambiguously. This prevents an old link
 * from making a current 2 PM event look like a remote change to 10 AM.
 */
export function reconcileGoogleCalendarLinks(
  activities: Activity[],
  links: GoogleCalendarLinkRow[],
  events: GoogleCalendarEvent[],
  timeZone: string,
) {
  const local = new Map(activities.map((activity) => [activity.id, activity]));
  const liveEvents = events.filter((event) => event.id && event.status !== 'cancelled');
  const eventById = new Map(liveEvents.map((event) => [event.id!, event]));
  const ownerByEvent = new Map(links.map((link) => [link.google_event_id, link.activity_id]));
  const proposals = new Map<string, string>();
  const proposalCounts = new Map<string, number>();

  for (const link of links) {
    const activity = local.get(link.activity_id);
    if (!activity) continue;
    const currentEvent = eventById.get(link.google_event_id);
    if (currentEvent && googleEventMatchesActivity(currentEvent, activity, timeZone)) continue;
    const matches = liveEvents.filter((event) =>
      googleEventMatchesActivity(event, activity, timeZone));
    if (matches.length !== 1) continue;
    const eventId = matches[0].id!;
    proposals.set(activity.id, eventId);
    proposalCounts.set(eventId, (proposalCounts.get(eventId) ?? 0) + 1);
  }

  const safeProposals = new Map(
    [...proposals].filter(([activityId, eventId]) => {
      if (proposalCounts.get(eventId) !== 1) return false;
      const currentOwner = ownerByEvent.get(eventId);
      return !currentOwner
        || !local.has(currentOwner)
        || (proposals.has(currentOwner) && proposals.get(currentOwner) !== eventId)
        || currentOwner === activityId;
    }),
  );
  const repaired: GoogleCalendarLinkRow[] = [];
  const reconciled = links.map((link) => {
    const eventId = safeProposals.get(link.activity_id);
    if (!eventId || eventId === link.google_event_id) return link;
    const next = { ...link, google_event_id: eventId };
    repaired.push(next);
    return next;
  });
  return { links: reconciled, repaired };
}

export function recoverActivityForGoogleEvent(
  event: GoogleCalendarEvent,
  calendarId: string,
  local: Map<string, Activity>,
  byActivity: Map<string, GoogleCalendarLinkRow>,
  timeZone: string,
) {
  if (!event.id) return undefined;
  const metadataMatch = [...local.values()].find((activity) =>
    activity.googleCalendar?.calendarId === calendarId
    && activity.googleCalendar.eventId === event.id,
  );
  if (metadataMatch) return metadataMatch;

  const markedActivityId = event.extendedProperties?.private?.ontrackActivityId;
  const markedActivity = markedActivityId ? local.get(markedActivityId) : undefined;
  if (markedActivity && !byActivity.has(markedActivity.id)) return markedActivity;

  const contentMatches = [...local.values()].filter((activity) =>
    !byActivity.has(activity.id)
    && googleEventMatchesActivity(event, activity, timeZone),
  );
  return contentMatches.length === 1 ? contentMatches[0] : undefined;
}

export const googleCalendarSyncPolicy = {
  importsUnlinkedGoogleEvents: (direction: GoogleCalendarSyncDirection) => direction !== 'to_google',
  acceptsGoogleChanges: (direction: GoogleCalendarSyncDirection, origin: GoogleCalendarLinkRow['origin']) =>
    direction === 'from_google' || (direction === 'two_way' && origin === 'google'),
  pushesToGoogle: (direction: GoogleCalendarSyncDirection) => direction !== 'from_google',
  removesFromOnTrack: (direction: GoogleCalendarSyncDirection) => direction === 'two_way',
  cleansRemoteDuplicates: (direction: GoogleCalendarSyncDirection) => direction !== 'from_google',
  hasLocalChanges: (activity: Pick<Activity, 'updatedAt'>, link: Pick<GoogleCalendarLinkRow, 'local_updated_at'> | undefined) =>
    !link || new Date(activity.updatedAt).getTime() > new Date(link.local_updated_at ?? 0).getTime(),
  isExplicitDeletion: (link: Pick<GoogleCalendarLinkRow, 'activity_id'>, deletedActivityIds: ReadonlySet<string>) =>
    deletedActivityIds.has(link.activity_id),
};
