import type { Activity } from '@/types/models';

import type { GoogleCalendarLinkRow, GoogleCalendarSyncDirection } from './google-types';

// EAS Hosting runs on Cloudflare Workers. Keep ample headroom beneath the
// per-invocation subrequest ceiling for auth, token refresh, provider listing,
// redirects, and Supabase reads/writes.
export const GOOGLE_CALENDAR_MUTATIONS_PER_REQUEST = 40;

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

export const googleCalendarSyncPolicy = {
  importsUnlinkedGoogleEvents: (direction: GoogleCalendarSyncDirection) => direction !== 'to_google',
  acceptsGoogleChanges: (direction: GoogleCalendarSyncDirection, origin: GoogleCalendarLinkRow['origin']) =>
    direction === 'from_google' || (direction === 'two_way' && origin === 'google'),
  pushesToGoogle: (direction: GoogleCalendarSyncDirection) => direction !== 'from_google',
  cleansRemoteDuplicates: (direction: GoogleCalendarSyncDirection) => direction !== 'from_google',
};
