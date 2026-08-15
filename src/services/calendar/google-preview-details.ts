import type { Activity } from '@/types/models';
import { isAllDayActivity } from '@/utils/activity-time';
import { formatDateLong, formatDuration, formatMinutes } from '@/utils/date';

import { googleAttendeeEmails } from './calendar-invitations';
import { zonedDateParts } from './google-mapping';
import type { GoogleCalendarEvent, GoogleCalendarSyncPreviewItem } from './google-types';

type PreviewValues = Partial<Record<'Title' | 'Date' | 'Time' | 'Duration' | 'Guests' | 'Notes', string>>;

export function activityPreviewValues(activity: Activity): PreviewValues {
  return {
    Title: activity.title.trim() || 'Untitled event',
    Date: formatDateLong(activity.date, { year: true }),
    Time: isAllDayActivity(activity) ? 'All day' : formatMinutes(activity.startMinutes),
    Duration: formatDuration(activity.durationMinutes),
    Guests: activity.attendeeEmails?.join(', ') || 'None',
    Notes: activity.notes?.trim() || 'None',
  };
}

export function eventPreviewValues(event: GoogleCalendarEvent, timeZone: string): PreviewValues {
  const values: PreviewValues = {
    Title: event.summary?.trim() || 'Untitled event',
    Guests: googleAttendeeEmails(event.attendees).join(', ') || 'None',
    Notes: event.description?.trim() || 'None',
  };
  if (event.start?.date) {
    values.Date = formatDateLong(event.start.date, { year: true });
    values.Time = 'All day';
    if (event.end?.date) {
      const start = Date.parse(`${event.start.date}T00:00:00Z`);
      const end = Date.parse(`${event.end.date}T00:00:00Z`);
      values.Duration = formatDuration(Math.max(1, Math.round((end - start) / 86_400_000)) * 1_440);
    }
  } else if (event.start?.dateTime) {
    const start = new Date(event.start.dateTime);
    if (!Number.isNaN(start.getTime())) {
      const parts = zonedDateParts(start, timeZone);
      values.Date = formatDateLong(parts.date, { year: true });
      values.Time = formatMinutes(parts.minutes);
      if (event.end?.dateTime) {
        const end = new Date(event.end.dateTime);
        if (!Number.isNaN(end.getTime())) {
          values.Duration = formatDuration(Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000)));
        }
      }
    }
  }
  return values;
}

export function previewDetails(
  before: PreviewValues | undefined,
  after: PreviewValues | undefined,
): NonNullable<GoogleCalendarSyncPreviewItem['details']> {
  const labels: (keyof PreviewValues)[] = ['Title', 'Date', 'Time', 'Duration', 'Guests', 'Notes'];
  return labels.flatMap((label) => {
    const previous = before?.[label];
    const next = after?.[label];
    if (previous === next || (previous === undefined && next === undefined)) return [];
    return [{
      label,
      ...(previous === undefined ? {} : { before: previous }),
      ...(next === undefined ? {} : { after: next }),
    }];
  });
}
