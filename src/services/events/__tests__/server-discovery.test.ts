import {
  eventsForFollow,
  liveUfcEvents,
  nbaSeasonForDate,
  resetEventProviderCachesForTests,
  searchProviderEvents,
  sportsLeagueId,
  ufcAthleteProfiles,
} from '@/services/events/server';
import { resetDependencyGuardsForTests } from '@/services/http/dependency-guard';

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  resetDependencyGuardsForTests();
  resetEventProviderCachesForTests();
});

describe('default sports discovery', () => {
  it('uses stable provider league ids across broad sport filters', () => {
    expect(sportsLeagueId('nba')).toBe('4387');
    expect(sportsLeagueId('ufc')).toBe('4443');
    expect(sportsLeagueId('football')).toBe('4391');
    expect(sportsLeagueId('baseball')).toBe('4424');
    expect(sportsLeagueId('hockey')).toBe('4380');
    expect(sportsLeagueId('soccer')).toBe('4346');
    expect(sportsLeagueId('motorsport')).toBe('4370');
  });

  it('selects the NBA season that contains the chosen date', () => {
    expect(nbaSeasonForDate(new Date('2026-08-13T12:00:00Z'))).toBe('2026-2027');
    expect(nbaSeasonForDate(new Date('2027-02-01T12:00:00Z'))).toBe('2026-2027');
  });

  it('uses ESPN for Combat Sports even when the query is empty', async () => {
    fetchMock.mockResolvedValue(Response.json({
      events: [{
        id: '600059185',
        name: 'UFC 330: Makhachev vs. Machado Garry',
        date: '2026-08-15T21:30Z',
        competitions: [{ date: '2026-08-16T01:00Z' }],
      }],
    }));

    const results = await searchProviderEvents('sports', '', 0, 'combat');

    expect(results[0]).toMatchObject({ provider: 'espn', providerEventId: '600059185' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('site.web.api.espn.com');
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('thesportsdb.com');
  });

  it('searches UFC through one free scoreboard request without exhausting TheSportsDB', async () => {
    fetchMock.mockResolvedValue(Response.json({
      events: [{
        id: '600059185',
        name: 'UFC 330: Makhachev vs. Machado Garry',
        date: '2026-08-15T21:00Z',
        competitions: [{ date: '2026-08-16T01:00Z' }],
      }],
    }));

    const results = await searchProviderEvents('sports', 'UFC', 0, 'all');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ provider: 'espn', allDay: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('site.web.api.espn.com');
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('lookuptv.php');
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('thesportsdb.com');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        Referer: 'https://www.espn.com/',
        'User-Agent': expect.stringContaining('onTrack'),
      }),
    });
  });

  it('deduplicates date-scoped live requests inside the short live cache', async () => {
    fetchMock.mockResolvedValue(Response.json({
      events: [{
        id: '600059185',
        name: 'UFC 330: Makhachev vs. Machado Garry',
        date: '2026-08-15T21:00Z',
        status: { type: { description: 'In Progress' } },
        competitions: [{ date: '2026-08-16T01:00Z' }],
      }],
    }));

    const [first, second] = await Promise.all([
      liveUfcEvents('2026-08-15'),
      liveUfcEvents('2026-08-15'),
    ]);

    expect(first[0]).toMatchObject({ providerEventId: '600059185', status: 'in-progress' });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('dates=20260815');
  });

  it('loads and caches only the two requested UFC athlete profiles', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({
        id: '101', age: 31, displayHeight: `5' 11"`, displayWeight: '170 lbs', displayReach: '72"',
      }))
      .mockResolvedValueOnce(Response.json({
        id: '202', age: 29, displayHeight: `6' 1"`, displayWeight: '170 lbs', displayReach: '74"',
      }));

    const first = await ufcAthleteProfiles(['101', '202']);
    const cached = await ufcAthleteProfiles(['101', '202']);

    expect(first).toEqual([
      expect.objectContaining({ providerAthleteId: '101', age: 31, reach: '72"' }),
      expect.objectContaining({ providerAthleteId: '202', age: 29, reach: '74"' }),
    ]);
    expect(cached).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/ufc/athletes/101?');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/ufc/athletes/202?');
  });

  it('falls back to the smaller next-event scoreboard when ranged UFC discovery fails', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('temporary failure', { status: 503 }))
      .mockResolvedValueOnce(Response.json({
        events: [{
          id: '600059185',
          name: 'UFC 330: Makhachev vs. Machado Garry',
          date: '2026-08-15T21:00Z',
          competitions: [{ date: '2026-08-16T01:00Z' }],
        }],
      }));

    const results = await searchProviderEvents('sports', 'UFC', 0, 'all');

    expect(results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      'https://site.web.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',
    );
  });

  it('enriches an already-timed followed UFC event with the complete ESPN fight card', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({
        events: [{
          idEvent: 'sportsdb-ufc-330',
          strEvent: 'UFC 330 Makhachev vs Machado Garry',
          dateEvent: '2026-08-15',
          strTimestamp: '2026-08-16T01:00:00Z',
          strSport: 'Fighting',
          strHomeTeam: 'Islam Makhachev',
          strAwayTeam: 'Ian Machado Garry',
        }],
      }))
      .mockResolvedValueOnce(Response.json({
        events: [{
          id: '600059185',
          name: 'UFC 330: Makhachev vs. Machado Garry',
          date: '2026-08-15T21:00Z',
          competitions: [{
            id: 'main-1',
            date: '2026-08-16T01:00Z',
            type: { abbreviation: 'Welterweight' },
            competitors: [
              { id: '3332412', order: 1, athlete: { displayName: 'Islam Makhachev' }, records: [{ type: 'total', summary: '28-1-0' }] },
              { id: '4738092', order: 2, athlete: { displayName: 'Ian Machado Garry' }, records: [{ type: 'total', summary: '17-1-0' }] },
            ],
          }],
        }],
      }));

    const results = await eventsForFollow({
      id: 'follow-ufc',
      provider: 'thesportsdb',
      providerTargetId: '4443',
      kind: 'ufc',
      targetKind: 'promotion',
      name: 'UFC',
      mode: 'auto',
      createdAt: '2026-08-14T00:00:00Z',
      updatedAt: '2026-08-14T00:00:00Z',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results[0]).toMatchObject({
      startDateTime: '2026-08-16T01:00:00.000Z',
      bouts: [{
        weightClass: 'Welterweight',
        fighters: [
          { name: 'Islam Makhachev', record: '28-1-0' },
          { name: 'Ian Machado Garry', record: '17-1-0' },
        ],
      }],
    });
  });

  it('does not request UFC enrichment for an already-timed non-UFC follow', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({
      events: [{
        idEvent: 'game-1',
        strEvent: 'Lakers at Knicks',
        dateEvent: '2026-11-02',
        strTimestamp: '2026-11-03T00:30:00Z',
        strSport: 'Basketball',
      }],
    }));

    await eventsForFollow({
      id: 'follow-nba',
      provider: 'thesportsdb',
      providerTargetId: '4387',
      kind: 'nba',
      targetKind: 'league',
      name: 'NBA',
      mode: 'auto',
      createdAt: '2026-08-14T00:00:00Z',
      updatedAt: '2026-08-14T00:00:00Z',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
