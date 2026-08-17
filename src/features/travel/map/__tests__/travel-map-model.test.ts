import type { TravelPlan } from '@/features/travel/types';

import {
  createTravelMapVisit,
  createStandaloneTravelMapVisit,
  isSameTravelMapPlace,
  travelMapCountryClusters,
  travelMapPersonColorForId,
} from '../model';
import {
  normalizeTravelMapSettings,
  normalizeTravelMapVisits,
  travelMapSuggestionFingerprint,
} from '../normalize';

const plan: TravelPlan = {
  id: 'trip-1',
  title: 'North Atlantic',
  destination: 'Iceland',
  startDate: '2026-09-01',
  endDate: '2026-09-08',
  itinerary: [],
  participants: [],
  baseCurrency: 'USD',
  expenses: [],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
};

describe('travel map model', () => {
  it('supports multiple places and multiple country visits for one trip', () => {
    const iceland = createTravelMapVisit({
      plan,
      countryCode: 'is',
      countryName: 'Iceland',
      place: { label: 'Reykjavík', latitude: 64.1466, longitude: -21.9426 },
      now: '2026-08-11T12:00:00.000Z',
    });
    const france = createTravelMapVisit({ plan, countryCode: 'FR', countryName: 'France' });
    expect(iceland.countryCode).toBe('IS');
    expect(iceland.places).toHaveLength(1);
    expect(france.tripId).toBe(iceland.tripId);
    expect(france.countryCode).toBe('FR');
  });

  it('keeps standalone pins without manufacturing a trip link or summary', () => {
    const standalone = createStandaloneTravelMapVisit({
      countryCode: 'US',
      countryName: 'United States of America',
      place: { label: 'Denver', latitude: 39.7392, longitude: -104.9903 },
      now: '2026-08-11T12:00:00.000Z',
    });

    expect(standalone.tripId).toBeUndefined();
    expect(standalone.tripSummary).toBeUndefined();
    expect(normalizeTravelMapVisits([standalone])).toEqual([standalone]);
  });

  it('recognizes repeat saves of the same map point as one place', () => {
    expect(isSameTravelMapPlace(
      { latitude: 64.1466, longitude: -21.9426 },
      { latitude: 64.1466001, longitude: -21.9426001 },
    )).toBe(true);
    expect(isSameTravelMapPlace(
      { latitude: 64.1466, longitude: -21.9426 },
      { latitude: 65.6885, longitude: -18.1262 },
    )).toBe(false);
  });

  it('clusters overlapping people without dropping their colors', () => {
    const visit = createTravelMapVisit({ plan, countryCode: 'IS', countryName: 'Iceland' });
    const clusters = travelMapCountryClusters([
      { visit, person: { userId: 'self', displayName: 'Me', color: '#111', isSelf: true }, canOpenTrip: true },
      { visit: { ...visit, id: 'second' }, person: { userId: 'friend', displayName: 'Ari', color: '#222' }, canOpenTrip: false },
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.colors).toEqual(['#111', '#222']);
    expect(clusters[0]?.people.map((person) => person.userId)).toEqual([
      'self',
      'friend',
    ]);
  });

  it('keeps one cluster person per user when they have several pins', () => {
    const visit = createTravelMapVisit({ plan, countryCode: 'IS', countryName: 'Iceland' });
    const person = { userId: 'self', displayName: 'Me', color: '#111', isSelf: true as const };
    const clusters = travelMapCountryClusters([
      { visit, person, canOpenTrip: true },
      { visit: { ...visit, id: 'second' }, person, canOpenTrip: true },
    ]);
    expect(clusters[0]?.people).toHaveLength(1);
    expect(clusters[0]?.colors).toEqual(['#111']);
  });

  it('assigns deterministic high-contrast friend colors', () => {
    expect(travelMapPersonColorForId('friend-a')).toBe(travelMapPersonColorForId('friend-a'));
    expect(travelMapPersonColorForId('friend-a')).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('normalizes legacy settings and reconciles duplicate visits by timestamp', () => {
    const old = createTravelMapVisit({ plan, countryCode: 'IS', countryName: 'Iceland', now: '2026-08-10T00:00:00.000Z' });
    const current = { ...old, countryName: 'Ísland', updatedAt: '2026-08-11T00:00:00.000Z' };
    expect(normalizeTravelMapVisits([old, current])).toEqual([current]);
    expect(normalizeTravelMapSettings({ selectedFriendIds: ['friend', 'friend'] })).toEqual({
      shareWithFriends: false,
      selectedFriendIds: ['friend'],
      dismissedSuggestionFingerprints: [],
    });
  });

  it('changes suggestion fingerprints when destination metadata changes', () => {
    expect(travelMapSuggestionFingerprint(plan)).not.toBe(
      travelMapSuggestionFingerprint({ ...plan, destination: 'France' }),
    );
  });
});
