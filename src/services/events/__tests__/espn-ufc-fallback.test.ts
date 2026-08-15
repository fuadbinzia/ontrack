const mockApiRequest = jest.fn();

jest.mock('@/services/http/api-client', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

jest.mock('@/services/http/api-url', () => ({
  resolveExpoApiUrl: (path: string) => `https://ontrack.example${path}`,
}));

import { EventServiceError, searchEvents } from '@/services/events';

const ufc330 = {
  id: '600059185',
  name: 'UFC 330: Makhachev vs. Machado Garry',
  date: '2026-08-15T21:30Z',
  competitions: [{ date: '2026-08-16T01:00Z' }],
};

const fetchMock = jest.fn();

beforeEach(() => {
  mockApiRequest.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

describe('UFC discovery on-device scoreboard', () => {
  it('lists tonight’s UFC card without waiting on hosted SportsDB', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ events: [ufc330] }));

    const response = await searchEvents('sports', 'UFC', 0, undefined, 'combat');

    expect(response.results).toEqual([
      expect.objectContaining({
        provider: 'espn',
        providerEventId: '600059185',
        title: 'UFC 330: Makhachev vs. Machado Garry',
        date: '2026-08-15',
      }),
    ]);
    expect(mockApiRequest).not.toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('site.web.api.espn.com');
  });

  it('still lists UFC when Combat Sports is open and SportsDB is not configured', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ events: [ufc330] }));

    const response = await searchEvents('sports', '', 0, undefined, 'combat');

    expect(response.results[0]?.title).toContain('UFC 330');
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('uses hosted search only after the phone cannot reach ESPN', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    mockApiRequest.mockResolvedValueOnce({
      results: [{ provider: 'espn', providerEventId: 'hosted', title: 'Hosted UFC' }],
      page: 0,
      hasMore: false,
    });

    const response = await searchEvents('sports', 'UFC', 0, undefined, 'combat');

    expect(response.results[0]?.providerEventId).toBe('hosted');
    expect(mockApiRequest).toHaveBeenCalled();
  });

  it('surfaces SportsDB’s not-configured error only when ESPN is also unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    mockApiRequest.mockRejectedValueOnce(
      new EventServiceError('Sports schedules are not configured.', 503),
    );

    await expect(searchEvents('sports', 'UFC', 0, undefined, 'combat'))
      .rejects.toMatchObject({
        message: 'Sports schedules are not configured.',
        status: 503,
      });
  });

  it('does not use the UFC scoreboard for other sports or music', async () => {
    mockApiRequest.mockRejectedValue(
      new EventServiceError('Event discovery is temporarily unavailable.', 502),
    );

    await expect(searchEvents('sports', 'Lakers', 0, undefined, 'basketball'))
      .rejects.toMatchObject({ status: 502 });
    await expect(searchEvents('concert', 'UFC', 0, undefined, 'all'))
      .rejects.toMatchObject({ status: 502 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
