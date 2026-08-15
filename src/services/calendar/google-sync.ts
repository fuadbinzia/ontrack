import type { Activity } from '@/types/models';
import { buildGoogleBatchBody, parseGoogleBatchResponse, type GoogleBatchOperation } from './google-batch';
import { googleCalendarInviteMutationPath } from './calendar-invitations';
import {
  activityBody,
  eventToActivity,
  googleEventAllDay,
  googleEventMatchesActivity,
  googleCalendarMetadata,
  googleEventIdForActivity,
} from './google-mapping';
import { activityPreviewValues, eventPreviewValues, previewDetails } from './google-preview-details';
import { fetchGoogleApi } from './google-fetch';
import {
  decryptGoogleCalendarToken,
  googleCalendarAccessToken,
  googleCalendarAdmin,
  revokeGoogleCalendarToken,
} from './google-oauth';
import {
  dedupeGoogleCalendarActivities,
  GOOGLE_CALENDAR_MUTATIONS_PER_REQUEST,
  googleCalendarDuplicateEventIds,
  googleCalendarSyncPolicy,
  reconcileGoogleCalendarLinks,
  recoverActivityForGoogleEvent,
} from './google-sync-policy';
import type {
  GoogleCalendarConnectionRow,
  GoogleCalendarDeletion,
  GoogleCalendarEvent,
  GoogleCalendarLinkRow,
  GoogleCalendarSyncDirection,
  GoogleCalendarSyncPreview,
  GoogleCalendarSyncPreviewItem,
} from './google-types';

const GOOGLE_CALENDAR_BATCH_TIMEOUT_MS = 45_000;

export function googleCalendarEventPath(calendarId: string, eventId?: string) {
  const base = `/calendars/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

export async function markConnectionSynced(db: ReturnType<typeof googleCalendarAdmin>, userId: string, syncedAt: string) {
  const { error } = await db.from('google_calendar_connections').update({ last_synced_at: syncedAt }).eq('user_id', userId);
  if (error) throw error;
}

async function connection(userId: string) {
  const { data, error } = await googleCalendarAdmin().from('google_calendar_connections').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as GoogleCalendarConnectionRow | null;
}

export async function googleCalendarStatus(userId: string) {
  const row = await connection(userId);
  return { connected: Boolean(row), email: row?.google_email ?? undefined, lastSyncedAt: row?.last_synced_at ?? undefined, direction: row?.sync_direction ?? 'two_way' };
}

export async function setGoogleCalendarDirection(userId: string, direction: GoogleCalendarSyncDirection) {
  const { data, error } = await googleCalendarAdmin().from('google_calendar_connections')
    .update({ sync_direction: direction, last_synced_at: null })
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Connect Google Calendar before choosing a sync direction.');
  return { direction };
}

async function googleFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetchGoogleApi(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(failure.error?.message || `Google Calendar request failed (${response.status}).`);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

async function googleBatch<T>(token: string, operations: GoogleBatchOperation[]) {
  if (!operations.length) return new Map();
  const boundary = `batch_ontrack_${crypto.randomUUID().replace(/-/g, '')}`;
  const response = await fetchGoogleApi('https://www.googleapis.com/batch/calendar/v3', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/mixed; boundary=${boundary}`,
    },
    body: buildGoogleBatchBody(boundary, operations),
  }, GOOGLE_CALENDAR_BATCH_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Google Calendar batch request failed (${response.status}).`);
  const results = parseGoogleBatchResponse<T>(response.headers.get('content-type'), await response.text());
  if (results.size !== operations.length) throw new Error('Google Calendar returned an incomplete batch response.');
  return results;
}

export function assertGoogleBatchResult<T>(result: { status: number; body?: T } | undefined, allowed: number[]) {
  if (result && allowed.includes(result.status)) return result.body;
  const failure = result?.body as { error?: { message?: string } } | undefined;
  throw new Error(failure?.error?.message || `Google Calendar request failed (${result?.status ?? 'unknown'}).`);
}

async function listEvents(token: string, calendarId: string) {
  const items: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;
  const now = Date.now();
  do {
    const query = new URLSearchParams({ singleEvents: 'true', showDeleted: 'true', maxResults: '2500', timeMin: new Date(now - 366 * 86400_000).toISOString(), timeMax: new Date(now + 731 * 86400_000).toISOString() });
    if (pageToken) query.set('pageToken', pageToken);
    const page = await googleFetch<{ items?: GoogleCalendarEvent[]; nextPageToken?: string }>(token, `${googleCalendarEventPath(calendarId)}?${query}`);
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

const LINK_WRITE_BATCH_SIZE = 1_000;

export function canonicalGoogleCalendarLinks(links: GoogleCalendarLinkRow[]) {
  const byActivity = new Map<string, GoogleCalendarLinkRow>();
  const byEvent = new Map<string, GoogleCalendarLinkRow>();
  for (const link of links) {
    const activityKey = `${link.user_id}:${link.activity_id}`;
    const eventKey = `${link.user_id}:${link.calendar_id}:${link.google_event_id}`;
    const previousActivityLink = byActivity.get(activityKey);
    const previousEventLink = byEvent.get(eventKey);
    if (previousActivityLink) {
      byEvent.delete(`${previousActivityLink.user_id}:${previousActivityLink.calendar_id}:${previousActivityLink.google_event_id}`);
    }
    if (previousEventLink) {
      byActivity.delete(`${previousEventLink.user_id}:${previousEventLink.activity_id}`);
    }
    byActivity.set(activityKey, link);
    byEvent.set(eventKey, link);
  }
  return [...byActivity.values()];
}

export async function upsertGoogleCalendarLinks(
  db: ReturnType<typeof googleCalendarAdmin>,
  links: GoogleCalendarLinkRow[],
) {
  const canonicalLinks = canonicalGoogleCalendarLinks(links);
  for (let offset = 0; offset < canonicalLinks.length; offset += LINK_WRITE_BATCH_SIZE) {
    const { error } = await db.rpc('upsert_google_calendar_event_links', {
      link_rows: canonicalLinks.slice(offset, offset + LINK_WRITE_BATCH_SIZE),
    });
    if (error) throw error;
  }
}

export async function syncGoogleCalendarServer(
  userId: string,
  activities: Activity[],
  deletions: GoogleCalendarDeletion[],
  timeZone: string,
  phase: 'pull' | 'push',
) {
  const row = await connection(userId);
  if (!row) throw new Error('Connect Google Calendar before syncing.');
  const token = await googleCalendarAccessToken(row.refresh_token_ciphertext);
  const db = googleCalendarAdmin();
  const { data, error } = await db.from('google_calendar_event_links').select('*').eq('user_id', userId);
  if (error) throw error;
  let links = (data ?? []) as GoogleCalendarLinkRow[];
  const byEvent = new Map(links.map((link) => [link.google_event_id, link]));
  const byActivity = new Map(links.map((link) => [link.activity_id, link]));
  activities = dedupeGoogleCalendarActivities(activities, links);
  const local = new Map(activities.map((activity) => [activity.id, activity]));
  const syncedAt = new Date().toISOString();
  let imported = 0, exported = 0, updated = 0, removed = 0;
  const direction = row.sync_direction ?? 'two_way';
  const acknowledgedDeletionIds = new Set<string>();
  const deletionsToPush = googleCalendarSyncPolicy.pushesToGoogle(direction) ? deletions : [];
  if (!googleCalendarSyncPolicy.pushesToGoogle(direction)) {
    deletions.forEach((deletion) => acknowledgedDeletionIds.add(deletion.activityId));
  }
  const deletionByActivity = new Map(deletionsToPush.map((deletion) => [deletion.activityId, deletion]));
  const deletionByEvent = new Map(deletionsToPush.map((deletion) => [`${deletion.calendarId}:${deletion.eventId}`, deletion]));

  if (phase === 'pull') {
    const linkEventIdsToDelete = new Set<string>();
    const discoveredLinks: GoogleCalendarLinkRow[] = [];
    const recoveredDeletionLinks: GoogleCalendarLinkRow[] = [];
    const events = await listEvents(token, row.calendar_id);
    const reconciliation = reconcileGoogleCalendarLinks(
      activities,
      links,
      events,
      timeZone,
    );
    if (reconciliation.repaired.length) {
      links = reconciliation.links;
      byEvent.clear();
      byActivity.clear();
      links.forEach((link) => {
        byEvent.set(link.google_event_id, link);
        byActivity.set(link.activity_id, link);
      });
      await upsertGoogleCalendarLinks(db, reconciliation.repaired);
    }

    // A reconnect can intentionally clear stale server mappings. Rebuild only
    // explicit deletion mappings from their persisted local tombstones so the
    // exact provider event is removed without treating a generally missing
    // activity as a deletion.
    for (const deletion of deletionsToPush) {
      if (deletion.calendarId !== row.calendar_id || byActivity.has(deletion.activityId)) continue;
      const recoveredLink: GoogleCalendarLinkRow = {
        user_id: userId,
        calendar_id: deletion.calendarId,
        google_event_id: deletion.eventId,
        activity_id: deletion.activityId,
        origin: deletion.origin,
        google_updated_at: null,
        local_updated_at: null,
        created_at: syncedAt,
      };
      byEvent.set(deletion.eventId, recoveredLink);
      byActivity.set(deletion.activityId, recoveredLink);
      recoveredDeletionLinks.push(recoveredLink);
    }

    // Apply provider deletions before choosing a canonical event. Otherwise a
    // cancelled old link can cause its live replacement to be skipped.
    for (const event of events) {
      if (!event.id || event.status !== 'cancelled') continue;
      const link = byEvent.get(event.id);
      if (!link) continue;
      if (!googleCalendarSyncPolicy.removesFromOnTrack(direction)) {
        link.google_updated_at = event.updated ?? syncedAt;
        if (direction === 'to_google') link.local_updated_at = null;
        discoveredLinks.push(link);
        continue;
      }
      local.delete(link.activity_id);
      if (deletionByActivity.has(link.activity_id)) acknowledgedDeletionIds.add(link.activity_id);
      linkEventIdsToDelete.add(event.id);
      byEvent.delete(event.id);
      byActivity.delete(link.activity_id);
      removed += 1;
    }
    discoveredLinks.push(...recoveredDeletionLinks.filter(
      (link) => byActivity.get(link.activity_id) === link && !acknowledgedDeletionIds.has(link.activity_id),
    ));

    const duplicateEventIds = googleCalendarDuplicateEventIds(events, links);
    const duplicatesToRemove = googleCalendarSyncPolicy.cleansRemoteDuplicates(direction)
      ? [...duplicateEventIds].slice(0, GOOGLE_CALENDAR_MUTATIONS_PER_REQUEST)
      : [];
    if (duplicatesToRemove.length) {
      const operations = duplicatesToRemove.map((eventId, index) => ({
        id: `duplicate-${index}`,
        method: 'DELETE' as const,
        path: `/calendar/v3${googleCalendarEventPath(row.calendar_id, eventId)}`,
      }));
      const results = await googleBatch(token, operations);
      operations.forEach((operation) => assertGoogleBatchResult(results.get(operation.id), [204, 404, 410]));
      removed += duplicatesToRemove.length;
    }

    const localActivityByEvent = new Map(
      [...local.values()].flatMap((activity) => activity.googleCalendar
        ? [[`${activity.googleCalendar.calendarId}:${activity.googleCalendar.eventId}`, activity] as const]
        : []),
    );
    for (const event of events) {
      if (!event.id) continue;
      if (event.status === 'cancelled' || duplicateEventIds.has(event.id)) continue;
      let link = byEvent.get(event.id);
      const deletion = deletionByEvent.get(`${row.calendar_id}:${event.id}`);
      if (deletion) {
        if (link) link.google_updated_at = event.updated ?? syncedAt;
        continue;
      }
      if (!link) {
        const metadataActivity = localActivityByEvent.get(`${row.calendar_id}:${event.id}`);
        const recoveredActivity = metadataActivity ?? recoverActivityForGoogleEvent(
          event,
          row.calendar_id,
          local,
          byActivity,
          timeZone,
        );
        if (!googleCalendarSyncPolicy.importsUnlinkedGoogleEvents(direction) && !recoveredActivity) continue;
        const recoveredActivityId = recoveredActivity?.id;
        link = {
          user_id: userId,
          calendar_id: row.calendar_id,
          google_event_id: event.id,
          activity_id: recoveredActivityId ?? `google-event-${crypto.randomUUID()}`,
          origin: recoveredActivity?.googleCalendar?.origin ?? (recoveredActivity ? 'ontrack' : 'google'),
          google_updated_at: event.updated ?? syncedAt,
          local_updated_at: recoveredActivityId ? local.get(recoveredActivityId)?.updatedAt ?? syncedAt : event.updated ?? syncedAt,
          created_at: syncedAt,
        };
        if (!recoveredActivityId) imported += 1;
        byEvent.set(event.id, link);
        byActivity.set(link.activity_id, link);
      }
      const existing = local.get(link.activity_id);
      const acceptsGoogleChanges = googleCalendarSyncPolicy.acceptsGoogleChanges(direction, link.origin);
      const remoteWins = acceptsGoogleChanges && (
        direction === 'from_google'
        || !existing
        || new Date(event.updated ?? 0).getTime() >= new Date(existing.updatedAt).getTime()
      );
      if (remoteWins) local.set(link.activity_id, eventToActivity(event, existing, link, timeZone, syncedAt));
      else if (existing) {
        local.set(link.activity_id, {
          ...existing,
          // Event shape is provider metadata, not editable local content. Keep
          // date-only vs timed accurate even when newer local copy wins.
          allDay: googleEventAllDay(event),
          googleCalendar: googleCalendarMetadata(
            link,
            syncedAt,
            event.recurringEventId ?? existing.googleCalendar?.recurringEventId,
          ),
        });
      }
      link.google_updated_at = event.updated ?? syncedAt;
      const resolvedActivity = local.get(link.activity_id);
      if (remoteWins || (resolvedActivity && googleEventMatchesActivity(event, resolvedActivity, timeZone))) {
        // Local-only edits (status, category, photos, etc.) may advance updatedAt
        // without changing anything Google stores. Acknowledge that timestamp so
        // the following push phase does not send a phantom event update.
        link.local_updated_at = resolvedActivity?.updatedAt ?? syncedAt;
      }
      discoveredLinks.push(link);
    }
    if (linkEventIdsToDelete.size) {
      const { error: deleteError } = await db.from('google_calendar_event_links')
        .delete()
        .eq('user_id', userId)
        .in('google_event_id', [...linkEventIdsToDelete]);
      if (deleteError) throw deleteError;
    }
    await upsertGoogleCalendarLinks(db, discoveredLinks);
    const hasMoreDuplicates = googleCalendarSyncPolicy.cleansRemoteDuplicates(direction)
      && duplicateEventIds.size > duplicatesToRemove.length;
    if (!hasMoreDuplicates && direction === 'from_google') {
      await markConnectionSynced(db, userId, syncedAt);
      return { activities: [...local.values()], acknowledgedDeletionIds: [...acknowledgedDeletionIds], imported, exported, updated, removed, lastSyncedAt: syncedAt, hasMore: false };
    }
    return { activities: [...local.values()], acknowledgedDeletionIds: [...acknowledgedDeletionIds], imported, exported, updated, removed, lastSyncedAt: syncedAt, hasMore: true, nextPhase: hasMoreDuplicates ? 'pull' as const : 'push' as const };
  }

  if (!googleCalendarSyncPolicy.pushesToGoogle(direction)) {
    await markConnectionSynced(db, userId, syncedAt);
    return { activities, acknowledgedDeletionIds: [...acknowledgedDeletionIds], imported, exported, updated, removed, lastSyncedAt: syncedAt, hasMore: false };
  }

  const deletedActivityIds = new Set(deletionByActivity.keys());
  const deletedLinks = links.filter((link) => googleCalendarSyncPolicy.isExplicitDeletion(link, deletedActivityIds));
  const pendingActivities = activities.filter((activity) => {
    const link = byActivity.get(activity.id);
    return googleCalendarSyncPolicy.hasLocalChanges(activity, link);
  });
  const mutations = [
    ...deletedLinks.map((link) => ({ kind: 'delete' as const, link })),
    ...pendingActivities.map((activity) => ({ kind: 'activity' as const, activity, link: byActivity.get(activity.id) })),
  ].slice(0, GOOGLE_CALENDAR_MUTATIONS_PER_REQUEST);

  if (mutations.length) {
    const createEventIds = new Map<string, string>();
    await Promise.all(mutations.map(async (mutation) => {
      if (mutation.kind === 'activity' && !mutation.link) {
        createEventIds.set(mutation.activity.id, await googleEventIdForActivity(userId, mutation.activity.id));
      }
    }));
    const operations: GoogleBatchOperation[] = mutations.map((mutation, index) => {
      const id = `operation-${index}`;
      if (mutation.kind === 'delete') return {
        id, method: 'DELETE',
        path: `/calendar/v3${googleCalendarInviteMutationPath(row.calendar_id, mutation.link.google_event_id)}`,
      };
      return {
        id,
        method: mutation.link ? 'PATCH' : 'POST',
        path: mutation.link
          ? `/calendar/v3${googleCalendarInviteMutationPath(row.calendar_id, mutation.link.google_event_id)}`
          : `/calendar/v3${googleCalendarInviteMutationPath(row.calendar_id)}`,
        body: activityBody(mutation.activity, timeZone, createEventIds.get(mutation.activity.id)),
      };
    });
    const results = await googleBatch<GoogleCalendarEvent | { error?: { message?: string } }>(token, operations);
    const linksToDelete: string[] = [];
    const linksToUpsert: GoogleCalendarLinkRow[] = [];
    const activityLinks = new Map<string, GoogleCalendarLinkRow>();

    mutations.forEach((mutation, index) => {
      const result = results.get(`operation-${index}`);
      if (mutation.kind === 'delete') {
        assertGoogleBatchResult(result, [204, 404, 410]);
        linksToDelete.push(mutation.link.google_event_id);
        acknowledgedDeletionIds.add(mutation.link.activity_id);
        removed += 1;
        return;
      }
      const event = assertGoogleBatchResult(result, mutation.link ? [200] : [200, 201, 409]) as GoogleCalendarEvent | undefined;
      let link = mutation.link;
      if (!link) {
        const eventId = event?.id ?? createEventIds.get(mutation.activity.id);
        if (!eventId) throw new Error('Google did not return an event id.');
        link = { user_id: userId, calendar_id: row.calendar_id, google_event_id: eventId, activity_id: mutation.activity.id, origin: 'ontrack', google_updated_at: event?.updated ?? syncedAt, local_updated_at: mutation.activity.updatedAt, created_at: syncedAt };
        exported += 1;
      } else {
        link.google_updated_at = event?.updated ?? syncedAt;
        link.local_updated_at = mutation.activity.updatedAt;
        updated += 1;
      }
      linksToUpsert.push(link);
      activityLinks.set(mutation.activity.id, link);
    });

    if (linksToDelete.length) {
      const { error: deleteError } = await db.from('google_calendar_event_links').delete().eq('user_id', userId).in('google_event_id', linksToDelete);
      if (deleteError) throw deleteError;
    }
    await upsertGoogleCalendarLinks(db, linksToUpsert);
    const nextActivities = activities.map((activity) => {
      const link = activityLinks.get(activity.id);
      return link
        ? {
            ...activity,
            googleCalendar: googleCalendarMetadata(
              link,
              syncedAt,
              activity.googleCalendar?.recurringEventId,
            ),
          }
        : activity;
    });
    const hasMore = deletedLinks.length + pendingActivities.length > mutations.length;
    if (hasMore) return { activities: nextActivities, acknowledgedDeletionIds: [...acknowledgedDeletionIds], imported, exported, updated, removed, lastSyncedAt: syncedAt, hasMore, nextPhase: 'push' as const };
    activities = nextActivities;
  }

  await markConnectionSynced(db, userId, syncedAt);
  return { activities, acknowledgedDeletionIds: [...acknowledgedDeletionIds], imported, exported, updated, removed, lastSyncedAt: syncedAt, hasMore: false };
}

function previewItem(
  id: string,
  title: string | undefined,
  action: GoogleCalendarSyncPreviewItem['action'],
  destination: GoogleCalendarSyncPreviewItem['destination'],
  options?: Pick<GoogleCalendarSyncPreviewItem, 'details' | 'reason'>,
): GoogleCalendarSyncPreviewItem {
  return { id, title: title?.trim() || 'Untitled event', action, destination, ...options };
}

export function buildGoogleCalendarSyncPreview(
  direction: GoogleCalendarSyncDirection,
  activities: Activity[],
  deletions: GoogleCalendarDeletion[],
  links: GoogleCalendarLinkRow[],
  events: GoogleCalendarEvent[],
  timeZone = 'UTC',
): GoogleCalendarSyncPreview {
  const reconciliation = reconcileGoogleCalendarLinks(
    activities,
    links,
    events,
    timeZone,
  );
  links = reconciliation.links;
  activities = dedupeGoogleCalendarActivities(activities, links);
  const local = new Map(activities.map((activity) => [activity.id, activity]));
  const byEvent = new Map(links.map((link) => [link.google_event_id, link]));
  const byActivity = new Map(links.map((link) => [link.activity_id, link]));
  const eventById = new Map(events.flatMap((event) => event.id ? [[event.id, event] as const] : []));
  const changes: GoogleCalendarSyncPreviewItem[] = [];
  const recoveredEventIds = new Set<string>();
  const calendarId = links[0]?.calendar_id
    ?? activities.find((activity) => activity.googleCalendar)?.googleCalendar?.calendarId
    ?? 'primary';
  for (const repairedLink of reconciliation.repaired) {
    const activity = local.get(repairedLink.activity_id);
    if (!activity) continue;
    const values = activityPreviewValues(activity);
    changes.push(previewItem(
      `repair-link-${activity.id}`,
      activity.title,
      'relink',
      'ontrack',
      {
        reason: 'The existing onTrack and Google events already match; only their stored connection will be corrected.',
        details: [
          ...(values.Date ? [{ label: 'Date', after: values.Date }] : []),
          ...(values.Time ? [{ label: 'Time', after: values.Time }] : []),
        ],
      },
    ));
  }

  for (const event of events) {
    if (!event.id || byEvent.has(event.id) || event.status === 'cancelled') continue;
    const recoveredActivity = recoverActivityForGoogleEvent(
      event,
      calendarId,
      local,
      byActivity,
      timeZone,
    );
    if (!recoveredActivity) continue;
    const recoveredLink: GoogleCalendarLinkRow = {
      user_id: '',
      calendar_id: calendarId,
      google_event_id: event.id,
      activity_id: recoveredActivity.id,
      origin: recoveredActivity.googleCalendar?.origin ?? 'ontrack',
      google_updated_at: null,
      local_updated_at: null,
      created_at: '',
    };
    byEvent.set(event.id, recoveredLink);
    byActivity.set(recoveredActivity.id, recoveredLink);
    recoveredEventIds.add(event.id);
  }

  const duplicateEventIds = googleCalendarDuplicateEventIds(events, links);
  if (googleCalendarSyncPolicy.cleansRemoteDuplicates(direction)) {
    for (const eventId of duplicateEventIds) {
      changes.push(previewItem(
        `google-duplicate-${eventId}`,
        eventById.get(eventId)?.summary,
        'delete',
        'google',
        { reason: 'Duplicate Google copy of the same onTrack event' },
      ));
    }
  }

  if (googleCalendarSyncPolicy.pushesToGoogle(direction)) {
    const deletedActivityIds = new Set(deletions.map((deletion) => deletion.activityId));
    for (const link of links) {
      if (!googleCalendarSyncPolicy.isExplicitDeletion(link, deletedActivityIds)) continue;
      changes.push(previewItem(
        `google-delete-${link.google_event_id}`,
        local.get(link.activity_id)?.title ?? eventById.get(link.google_event_id)?.summary,
        'delete',
        'google',
        { reason: 'Deleted in onTrack' },
      ));
    }
    for (const activity of activities) {
      const link = byActivity.get(activity.id);
      const event = link ? eventById.get(link.google_event_id) : undefined;
      const providerMatches = Boolean(
        event
        && event.status !== 'cancelled'
        && googleEventMatchesActivity(event, activity, timeZone),
      );
      const providerWouldWin = Boolean(
        link
        && event
        && googleCalendarSyncPolicy.acceptsGoogleChanges(direction, link.origin)
        && new Date(event.updated ?? 0).getTime() >= new Date(activity.updatedAt).getTime(),
      );
      const providerDeletionWins = event?.status === 'cancelled' && direction !== 'to_google';
      const providerOutsideSyncWindow = Boolean(
        link && !event && !googleCalendarSyncPolicy.hasLocalChanges(activity, link),
      );
      if (providerMatches || providerWouldWin || providerDeletionWins || providerOutsideSyncWindow) continue;
      changes.push(previewItem(
        `google-${activity.id}`,
        activity.title,
        link ? 'update' : 'create',
        'google',
        link && event
          ? { details: previewDetails(eventPreviewValues(event, timeZone), activityPreviewValues(activity)) }
          : { details: previewDetails(undefined, activityPreviewValues(activity)) },
      ));
    }
  }

  if (googleCalendarSyncPolicy.importsUnlinkedGoogleEvents(direction)) {
    for (const event of events) {
      if (!event.id) continue;
      if (duplicateEventIds.has(event.id)) continue;
      const link = byEvent.get(event.id);
      if (event.status === 'cancelled') {
        if (
          googleCalendarSyncPolicy.removesFromOnTrack(direction)
          && link
          && local.has(link.activity_id)
        ) {
          changes.push(previewItem(
            `ontrack-delete-${link.activity_id}`,
            local.get(link.activity_id)?.title ?? event.summary,
            'delete',
            'ontrack',
            { reason: 'Deleted in Google' },
          ));
        }
        continue;
      }
      if (!link) {
        changes.push(previewItem(
          `ontrack-create-${event.id}`,
          event.summary,
          'create',
          'ontrack',
          {
            details: previewDetails(undefined, eventPreviewValues(event, timeZone)),
            reason: 'Google event is not linked to an onTrack event',
          },
        ));
        continue;
      }
      const existing = local.get(link.activity_id);
      if (!existing || !googleCalendarSyncPolicy.acceptsGoogleChanges(direction, link.origin)) continue;
      const providerChanged = new Date(event.updated ?? 0).getTime()
        > new Date(link.google_updated_at ?? 0).getTime();
      const remoteWins = direction === 'from_google'
        || new Date(event.updated ?? 0).getTime() >= new Date(existing.updatedAt).getTime();
      if ((providerChanged || recoveredEventIds.has(event.id))
        && remoteWins
        && !googleEventMatchesActivity(event, existing, timeZone)) {
        changes.push(previewItem(
          `ontrack-update-${existing.id}`,
          event.summary,
          'update',
          'ontrack',
          { details: previewDetails(activityPreviewValues(existing), eventPreviewValues(event, timeZone)) },
        ));
      }
    }
  }

  return { direction, changes };
}

/** Read-only plan used for explicit user confirmation before a sync mutates either calendar. */
export async function previewGoogleCalendarSyncServer(
  userId: string,
  activities: Activity[],
  deletions: GoogleCalendarDeletion[],
  timeZone: string,
): Promise<GoogleCalendarSyncPreview> {
  const row = await connection(userId);
  if (!row) throw new Error('Connect Google Calendar before syncing.');
  const db = googleCalendarAdmin();
  const { data, error } = await db.from('google_calendar_event_links').select('*').eq('user_id', userId);
  if (error) throw error;
  const links = (data ?? []) as GoogleCalendarLinkRow[];
  const direction = row.sync_direction ?? 'two_way';
  const events = await listEvents(
    await googleCalendarAccessToken(row.refresh_token_ciphertext),
    row.calendar_id,
  );
  return buildGoogleCalendarSyncPreview(direction, activities, deletions, links, events, timeZone);
}

export async function disconnectGoogleCalendarServer(userId: string, removeExported: boolean) {
  const row = await connection(userId);
  if (!row) return { hasMore: false };
  const db = googleCalendarAdmin();
  if (removeExported) {
    const token = await googleCalendarAccessToken(row.refresh_token_ciphertext);
    const { data, error: linksQueryError } = await db.from('google_calendar_event_links')
      .select('*')
      .eq('user_id', userId)
      .eq('origin', 'ontrack')
      .limit(GOOGLE_CALENDAR_MUTATIONS_PER_REQUEST);
    if (linksQueryError) throw linksQueryError;
    const exportedLinks = (data ?? []) as GoogleCalendarLinkRow[];
    const operations = exportedLinks.map((link, index) => ({
      id: `operation-${index}`,
      method: 'DELETE' as const,
      path: `/calendar/v3${googleCalendarEventPath(link.calendar_id, link.google_event_id)}`,
    }));
    if (operations.length) {
      const results = await googleBatch(token, operations);
      operations.forEach((operation) => assertGoogleBatchResult(results.get(operation.id), [204, 404, 410]));
    }
    if (exportedLinks.length) {
      const { error: linksDeleteError } = await db.from('google_calendar_event_links')
        .delete()
        .eq('user_id', userId)
        .in('google_event_id', exportedLinks.map((link) => link.google_event_id));
      if (linksDeleteError) throw linksDeleteError;
    }
    if (exportedLinks.length === GOOGLE_CALENDAR_MUTATIONS_PER_REQUEST) return { hasMore: true };
  }
  const refreshToken = await decryptGoogleCalendarToken(row.refresh_token_ciphertext);
  await revokeGoogleCalendarToken(refreshToken);
  const { error: linksError } = await db.from('google_calendar_event_links').delete().eq('user_id', userId);
  if (linksError) throw linksError;
  const { error } = await db.from('google_calendar_connections').delete().eq('user_id', userId);
  if (error) throw error;
  return { hasMore: false };
}
