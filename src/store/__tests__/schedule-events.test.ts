import type { EventFollow, EventFollowSyncResponse, EventSearchResult } from '@/services/events';
import {
  eventResultToActivity,
  eventResultToDetails,
  eventSyncStateAfterSave,
  reconcileEventFollows,
  type ScheduleEventState,
} from '@/store/schedule-events';
import { useSchedule } from '@/store/schedule';
import {
  matchingUfcEvent,
  mergeRichUfcDetails,
  shouldPollUfcLiveUpdates,
} from '@/services/events/sync';

const follow = (mode: EventFollow['mode']): EventFollow => ({
  id: `follow-${mode}`,
  provider: 'thesportsdb',
  providerTargetId: 'team-1',
  kind: 'nba',
  targetKind: 'team',
  name: 'New York Knicks',
  mode,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

const event = (patch: Partial<EventSearchResult> = {}): EventSearchResult => ({
  provider: 'thesportsdb',
  providerEventId: 'game-1',
  kind: 'nba',
  sourceName: 'TheSportsDB',
  title: 'Lakers at Knicks',
  startDateTime: '2026-11-03T00:30:00.000Z',
  date: '2026-11-02',
  allDay: false,
  durationMinutes: 150,
  participants: ['Los Angeles Lakers', 'New York Knicks'],
  venue: { name: 'Madison Square Garden' },
  broadcasts: [{ name: 'ESPN', countryCode: 'US' }],
  status: 'scheduled',
  ...patch,
});

const state = (eventFollows: EventFollow[]): ScheduleEventState => ({
  activities: [],
  eventDetails: [],
  eventFollows,
  eventSuggestions: [],
  suppressedExternalEvents: [],
});

const response = (followId: string, events: EventSearchResult[]): EventFollowSyncResponse => ({
  results: [{ followId, events }],
  syncedAt: '2026-08-13T12:00:00.000Z',
});

describe('follow reconciliation', () => {
  it('auto-adds once and updates the same provider event idempotently', () => {
    const followed = follow('auto');
    const first = reconcileEventFollows(state([followed]), response(followed.id, [event()]));
    expect(first.activities).toHaveLength(1);
    expect(first.eventDetails).toHaveLength(1);
    expect(first.eventDetails[0]).toMatchObject({ importMode: 'auto', followId: followed.id, syncState: 'linked' });

    const updated = reconcileEventFollows(first, response(followed.id, [event({ title: 'Updated matchup', broadcasts: [{ name: 'NBC' }] })]));
    expect(updated.activities).toHaveLength(1);
    expect(updated.activities[0].title).toBe('Updated matchup');
    expect(updated.eventDetails[0].broadcasts).toEqual([{ name: 'NBC' }]);
  });

  it('builds event summaries safely when a sync result is missing broadcast metadata', () => {
    const malformed = { ...event(), broadcasts: null as unknown } as EventSearchResult;
    const activity = eventResultToActivity(malformed, 'activity-legacy', '2026-08-13T12:00:00.000Z');
    expect(activity).toMatchObject({
      id: 'activity-legacy',
      summary: 'Madison Square Garden',
    });
  });

  it('sanitizes malformed event detail fields when saving synced search results', () => {
    const malformed = {
      ...event(),
      participants: [1 as unknown, 'Knicks', 2 as unknown] as unknown[],
      broadcasts: 3 as unknown,
    } as EventSearchResult;
    const details = eventResultToDetails(malformed, 'activity-legacy', '2026-08-13T12:00:00.000Z', {
      importMode: 'auto',
    });
    expect(details).toMatchObject({
      participants: ['Knicks'],
      broadcasts: [],
    });
  });

  it('queues review follows without creating schedule activities', () => {
    const followed = follow('review');
    const next = reconcileEventFollows(state([followed]), response(followed.id, [event()]));
    expect(next.activities).toEqual([]);
    expect(next.eventSuggestions).toHaveLength(1);
    expect(next.eventSuggestions[0].followId).toBe(followed.id);
  });

  it('never re-adds suppressed provider events', () => {
    const followed = follow('auto');
    const current = { ...state([followed]), suppressedExternalEvents: ['thesportsdb:game-1'] };
    expect(reconcileEventFollows(current, response(followed.id, [event()])).activities).toEqual([]);
  });

  it('removes cancelled untouched auto imports but retains detached events with cancellation status', () => {
    const followed = follow('auto');
    const imported = reconcileEventFollows(state([followed]), response(followed.id, [event()]));
    expect(reconcileEventFollows(imported, response(followed.id, [event({ status: 'cancelled' })])).activities).toEqual([]);

    const detached = { ...imported, eventDetails: [{ ...imported.eventDetails[0], syncState: 'detached' as const }] };
    const retained = reconcileEventFollows(detached, response(followed.id, [event({ status: 'cancelled' })]));
    expect(retained.activities).toHaveLength(1);
    expect(retained.eventDetails[0].status).toBe('cancelled');
  });

  it('detaches only when provider-owned schedule fields change', () => {
    const existing = {
      id: 'activity-1', title: 'Game', date: '2026-09-01', startMinutes: 600,
      durationMinutes: 120, categoryId: 'event', status: 'upcoming' as const,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const details = { syncState: 'linked' as const } as Parameters<typeof eventSyncStateAfterSave>[1];
    expect(eventSyncStateAfterSave(existing, details, existing)).toBe('linked');
    expect(eventSyncStateAfterSave(existing, details, { ...existing, startMinutes: 630 })).toBe('detached');
  });
});

describe('schedule event actions', () => {
  beforeEach(() => useSchedule.getState().resetAll());

  it('records sync errors only on follows included in the failed refresh', () => {
    const failed = { ...follow('auto'), id: 'follow-failed' };
    const unrelated = {
      ...follow('review'),
      id: 'follow-unrelated',
      lastSyncError: 'Existing unrelated error',
    };
    useSchedule.setState({ eventFollows: [failed, unrelated] });

    useSchedule.getState().markEventFollowSyncError(
      [failed.id],
      'Provider unavailable',
    );

    expect(useSchedule.getState().eventFollows).toEqual([
      { ...failed, lastSyncError: 'Provider unavailable' },
      unrelated,
    ]);
  });

  it('records the same failed batch error on every attempted follow', () => {
    const first = { ...follow('auto'), id: 'follow-first' };
    const second = { ...follow('review'), id: 'follow-second' };
    const untouched = { ...follow('review'), id: 'follow-untouched' };
    useSchedule.setState({ eventFollows: [first, second, untouched] });

    useSchedule.getState().markEventFollowSyncError(
      [first.id, second.id],
      'Provider unavailable',
    );

    expect(useSchedule.getState().eventFollows).toEqual([
      { ...first, lastSyncError: 'Provider unavailable' },
      { ...second, lastSyncError: 'Provider unavailable' },
      untouched,
    ]);
  });

  it('accepts a review suggestion into the schedule with linked details', () => {
    const followed = useSchedule.getState().addEventFollow({
      provider: 'thesportsdb', providerTargetId: 'team-1', kind: 'nba',
      targetKind: 'team', name: 'New York Knicks',
    }, 'review');
    useSchedule.getState().applyEventFollowSync(response(followed.id, [event()]));
    const suggestion = useSchedule.getState().eventSuggestions[0];
    const activity = useSchedule.getState().acceptEventSuggestion(suggestion.id);
    expect(activity).toBeTruthy();
    expect(useSchedule.getState().eventSuggestions).toEqual([]);
    expect(useSchedule.getState().eventDetails[0]).toMatchObject({
      activityId: activity?.id,
      importMode: 'review',
      syncState: 'linked',
    });
  });

  it('suppresses deleted provider events so foreground sync cannot resurrect them', () => {
    const now = '2026-08-13T12:00:00.000Z';
    const activity = eventResultToActivity(event(), 'activity-1', now);
    const details = eventResultToDetails(event(), activity.id, now, { importMode: 'auto' });
    useSchedule.setState({ activities: [activity], eventDetails: [details] });
    useSchedule.getState().deleteActivity(activity.id);
    expect(useSchedule.getState().suppressedExternalEvents).toContain('thesportsdb:game-1');
    expect(useSchedule.getState().eventDetails).toEqual([]);
  });
});

describe('manual UFC detail backfill', () => {
  const current = eventResultToDetails(event({
    providerEventId: 'legacy-ufc-330',
    kind: 'ufc',
    title: 'UFC 330 Makhachev vs Machado Garry',
    date: '2026-08-15',
    participants: ['Islam Makhachev', 'Ian Machado Garry'],
    card: ['Islam Makhachev vs Ian Machado Garry'],
    bouts: undefined,
  }), 'activity-ufc', '2026-08-14T00:00:00Z', { importMode: 'manual' });
  const rich = event({
    provider: 'espn',
    providerEventId: '600059185',
    kind: 'sports',
    sourceName: 'ESPN',
    title: 'UFC 330: Makhachev vs. Machado Garry',
    date: '2026-08-15',
    bouts: [{
      providerCompetitionId: 'main-1',
      cardSection: 'main',
      weightClass: 'Welterweight',
      fighters: [
        { providerAthleteId: '3332412', name: 'Islam Makhachev', record: '28-1-0' },
        { providerAthleteId: '4738092', name: 'Ian Machado Garry', record: '17-1-0' },
      ],
    }],
  });

  it('matches a legacy manual import to its numbered ESPN event', () => {
    expect(matchingUfcEvent(
      current,
      'UFC 330 Makhachev vs Machado Garry',
      '2026-08-15',
      [rich],
    )).toBe(rich);
  });

  it('adds rich bouts without replacing the saved provider identity and edit state', () => {
    const merged = mergeRichUfcDetails(current, rich, '2026-08-14T12:00:00Z');
    expect(merged).toMatchObject({
      provider: current.provider,
      providerEventId: current.providerEventId,
      activityId: current.activityId,
      importMode: 'manual',
      syncState: 'linked',
      sourceName: 'TheSportsDB · ESPN',
      bouts: rich.bouts,
    });
  });

  it('retains current participants and broadcasts when candidate live data omits malformed arrays', () => {
    const malformed = { ...rich, participants: undefined, broadcasts: undefined } as EventSearchResult;
    const merged = mergeRichUfcDetails(current, malformed, '2026-08-14T12:00:00Z');
    expect(merged.participants).toEqual(current.participants);
    expect(merged.broadcasts).toEqual(current.broadcasts);
    expect(merged.bouts).toEqual(rich.bouts);
  });
});

describe('UFC live polling window', () => {
  const activity = {
    title: 'UFC 330: Makhachev vs. Machado Garry',
    date: '2026-08-15',
    startMinutes: 21 * 60,
  };
  const start = new Date(2026, 7, 15, 21).getTime();

  it('polls around the event and always continues an in-progress event', () => {
    expect(shouldPollUfcLiveUpdates(activity, 'scheduled', start - 6 * 60 * 60 * 1000)).toBe(true);
    expect(shouldPollUfcLiveUpdates(activity, 'scheduled', start + 10 * 60 * 60 * 1000)).toBe(true);
    expect(shouldPollUfcLiveUpdates(activity, 'in-progress', start + 24 * 60 * 60 * 1000)).toBe(true);
  });

  it('does not poll too early, after completion, or for another sport', () => {
    expect(shouldPollUfcLiveUpdates(activity, 'scheduled', start - 6 * 60 * 60 * 1000 - 1)).toBe(false);
    expect(shouldPollUfcLiveUpdates(activity, 'completed', start)).toBe(false);
    expect(shouldPollUfcLiveUpdates({ ...activity, title: 'Knicks at Nets' }, 'scheduled', start)).toBe(false);
  });
});
