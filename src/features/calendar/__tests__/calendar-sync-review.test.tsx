import { render, screen } from '@testing-library/react-native';

import {
  CalendarSyncReview,
  calendarSyncReviewActionLabel,
} from '@/features/calendar/calendar-sync-review';
import type { GoogleCalendarSyncPreviewItem } from '@/services/calendar/google-types';

function item(
  overrides: Partial<GoogleCalendarSyncPreviewItem> = {},
): GoogleCalendarSyncPreviewItem {
  return {
    id: 'event-1',
    title: 'Weekly appointment',
    action: 'update',
    destination: 'ontrack',
    ...overrides,
  };
}

describe('CalendarSyncReview', () => {
  it('shows the exact current and after-sync values for an update', () => {
    render(
      <CalendarSyncReview
        preview={{
          direction: 'from_google',
          changes: [
            item({
              details: [{ label: 'Time', before: '2:00 PM', after: '10:00 AM' }],
              reason: 'Google has a newer edit.',
            }),
          ],
        }}
      />,
    );

    expect(screen.getByText('1 planned change')).toBeTruthy();
    expect(screen.getByText('Current')).toBeTruthy();
    expect(screen.getByText('2:00 PM')).toBeTruthy();
    expect(screen.getByText('After sync')).toBeTruthy();
    expect(screen.getByText('10:00 AM')).toBeTruthy();
    expect(screen.getByText('Google has a newer edit.')).toBeTruthy();
  });

  it('keeps additions and link repairs explicit without inventing a before value', () => {
    render(
      <CalendarSyncReview
        preview={{
          direction: 'two_way',
          changes: [
            item({
              id: 'event-add',
              action: 'create',
              destination: 'google',
              details: [{ label: 'Date', after: 'Aug 14, 2026' }],
            }),
            item({
              id: 'event-link',
              action: 'relink',
              details: [{ label: 'Match', after: 'Same event in both calendars' }],
            }),
          ],
        }}
      />,
    );

    expect(screen.getByText('2 planned changes')).toBeTruthy();
    expect(screen.getByText('Add to Google')).toBeTruthy();
    expect(screen.getByText('Repair calendar link')).toBeTruthy();
    expect(screen.queryByText('Current')).toBeNull();
  });

  it.each([
    ['create', 'google', 'Add to Google'],
    ['update', 'ontrack', 'Update in onTrack'],
    ['delete', 'google', 'Remove from Google'],
    ['relink', 'ontrack', 'Repair calendar link'],
  ] as const)('labels %s changes clearly', (action, destination, expected) => {
    expect(calendarSyncReviewActionLabel(item({ action, destination }))).toBe(expected);
  });
});
