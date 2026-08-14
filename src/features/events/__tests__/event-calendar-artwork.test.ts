import { resolveEventCalendarArtwork } from '@/features/events/event-calendar-artwork';
import type { EventDetails, EventFollow } from '@/services/events';

const details = (patch: Partial<EventDetails> = {}): EventDetails => ({
  activityId: 'activity-1',
  provider: 'espn',
  providerEventId: 'event-1',
  kind: 'sports',
  sourceName: 'ESPN',
  participants: [],
  broadcasts: [],
  status: 'scheduled',
  importMode: 'manual',
  syncState: 'linked',
  lastSyncedAt: '2026-08-14T00:00:00.000Z',
  ...patch,
});

const follow: EventFollow = {
  id: 'follow-1',
  provider: 'thesportsdb',
  providerTargetId: 'team-1',
  kind: 'sports',
  targetKind: 'team',
  name: 'Example City Comets',
  imageUrl: 'https://img.example/comets-logo.png',
  mode: 'auto',
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
};

describe('calendar event artwork', () => {
  it('prefers the followed team or artist logo over event photography', () => {
    expect(resolveEventCalendarArtwork(
      'Comets at Meteors',
      details({ imageUrl: 'https://img.example/game-photo.jpg', followId: follow.id }),
      follow,
    )).toEqual({
      uri: follow.imageUrl,
      contentFit: 'contain',
      accessibilityLabel: 'Example City Comets logo',
    });
  });

  it('uses a recognizable league logo for UFC, including legacy UFC details', () => {
    expect(resolveEventCalendarArtwork('UFC 330: Main Event', details()))
      .toMatchObject({ uri: expect.stringContaining('/ufc.png'), contentFit: 'contain' });
    expect(resolveEventCalendarArtwork('Main Event', details({ kind: 'ufc' })))
      .toMatchObject({ accessibilityLabel: 'UFC logo' });
  });

  it('uses provider event artwork when no logo can be identified', () => {
    expect(resolveEventCalendarArtwork(
      'Live at the Garden',
      details({ kind: 'concert', imageUrl: 'https://img.example/concert.jpg' }),
    )).toEqual({
      uri: 'https://img.example/concert.jpg',
      contentFit: 'cover',
      accessibilityLabel: 'Live at the Garden artwork',
    });
  });

  it('treats followed artist imagery as artwork instead of stretching it like a logo', () => {
    expect(resolveEventCalendarArtwork('Live at the Garden', undefined, {
      ...follow,
      targetKind: 'artist',
      name: 'The Example Band',
    })).toMatchObject({
      contentFit: 'cover',
      accessibilityLabel: 'The Example Band artwork',
    });
  });

  it('leaves ordinary calendar entries on the category-icon fallback', () => {
    expect(resolveEventCalendarArtwork('Neighborhood meetup', details())).toBeUndefined();
    expect(resolveEventCalendarArtwork('Neighborhood meetup')).toBeUndefined();
  });
});
