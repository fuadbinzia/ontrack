import { buildGoogleBatchBody, parseGoogleBatchResponse } from '../google-batch';
import { assertGoogleBatchResult } from '../google-sync';
import { dedupeGoogleCalendarActivities, googleEventIdForActivity } from '../google-server';

it('builds and correlates a Google Calendar multipart batch', () => {
  const request = buildGoogleBatchBody('request-boundary', [{
    id: 'operation-0', method: 'POST', path: '/calendar/v3/calendars/primary/events', body: { summary: 'Plan' },
  }]);
  expect(request).toContain('Content-ID: <operation-0>');
  expect(request).toContain('POST /calendar/v3/calendars/primary/events HTTP/1.1');

  const response = [
    '--response-boundary',
    'Content-Type: application/http',
    'Content-ID: <response-operation-0>',
    '',
    'HTTP/1.1 200 OK',
    'Content-Type: application/json',
    '',
    '{"id":"google-1"}',
    '--response-boundary--',
    '',
  ].join('\r\n');
  expect(parseGoogleBatchResponse<{ id: string }>('multipart/mixed; boundary=response-boundary', response).get('operation-0'))
    .toEqual({ status: 200, body: { id: 'google-1' } });
});

it('does not discard unlink mappings when Google rejects an embedded deletion', () => {
  expect(() => assertGoogleBatchResult({
    status: 403,
    body: { error: { message: 'Calendar permission denied.' } },
  }, [204, 404, 410])).toThrow('Calendar permission denied.');
  expect(() => assertGoogleBatchResult({ status: 404 }, [204, 404, 410])).not.toThrow();
});

it('uses a stable Google event id so concurrent retries cannot create duplicates', async () => {
  const first = await googleEventIdForActivity('user-1', 'activity-1');
  const retry = await googleEventIdForActivity('user-1', 'activity-1');
  expect(retry).toBe(first);
  expect(first).toMatch(/^ontrack[0-9a-v]+$/);
  expect(await googleEventIdForActivity('user-1', 'activity-2')).not.toBe(first);
});

it('keeps only the database-linked local copy of a Google event', () => {
  const common = {
    title: 'Plan', date: '2026-08-12', startMinutes: 600, durationMinutes: 60,
    categoryId: 'personal', status: 'upcoming' as const,
    createdAt: '2026-08-12T10:00:00.000Z', updatedAt: '2026-08-12T10:00:00.000Z',
    googleCalendar: { calendarId: 'primary', eventId: 'google-1', origin: 'google' as const, lastSyncedAt: '2026-08-12T10:00:00.000Z' },
  };
  const result = dedupeGoogleCalendarActivities(
    [{ ...common, id: 'stale-copy' }, { ...common, id: 'linked-copy' }],
    [{ calendar_id: 'primary', google_event_id: 'google-1', activity_id: 'linked-copy' }],
  );
  expect(result.map((activity) => activity.id)).toEqual(['linked-copy']);
});
