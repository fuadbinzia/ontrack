const mockSearchProviderEvents = jest.fn();
const mockSearchProviderTargets = jest.fn();
const mockEventsForFollow = jest.fn();
const mockLiveUfcEvents = jest.fn();
const mockUfcAthleteProfiles = jest.fn();

jest.mock('@/services/events/server', () => ({
  assertEventsAuthenticated: jest.fn().mockResolvedValue(undefined),
  eventCorsHeaders: { 'Content-Type': 'application/json' },
  eventError: (error: string, status: number, code?: string) =>
    Response.json({ error, ...(code ? { code } : {}) }, { status }),
  eventOptionsResponse: jest.fn(),
  isEventKind: (value: unknown) => value === 'sports' || value === 'nba' || value === 'ufc' || value === 'concert',
  isEventSport: (value: unknown) => ['all', 'basketball', 'football', 'baseball', 'hockey', 'soccer', 'combat', 'motorsport'].includes(String(value)),
  providerErrorResponse: () => Response.json({ error: 'provider failed' }, { status: 502 }),
  searchProviderEvents: (...args: unknown[]) => mockSearchProviderEvents(...args),
  searchProviderTargets: (...args: unknown[]) => mockSearchProviderTargets(...args),
  eventsForFollow: (...args: unknown[]) => mockEventsForFollow(...args),
  liveUfcEvents: (...args: unknown[]) => mockLiveUfcEvents(...args),
  ufcAthleteProfiles: (...args: unknown[]) => mockUfcAthleteProfiles(...args),
}));

// Route modules must load after the server boundary mock.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const searchRoute = require('@/app/api/events/search+api') as typeof import('@/app/api/events/search+api');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const targetsRoute = require('@/app/api/events/targets+api') as typeof import('@/app/api/events/targets+api');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const syncRoute = require('@/app/api/events/sync+api') as typeof import('@/app/api/events/sync+api');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const liveRoute = require('@/app/api/events/ufc-live+api') as typeof import('@/app/api/events/ufc-live+api');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const athletesRoute = require('@/app/api/events/ufc-athletes+api') as typeof import('@/app/api/events/ufc-athletes+api');

beforeEach(() => jest.clearAllMocks());

describe('event API routes', () => {
  it('rejects invalid search kinds and paging before calling providers', async () => {
    const kindResponse = await searchRoute.GET(new Request('https://ontrack.example/api/events/search?kind=nfl'));
    expect(kindResponse.status).toBe(400);
    const pageResponse = await searchRoute.GET(new Request('https://ontrack.example/api/events/search?kind=nba&page=-1'));
    expect(pageResponse.status).toBe(400);
    expect(mockSearchProviderEvents).not.toHaveBeenCalled();
  });

  it('passes normalized search input to the provider boundary', async () => {
    mockSearchProviderEvents.mockResolvedValueOnce([]);
    const response = await searchRoute.GET(new Request('https://ontrack.example/api/events/search?kind=concert&q=%20Artist%20&page=2'));
    expect(response.status).toBe(200);
    expect(mockSearchProviderEvents).toHaveBeenCalledWith('concert', 'Artist', 2, 'all');
    await expect(response.json()).resolves.toMatchObject({ results: [], page: 2, hasMore: false });
  });

  it('passes broad sport filters without requiring an NBA or UFC kind', async () => {
    mockSearchProviderEvents.mockResolvedValueOnce([]);
    const response = await searchRoute.GET(new Request(
      'https://ontrack.example/api/events/search?kind=sports&sport=hockey&q=Rangers',
    ));
    expect(response.status).toBe(200);
    expect(mockSearchProviderEvents).toHaveBeenCalledWith('sports', 'Rangers', 0, 'hockey');

    const invalid = await searchRoute.GET(new Request(
      'https://ontrack.example/api/events/search?kind=sports&sport=quidditch',
    ));
    expect(invalid.status).toBe(400);
  });

  it('rejects oversized follow-target searches', async () => {
    const response = await targetsRoute.GET(new Request(`https://ontrack.example/api/events/targets?kind=sports&q=${'x'.repeat(101)}`));
    expect(response.status).toBe(400);
    expect(mockSearchProviderTargets).not.toHaveBeenCalled();
  });

  it('validates and serves date-scoped UFC live updates', async () => {
    const invalid = await liveRoute.GET(new Request(
      'https://ontrack.example/api/events/ufc-live?date=tomorrow',
    ));
    expect(invalid.status).toBe(400);
    expect(mockLiveUfcEvents).not.toHaveBeenCalled();

    mockLiveUfcEvents.mockResolvedValueOnce([{ providerEventId: 'ufc-330' }]);
    const response = await liveRoute.GET(new Request(
      'https://ontrack.example/api/events/ufc-live?date=2026-08-15',
    ));
    expect(response.status).toBe(200);
    expect(mockLiveUfcEvents).toHaveBeenCalledWith('2026-08-15');
    await expect(response.json()).resolves.toMatchObject({
      results: [{ providerEventId: 'ufc-330' }],
      syncedAt: expect.any(String),
    });
  });

  it('validates and serves at most two UFC athlete profiles', async () => {
    for (const ids of ['', 'abc', '101,202,303']) {
      const response = await athletesRoute.GET(new Request(
        `https://ontrack.example/api/events/ufc-athletes?ids=${ids}`,
      ));
      expect(response.status).toBe(400);
    }
    expect(mockUfcAthleteProfiles).not.toHaveBeenCalled();

    mockUfcAthleteProfiles.mockResolvedValueOnce([
      { providerAthleteId: '101', age: 31 },
      { providerAthleteId: '202', age: 29 },
    ]);
    const response = await athletesRoute.GET(new Request(
      'https://ontrack.example/api/events/ufc-athletes?ids=101,202',
    ));
    expect(response.status).toBe(200);
    expect(mockUfcAthleteProfiles).toHaveBeenCalledWith(['101', '202']);
    await expect(response.json()).resolves.toMatchObject({
      profiles: [
        { providerAthleteId: '101', age: 31 },
        { providerAthleteId: '202', age: 29 },
      ],
    });
  });

  it('rejects malformed and oversized sync payloads', async () => {
    const malformed = await syncRoute.POST(new Request('https://ontrack.example/api/events/sync', {
      method: 'POST', body: JSON.stringify({ follows: [{ id: 'bad' }] }),
    }));
    expect(malformed.status).toBe(400);
    const oversized = await syncRoute.POST(new Request('https://ontrack.example/api/events/sync', {
      method: 'POST', body: JSON.stringify({ follows: Array.from({ length: 26 }, () => ({})) }),
    }));
    expect(oversized.status).toBe(400);
    expect(mockEventsForFollow).not.toHaveBeenCalled();
  });

  it('syncs each validated follow and attaches the follow id', async () => {
    const follow = {
      id: 'follow-1', provider: 'thesportsdb', providerTargetId: 'team-1', kind: 'nba',
      targetKind: 'team', name: 'Knicks', mode: 'auto', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    };
    mockEventsForFollow.mockResolvedValueOnce([{ providerEventId: 'event-1' }]);
    const response = await syncRoute.POST(new Request('https://ontrack.example/api/events/sync', {
      method: 'POST', body: JSON.stringify({ follows: [follow] }),
    }));
    expect(response.status).toBe(200);
    expect(mockEventsForFollow).toHaveBeenCalledWith(follow);
    await expect(response.json()).resolves.toMatchObject({ results: [{ followId: 'follow-1' }] });
  });
});
