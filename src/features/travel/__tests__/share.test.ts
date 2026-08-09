import fs from 'node:fs';

import {
    createInstalledTravelInviteUrl,
    createInstalledTravelOpenJoinUrl,
    createTravelInviteUrl,
    createTravelOpenJoinUrl,
    decodeTravelInvite,
    encodeTravelInvite,
    findMatchingTravelPlan,
    isOpenTravelJoinCode,
    isShortTravelInvite,
    resolveTravelInvite,
    travelInviteKey,
    travelPlanIdentityKey,
} from '../share';
import type { TravelPlan } from '../types';

const inviteAcceptanceMigration = fs.readFileSync(
  'supabase/migrations/202608040001_travel_invite_acceptance_result.sql',
  'utf8',
);

const plan: TravelPlan = {
  id: 'trip-1',
  title: 'Amélie’s 50% fun trip',
  destination: 'Montréal',
  startDate: '2026-09-12',
  endDate: '2026-09-15',
  notes: 'Bring friends ✈️',
  itinerary: [
    {
      id: 'flight-1',
      kind: 'flight',
      title: 'Flight to Montréal',
      date: '2026-09-12',
      startMinutes: 540,
      durationMinutes: 90,
      shareMode: 'trip',
      flight: {
        airline: 'Air Canada',
        flightNumber: 'AC 421',
        confirmationCode: 'ABC123',
        departureAirport: 'JFK',
        arrivalAirport: 'YUL',
        seat: '14A',
      },
    },
  ],
  participants: [],
  baseCurrency: 'USD',
  expenses: [],
  createdAt: '2026-07-25T12:00:00.000Z',
  updatedAt: '2026-07-25T12:00:00.000Z',
};

describe('travel invites', () => {
  it('makes invite acceptance report whether a valid row was accepted', () => {
    expect(inviteAcceptanceMigration).toContain('returns boolean');
    expect(inviteAcceptanceMigration).toContain('return coalesce(accepted, false)');
  });

  it('round-trips an encoded trip without copying its local id or sensitive fields', () => {
    expect(decodeTravelInvite(encodeTravelInvite(plan))).toMatchObject({
      title: plan.title,
      mode: 'flight',
      destination: plan.destination,
      startDate: plan.startDate,
      endDate: plan.endDate,
      notes: plan.notes,
      itinerary: [
        {
          ...plan.itinerary[0],
          bookingUrl: undefined,
          flight: {
            airline: 'Air Canada',
            flightNumber: 'AC 421',
            departureAirport: 'JFK',
            arrivalAirport: 'YUL',
          },
          transport: undefined,
          rental: undefined,
          stay: undefined,
        },
      ],
      participants: [],
      baseCurrency: 'USD',
      expenses: [],
    });
    const decoded = decodeTravelInvite(encodeTravelInvite(plan));
    expect(decoded?.itinerary[0]?.flight?.confirmationCode).toBeUndefined();
    expect(decoded?.itinerary[0]?.flight?.seat).toBeUndefined();
  });

  it('creates one compact, URL-safe payload instead of double-encoded JSON', () => {
    const payload = encodeTravelInvite(plan);
    expect(payload).toMatch(/^3\.[A-Za-z0-9_-]+$/);
  });

  it('keeps compact v2 links working after v3 ships', () => {
    const compatibleV2 = encodeTravelInvite(plan).replace(/^3\./, '2.');
    expect(decodeTravelInvite(compatibleV2)?.destination).toBe(plan.destination);
  });

  it('round-trips safe transport route data while excluding private ticket and fare data', () => {
    const encoded = encodeTravelInvite({
      ...plan,
      mode: 'road',
      origin: 'New York, NY',
      itinerary: [{
        id: 'transport-1',
        kind: 'transport',
        title: 'Drive to Washington',
        date: '2026-09-12',
        startMinutes: 480,
        durationMinutes: 300,
        shareMode: 'trip',
        transport: {
          mode: 'driving',
          origin: 'New York, NY',
          destination: 'Washington, DC',
          arrivalDate: '2026-09-12',
          arrivalMinutes: 780,
          confirmationCode: 'PRIVATE',
          seat: '12A',
          fare: 75,
          currency: 'USD',
          stops: [{ id: 'stop-1', name: 'Philadelphia', address: 'Philadelphia, PA' }],
        },
      }],
    });
    const decoded = decodeTravelInvite(encoded);
    expect(decoded).toMatchObject({ mode: 'road', origin: 'New York, NY' });
    expect(decoded?.itinerary[0]?.transport).toMatchObject({
      mode: 'driving',
      origin: 'New York, NY',
      destination: 'Washington, DC',
      stops: [{ name: 'Philadelphia' }],
    });
    expect(decoded?.itinerary[0]?.transport?.confirmationCode).toBeUndefined();
    expect(decoded?.itinerary[0]?.transport?.fare).toBeUndefined();
  });

  it('includes all itinerary stops in invite bootstrap payloads', () => {
    const encoded = encodeTravelInvite({
      ...plan,
      itinerary: [
        {
          ...plan.itinerary[0]!,
          id: 'moment-1',
          kind: 'moment',
          title: 'Sunset',
          shareMode: 'trip',
        },
        {
          ...plan.itinerary[0]!,
          id: 'shared-flight',
          shareMode: 'trip',
        },
      ],
    });
    const decoded = decodeTravelInvite(encoded);
    expect(decoded?.itinerary.map((item) => item.id)).toEqual([
      'moment-1',
      'shared-flight',
    ]);
  });

  it('creates a genuinely short hosted link from an invite code', () => {
    const code = '0123456789abcdefabcd';
    const url = createTravelInviteUrl(code, 'https://ontrack--links.expo.app/');
    expect(url).toBe(`https://ontrack--links.expo.app/i/${code}`);
    expect(url.length).toBeLessThan(70);
    expect(isShortTravelInvite(`s.${code}`)).toBe(true);
    expect(isShortTravelInvite(`s.${code}x`)).toBe(false);
  });

  it('creates an explicit installed-app URL without resolving back to the website', () => {
    const code = '0123456789abcdefabcd';
    expect(createInstalledTravelInviteUrl(`s.${code}`)).toBe(`ontrack:///i/${code}`);
    expect(createInstalledTravelInviteUrl()).toBe('ontrack:///travel');
  });

  it('creates an open join link that anyone can request and the host must approve', () => {
    const code = '0123456789abcdefabcd';
    expect(isOpenTravelJoinCode(code)).toBe(true);
    expect(isOpenTravelJoinCode(`s.${code}`)).toBe(false);
    expect(createTravelOpenJoinUrl(code, 'https://ontrack--links.expo.app/')).toBe(
      `https://ontrack--links.expo.app/j/${code}`,
    );
    expect(createInstalledTravelOpenJoinUrl(code)).toBe(`ontrack:///j/${code}`);
  });

  it('keeps links from the original invite format working', () => {
    const legacyPayload = encodeURIComponent(
      JSON.stringify({
        version: 1,
        plan: { ...plan, id: undefined, createdAt: undefined, updatedAt: undefined },
      }),
    );
    expect(decodeTravelInvite(legacyPayload)?.destination).toBe('Montréal');
    expect(decodeTravelInvite(decodeURIComponent(legacyPayload))?.destination).toBe('Montréal');
  });

  it('does not resolve embedded trip payloads through the invitation flow', async () => {
    await expect(resolveTravelInvite(encodeTravelInvite(plan))).resolves.toBeUndefined();
  });

  it('rejects malformed invites', () => {
    expect(decodeTravelInvite('not-a-trip')).toBeUndefined();
  });

  it('creates stable keys for duplicate invite protection', () => {
    const payload = encodeTravelInvite(plan);
    expect(travelInviteKey(payload)).toBe(travelInviteKey(payload));
    expect(travelInviteKey(`${payload}x`)).not.toBe(travelInviteKey(payload));
  });

  it('matches an existing trip by normalized title, destination, and dates', () => {
    expect(
      findMatchingTravelPlan([plan], {
        ...plan,
        title: '  AMÉLIE’S   50% FUN TRIP ',
        destination: ' montréal ',
      }),
    ).toBe(plan);
  });

  it('does not match a trip with different dates', () => {
    expect(
      findMatchingTravelPlan([plan], {
        ...plan,
        startDate: '2026-09-13',
      }),
    ).toBeUndefined();
  });

  it('uses the same imported id for different links containing the same trip', () => {
    const sameTripWithUpdatedDetails: TravelPlan = {
      ...plan,
      id: 'another-local-id',
      notes: 'Updated packing notes',
      itinerary: [],
    };
    expect(travelPlanIdentityKey(sameTripWithUpdatedDetails)).toBe(
      travelPlanIdentityKey(plan),
    );
  });
});
