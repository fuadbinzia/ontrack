import {
  canonicalGoogleCalendarLinks,
  upsertGoogleCalendarLinks,
} from '../google-sync';
import type { GoogleCalendarLinkRow } from '../google-types';

const link = (
  activityId: string,
  eventId: string,
  updatedAt = '2026-08-13T12:00:00.000Z',
): GoogleCalendarLinkRow => ({
  user_id: '00000000-0000-4000-8000-000000000001',
  calendar_id: 'primary',
  google_event_id: eventId,
  activity_id: activityId,
  origin: 'ontrack',
  google_updated_at: updatedAt,
  local_updated_at: updatedAt,
  created_at: '2026-08-13T10:00:00.000Z',
});

it('replaces a stale Google event mapping for the same activity before the database write', () => {
  expect(canonicalGoogleCalendarLinks([
    link('activity-1', 'old-google-event'),
    link('activity-1', 'replacement-google-event'),
  ])).toEqual([
    link('activity-1', 'replacement-google-event'),
  ]);
});

it('keeps one activity when the same Google event is rediscovered concurrently', () => {
  expect(canonicalGoogleCalendarLinks([
    link('temporary-import-id', 'google-event-1'),
    link('canonical-import-id', 'google-event-1'),
  ])).toEqual([
    link('canonical-import-id', 'google-event-1'),
  ]);
});

it('uses the atomic link RPC instead of a single-constraint table upsert', async () => {
  const rpc = jest.fn().mockResolvedValue({ error: null });
  const replacement = link('activity-1', 'replacement-google-event');

  await upsertGoogleCalendarLinks({ rpc } as never, [
    link('activity-1', 'old-google-event'),
    replacement,
  ]);

  expect(rpc).toHaveBeenCalledWith('upsert_google_calendar_event_links', {
    link_rows: [replacement],
  });
});

it('still reports database failures that are not uniqueness races', async () => {
  const failure = { message: 'Database connection unavailable.' };
  const rpc = jest.fn().mockResolvedValue({ error: failure });

  await expect(upsertGoogleCalendarLinks({ rpc } as never, [link('activity-1', 'google-event-1')]))
    .rejects.toBe(failure);
});
