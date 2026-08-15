import {
  canViewerSeeItineraryItem,
  compactSharedItineraryPayload,
  isItineraryItemOwnedBy,
  itineraryShareCueLabel,
  mergeOwnedItineraryItemWithRemote,
  pickNewerItineraryItem,
  preserveOwnedItinerarySecrets,
  sortedVisibleItineraryForViewer,
  visibleItineraryForViewer,
} from '../itinerary-visibility';
import { normalizeTravelItineraryItem } from '../normalize';
import type { TravelItineraryItem } from '../types';

function flightItem(
  overrides: Partial<TravelItineraryItem> = {},
): TravelItineraryItem {
  return {
    id: 'item-1',
    kind: 'flight',
    title: 'Flight MIA → JFK',
    date: '2026-09-08',
    startMinutes: 600,
    durationMinutes: 180,
    shareMode: 'trip',
    bookingUrl: 'https://example.com/book',
    flight: {
      airline: 'AA',
      flightNumber: '100',
      confirmationCode: 'ABC123',
      departureAirport: 'MIA',
      arrivalAirport: 'JFK',
      seat: '12A',
      passengerName: 'Alex Rivera',
    },
    ...overrides,
  };
}

describe('itinerary visibility', () => {
  it('defaults missing shareMode to trip on normalize', () => {
    const normalized = normalizeTravelItineraryItem({
      id: 'item-legacy',
      kind: 'activity',
      title: 'Museum',
      date: '2026-09-09',
      startMinutes: 600,
      durationMinutes: 90,
    });
    expect(normalized?.shareMode).toBe('trip');
  });

  it('collapses legacy private and selected share modes to trip', () => {
    expect(
      normalizeTravelItineraryItem({
        id: 'item-legacy-private',
        kind: 'moment',
        title: 'Sunset',
        date: '2026-09-09',
        startMinutes: 600,
        durationMinutes: 30,
        shareMode: 'private',
      })?.shareMode,
    ).toBe('trip');
    expect(
      normalizeTravelItineraryItem({
        id: 'item-legacy-selected',
        kind: 'activity',
        title: 'Museum',
        date: '2026-09-09',
        startMinutes: 600,
        durationMinutes: 90,
        shareMode: 'selected',
      })?.shareMode,
    ).toBe('trip');
  });

  it('treats missing owner as owned by the viewer', () => {
    expect(isItineraryItemOwnedBy(flightItem(), 'user-me')).toBe(true);
    expect(
      isItineraryItemOwnedBy(
        flightItem({ ownerUserId: 'user-other' }),
        'user-me',
      ),
    ).toBe(false);
  });

  it('shows every stop to co-travelers', () => {
    const peerPrivateLegacy = flightItem({
      id: 'item-peer',
      ownerUserId: 'user-host',
    });
    const tripShared = flightItem({
      id: 'item-trip',
      ownerUserId: 'user-host',
      shareMode: 'trip',
    });
    expect(canViewerSeeItineraryItem(peerPrivateLegacy, 'user-me')).toBe(true);
    expect(canViewerSeeItineraryItem(tripShared, 'user-me')).toBe(true);
    expect(
      visibleItineraryForViewer(
        [ownedItem(), peerPrivateLegacy, tripShared],
        'user-me',
      ).map((item) => item.id),
    ).toEqual(['item-mine', 'item-peer', 'item-trip']);
  });

  it('sorts visible stops without mutating their store-backed order', () => {
    const later = flightItem({ id: 'item-later', date: '2026-09-09', startMinutes: 600 });
    const early = flightItem({ id: 'item-early', date: '2026-09-08', startMinutes: 480 });
    const lateSameDay = flightItem({ id: 'item-late-same-day', date: '2026-09-08', startMinutes: 900 });
    const items = [later, lateSameDay, early];

    expect(
      sortedVisibleItineraryForViewer(items, 'user-me').map((item) => item.id),
    ).toEqual(['item-early', 'item-late-same-day', 'item-later']);
    expect(items.map((item) => item.id)).toEqual([
      'item-later',
      'item-late-same-day',
      'item-early',
    ]);
  });

  it('returns an independent list when visible stops are already sorted', () => {
    const items = [
      flightItem({ id: 'item-first', startMinutes: 480 }),
      flightItem({ id: 'item-second', startMinutes: 600 }),
    ];

    const sorted = sortedVisibleItineraryForViewer(items, undefined);

    expect(sorted).not.toBe(items);
    expect(sorted).toEqual(items);
  });

  it('strips booking secrets from shared payloads', () => {
    const compact = compactSharedItineraryPayload(
      flightItem({
        ownerUserId: 'user-me',
        shareMode: 'trip',
        photoUris: ['file:///photo.jpg'],
      }),
    );
    expect(compact.bookingUrl).toBeUndefined();
    expect(compact.photoUris).toBeUndefined();
    expect(compact.flight?.confirmationCode).toBeUndefined();
    expect(compact.flight?.seat).toBeUndefined();
    expect(compact.flight?.passengerName).toBeUndefined();
    expect(compact.flight?.airline).toBe('AA');
    expect(compact.flight?.departureAirport).toBe('MIA');
    expect(compact.shareMode).toBe('trip');
  });

  it('merges remote share metadata onto owned local items without dropping secrets', () => {
    const local = flightItem({
      ownerUserId: 'user-me',
      shareMode: 'trip',
    });
    const remote = flightItem({
      ownerUserId: 'user-me',
      shareMode: 'trip',
      sharedUpdatedAt: '2026-08-07T12:00:00.000Z',
      flight: { airline: 'AA', flightNumber: '100' },
    });
    const merged = mergeOwnedItineraryItemWithRemote(local, remote);
    expect(merged.shareMode).toBe('trip');
    expect(merged.flight?.confirmationCode).toBe('ABC123');
    expect(merged.flight?.seat).toBe('12A');
  });

  it('picks newer sharedUpdatedAt for LWW', () => {
    const older = flightItem({
      sharedUpdatedAt: '2026-08-07T10:00:00.000Z',
      title: 'Older',
    });
    const newer = flightItem({
      sharedUpdatedAt: '2026-08-07T12:00:00.000Z',
      title: 'Newer',
    });
    expect(pickNewerItineraryItem(older, newer).title).toBe('Newer');
    expect(pickNewerItineraryItem(newer, older).title).toBe('Newer');
  });

  it('preserves local booking secrets when remote schedule wins', () => {
    const local = flightItem({
      bookingUrl: 'https://example.com/mine',
      flight: {
        airline: 'AA',
        flightNumber: '100',
        confirmationCode: 'SECRET',
        seat: '12A',
        departureAirport: 'MIA',
        arrivalAirport: 'JFK',
      },
    });
    const remote = flightItem({
      title: 'Updated title',
      flight: {
        airline: 'AA',
        flightNumber: '100',
        departureAirport: 'MIA',
        arrivalAirport: 'LGA',
      },
    });
    const preserved = preserveOwnedItinerarySecrets(local, remote);
    expect(preserved.title).toBe('Updated title');
    expect(preserved.flight?.arrivalAirport).toBe('LGA');
    expect(preserved.flight?.confirmationCode).toBe('SECRET');
    expect(preserved.flight?.seat).toBe('12A');
    expect(preserved.bookingUrl).toBe('https://example.com/mine');
  });

  it('labels peer-owned stops for co-travelers', () => {
    expect(itineraryShareCueLabel(ownedItem(), 'user-me')).toBeUndefined();
    expect(
      itineraryShareCueLabel(
        flightItem({ ownerUserId: 'user-me', shareMode: 'trip' }),
        'user-me',
      ),
    ).toBeUndefined();
    expect(
      itineraryShareCueLabel(
        flightItem({ ownerUserId: 'user-host', shareMode: 'trip' }),
        'user-me',
      ),
    ).toBe('From co-traveler');
  });
});

function ownedItem(): TravelItineraryItem {
  return flightItem({
    id: 'item-mine',
    ownerUserId: 'user-me',
    shareMode: 'trip',
  });
}
