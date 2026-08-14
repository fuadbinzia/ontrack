import type { EventDetails } from '@/services/events';
import { refreshLiveUfcEventDetails } from '@/services/events/sync';
import { useSchedule } from '@/store/schedule';

const mockFetchLiveUfcEvents = jest.fn();

jest.mock('@/services/events/index', () => ({
  fetchLiveUfcEvents: (...args: unknown[]) => mockFetchLiveUfcEvents(...args),
  searchEvents: jest.fn(),
  syncEventFollows: jest.fn(),
}));

const details: EventDetails = {
  activityId: 'activity-ufc-live',
  provider: 'espn',
  providerEventId: 'event-330',
  kind: 'sports',
  sourceName: 'ESPN',
  participants: ['Fighter One', 'Fighter Two'],
  broadcasts: [],
  status: 'scheduled',
  importMode: 'manual',
  syncState: 'linked',
  lastSyncedAt: '2026-08-15T20:00:00.000Z',
};

beforeEach(() => {
  mockFetchLiveUfcEvents.mockReset();
  useSchedule.setState({
    activities: [{
      id: 'activity-ufc-live',
      date: '2026-08-15',
      title: 'UFC 330: Fighter One vs. Fighter Two',
      categoryId: 'event',
      startMinutes: 21 * 60,
      durationMinutes: 240,
      status: 'upcoming',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }],
    eventDetails: [details],
  });
});

describe('UFC live detail refresh', () => {
  it('merges live bout status and winner data into the saved event', async () => {
    mockFetchLiveUfcEvents.mockResolvedValueOnce({
      syncedAt: '2026-08-16T01:12:00.000Z',
      results: [{
        provider: 'espn',
        providerEventId: 'event-330',
        kind: 'sports',
        sourceName: 'ESPN',
        title: 'UFC 330: Fighter One vs. Fighter Two',
        date: '2026-08-15',
        allDay: false,
        durationMinutes: 240,
        participants: ['Fighter One', 'Fighter Two'],
        broadcasts: [],
        status: 'in-progress',
        bouts: [{
          providerCompetitionId: 'bout-main',
          cardSection: 'main',
          status: 'In Progress',
          period: 2,
          displayClock: '3:04',
          fighters: [
            { providerAthleteId: 'one', name: 'Fighter One', winner: true },
            { providerAthleteId: 'two', name: 'Fighter Two', winner: false },
          ],
        }],
      }],
    });
    const controller = new AbortController();

    await refreshLiveUfcEventDetails('activity-ufc-live', controller.signal);

    expect(mockFetchLiveUfcEvents).toHaveBeenCalledWith('2026-08-15', controller.signal);
    expect(useSchedule.getState().eventDetails[0]).toMatchObject({
      status: 'in-progress',
      lastSyncedAt: '2026-08-16T01:12:00.000Z',
      bouts: [{
        status: 'In Progress',
        period: 2,
        displayClock: '3:04',
        fighters: [{ name: 'Fighter One', winner: true }, { name: 'Fighter Two', winner: false }],
      }],
    });
  });

  it('does not request live data for a missing or non-UFC activity', async () => {
    useSchedule.setState((state) => ({
      activities: state.activities.map((activity) => ({ ...activity, title: 'Concert' })),
    }));

    await refreshLiveUfcEventDetails('activity-ufc-live');
    await refreshLiveUfcEventDetails('missing');

    expect(mockFetchLiveUfcEvents).not.toHaveBeenCalled();
  });
});
