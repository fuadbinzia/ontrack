import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EventDiscoveryEditor } from '@/features/events/event-discovery-editor';
import { searchEventFollowTargets, searchEvents } from '@/services/events';
import type { EventSearchResult } from '@/services/events';

jest.mock('@/services/events', () => ({
  searchEvents: jest.fn(),
  searchEventFollowTargets: jest.fn(),
}));

jest.mock('@/components/primitives/loading-block', () => ({
  LoadingBlock: () => null,
}));

jest.mock('@/services/events/sync', () => ({
  refreshEventFollows: jest.fn(),
}));

jest.mock('@/store/schedule', () => ({
  useSchedule: (selector: (state: Record<string, unknown>) => unknown) => selector({
    eventFollows: [],
    eventSuggestions: [],
    addEventFollow: jest.fn(),
    removeEventFollow: jest.fn(),
    acceptEventSuggestion: jest.fn(),
    dismissEventSuggestion: jest.fn(),
  }),
}));

const event: EventSearchResult = {
  provider: 'espn',
  providerEventId: '600059185',
  kind: 'sports',
  sourceName: 'ESPN',
  title: 'UFC 330: Makhachev vs. Machado Garry',
  startDateTime: '2026-08-16T01:00:00.000Z',
  date: '2026-08-15',
  allDay: false,
  durationMinutes: 240,
  participants: ['Islam Makhachev', 'Ian Machado Garry'],
  venue: { name: 'Xfinity Mobile Arena' },
  broadcasts: [{ name: 'Paramount+' }],
  status: 'scheduled',
};

describe('event discovery selection', () => {
  const renderEditor = (onSelect: (value: EventSearchResult) => void) => render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      }}>
      <EventDiscoveryEditor onSelect={onSelect} />
    </SafeAreaProvider>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.mocked(searchEvents).mockResolvedValue({ results: [event], page: 0, hasMore: false });
    jest.mocked(searchEventFollowTargets).mockResolvedValue({ results: [] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('collapses results to visible confirmation when an event is tapped', async () => {
    const onSelect = jest.fn();
    const screen = renderEditor(onSelect);

    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByLabelText(`Select ${event.title}`)).toBeTruthy());
    expect(screen.queryByText('ESPN')).toBeNull();

    fireEvent.press(screen.getByLabelText(`Select ${event.title}`));

    expect(onSelect).toHaveBeenCalledWith(event);
    expect(screen.getByText('Selected event')).toBeTruthy();
    expect(screen.getByTestId('ontrack.activityForm.event.changeSelection')).toBeTruthy();
    expect(screen.queryByText('Matching events')).toBeNull();
  });

  it('returns to the existing results without another provider request', async () => {
    const screen = renderEditor(jest.fn());
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });
    fireEvent.press(await screen.findByLabelText(`Select ${event.title}`));
    fireEvent.press(screen.getByTestId('ontrack.activityForm.event.changeSelection'));

    expect(screen.getByLabelText(`Select ${event.title}`)).toBeTruthy();
    expect(searchEvents).toHaveBeenCalledTimes(1);
  });
});
