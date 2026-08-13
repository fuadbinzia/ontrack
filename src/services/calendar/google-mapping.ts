import type { Activity } from '@/types/models';
import { isAllDayActivity } from '@/utils/activity-time';
import { addDays, isDateKey } from '@/utils/date';

import type { GoogleCalendarEvent, GoogleCalendarLinkRow } from './google-types';

export function googleCalendarMetadata(
  link: GoogleCalendarLinkRow,
  syncedAt: string,
  recurringEventId?: string,
): NonNullable<Activity['googleCalendar']> {
  return {
    calendarId: link.calendar_id,
    eventId: link.google_event_id,
    ...(recurringEventId ? { recurringEventId } : {}),
    origin: link.origin,
    lastSyncedAt: syncedAt,
  };
}

export function zonedDateParts(date: Date, timeZone: string) {
  const values: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)) values[part.type] = part.value;
  return { date: `${values.year}-${values.month}-${values.day}`, minutes: Number(values.hour) * 60 + Number(values.minute) };
}

function allDayDurationMinutes(startDate: string, endDate: string | undefined) {
  if (!isDateKey(startDate) || !endDate || !isDateKey(endDate)) return 24 * 60;
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const calendarDays = Math.round(
    (Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay))
      / 86_400_000,
  );
  // Google all-day end dates are exclusive. Malformed/reversed ranges still
  // degrade to one day instead of producing a zero or negative duration.
  return Math.max(1, calendarDays) * 24 * 60;
}

export function eventToActivity(event: GoogleCalendarEvent, existing: Activity | undefined, link: GoogleCalendarLinkRow, timeZone: string, syncedAt: string): Activity {
  const allDay = event.start?.date;
  const start = allDay ? { date: allDay, minutes: 0 } : zonedDateParts(new Date(event.start?.dateTime || syncedAt), timeZone);
  const duration = allDay
    ? allDayDurationMinutes(allDay, event.end?.date)
    : event.start?.dateTime && event.end?.dateTime
      ? Math.max(5, Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60_000))
      : 24 * 60;
  return {
    id: link.activity_id,
    title: event.summary?.trim() || 'Untitled event',
    notes: event.description?.trim() || undefined,
    date: start.date,
    allDay: Boolean(allDay) || undefined,
    startMinutes: start.minutes,
    durationMinutes: duration,
    categoryId: existing?.categoryId ?? 'personal',
    status: existing?.status ?? 'upcoming',
    createdAt: existing?.createdAt ?? syncedAt,
    updatedAt: event.updated ?? syncedAt,
    googleCalendar: googleCalendarMetadata(link, syncedAt, event.recurringEventId),
  };
}

export function googleEventAllDay(event: GoogleCalendarEvent) {
  return event.start?.date ? true : undefined;
}

function normalizedEventText(value: string | undefined) {
  return value?.trim() || undefined;
}

/** Compare only fields that onTrack sends to Google Calendar. */
export function googleEventMatchesActivity(
  event: GoogleCalendarEvent,
  activity: Activity,
  timeZone: string,
) {
  if (normalizedEventText(event.summary) !== normalizedEventText(activity.title)) return false;
  if (normalizedEventText(event.description) !== normalizedEventText(activity.notes)) return false;

  if (isAllDayActivity(activity)) {
    const days = Math.max(1, Math.round(activity.durationMinutes / (24 * 60)));
    return event.start?.date === activity.date
      && event.end?.date === addDays(activity.date, days);
  }
  if (!event.start?.dateTime || !event.end?.dateTime) return false;
  try {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    const parts = zonedDateParts(start, timeZone);
    const durationMinutes = Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000));
    return parts.date === activity.date
      && parts.minutes === activity.startMinutes
      && durationMinutes === activity.durationMinutes;
  } catch {
    return false;
  }
}

export function activityBody(activity: Activity, timeZone: string, eventId?: string) {
  if (isAllDayActivity(activity)) {
    const days = Math.max(1, Math.round(activity.durationMinutes / (24 * 60)));
    return {
      ...(eventId ? { id: eventId } : {}),
      status: 'confirmed',
      summary: activity.title,
      description: activity.notes,
      start: { date: activity.date },
      end: { date: addDays(activity.date, days) },
      extendedProperties: { private: { ontrackActivityId: activity.id } },
    };
  }
  const hours = Math.floor(activity.startMinutes / 60).toString().padStart(2, '0');
  const minutes = (activity.startMinutes % 60).toString().padStart(2, '0');
  const start = `${activity.date}T${hours}:${minutes}:00`;
  const endDate = new Date(`${start}Z`);
  endDate.setUTCMinutes(endDate.getUTCMinutes() + activity.durationMinutes);
  const end = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}-${String(endDate.getUTCDate()).padStart(2, '0')}T${String(endDate.getUTCHours()).padStart(2, '0')}:${String(endDate.getUTCMinutes()).padStart(2, '0')}:00`;
  return { ...(eventId ? { id: eventId } : {}), status: 'confirmed', summary: activity.title, description: activity.notes, start: { dateTime: start, timeZone }, end: { dateTime: end, timeZone }, extendedProperties: { private: { ontrackActivityId: activity.id } } };
}

const GOOGLE_EVENT_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuv';

export async function googleEventIdForActivity(userId: string, activityId: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${userId}:${activityId}`)));
  let bits = 0;
  let value = 0;
  let encoded = '';
  for (const byte of digest) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      encoded += GOOGLE_EVENT_ID_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) encoded += GOOGLE_EVENT_ID_ALPHABET[(value << (5 - bits)) & 31];
  return `ontrack${encoded}`;
}
