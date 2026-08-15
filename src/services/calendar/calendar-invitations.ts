import type { Activity } from '@/types/models';

export const ONTRACK_APP_STORE_URL = 'https://apps.apple.com/app/id6789723522';
export const ONTRACK_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.imtihoss.ontracknow';

const INVITATION_FOOTER = [
  'Shared from onTrack.',
  `Download for iPhone: ${ONTRACK_APP_STORE_URL}`,
  `Download for Android: ${ONTRACK_PLAY_STORE_URL}`,
].join('\n');

const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function normalizedEmail(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function parseCalendarAttendeeEmails(value: string) {
  const emails: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const candidate of value.split(/[,;\n]+/)) {
    const email = normalizedEmail(candidate);
    if (!email) continue;
    if (!EMAIL_PATTERN.test(email)) {
      invalid.push(candidate.trim());
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  return { emails, invalid };
}

export function formatCalendarAttendeeEmails(emails: readonly string[] | undefined) {
  return (emails ?? []).join(', ');
}

export function calendarInvitationDescription(activity: Pick<Activity, 'notes' | 'attendeeEmails'>) {
  if (!activity.attendeeEmails?.length) return activity.notes?.trim() || undefined;
  return [activity.notes?.trim(), INVITATION_FOOTER].filter(Boolean).join('\n\n');
}

export function stripCalendarInvitationFooter(description: string | undefined) {
  const value = description?.trim();
  if (!value) return undefined;
  if (value === INVITATION_FOOTER) return undefined;
  const suffix = `\n\n${INVITATION_FOOTER}`;
  return value.endsWith(suffix) ? value.slice(0, -suffix.length).trim() || undefined : value;
}

export function googleAttendeeEmails(
  attendees: readonly { email?: string; organizer?: boolean; resource?: boolean }[] | undefined,
) {
  const value = (attendees ?? [])
    .filter((attendee) => !attendee.organizer && !attendee.resource)
    .map((attendee) => attendee.email ?? '')
    .join(',');
  return parseCalendarAttendeeEmails(value).emails;
}

export function calendarAttendeeEmailsMatch(
  activityEmails: readonly string[] | undefined,
  googleAttendees: readonly { email?: string; organizer?: boolean; resource?: boolean }[] | undefined,
) {
  const local = parseCalendarAttendeeEmails((activityEmails ?? []).join(',')).emails.sort();
  const remote = googleAttendeeEmails(googleAttendees).sort();
  return local.length === remote.length && local.every((email, index) => email === remote[index]);
}

export function googleCalendarInviteMutationPath(calendarId: string, eventId?: string) {
  const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
  return `${eventId ? `${base}/${encodeURIComponent(eventId)}` : base}?sendUpdates=all`;
}
