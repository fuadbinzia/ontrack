import type { TravelPlan } from '@/features/travel/types';

import {
    AGENT_UI_DEMO_CONNECTING_FLIGHT_ID,
    AGENT_UI_DEMO_FLIGHT_ID,
    AGENT_UI_DEMO_RENTAL_ID,
    AGENT_UI_DEMO_STAY_ID,
    AGENT_UI_DEMO_TRIP_ID,
    AGENT_UI_PUNTA_CANA_OUTBOUND_ID,
    AGENT_UI_PUNTA_CANA_RETURN_ID,
    AGENT_UI_PUNTA_CANA_STAY_ID,
    AGENT_UI_PUNTA_CANA_TRIP_ID,
    fixtureNameForReservedTripId,
    isReservedAgentUiTripId,
} from './fixtures-constants';

/** Dropped after a successful live restore (host places the file in Documents). */
export const TRAVEL_RESTORE_DOCUMENTS_FILENAME = 'travel-plans-restore.json';

export function leaveReservedAgentUiTravelRouteIfNeeded(
  route: string | null = null,
): boolean {
  // Lazy require avoids fixtures ↔ route cycles in unit tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { agentUiNavigate, getAgentUiRoute, travelPlanIdFromRoute } =
    require('@/utils/agent-ui/route') as typeof import('@/utils/agent-ui/route');
  const resolved = route ?? getAgentUiRoute();
  const tripId = travelPlanIdFromRoute(resolved);
  if (!tripId || !isReservedAgentUiTripId(tripId)) return false;
  return agentUiNavigate('/travel');
}

/**
 * Reserved demo route with no plan: re-seed while a sandbox is still on;
 * otherwise leave Travel so cold start / verify-both release cannot stick.
 * Returns true when the plan exists after recovery.
 */

export function recoverMissingReservedTravelPlan(planId: string): boolean {
  if (!planId || !isReservedAgentUiTripId(planId)) return false;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useTravel } = require('@/store/travel') as typeof import('@/store/travel');
  if (useTravel.getState().plans.some((plan) => plan.id === planId)) return true;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useDevMode } = require('@/store/dev-mode') as typeof import('@/store/dev-mode');
  if (__DEV__ && useDevMode.getState().enabled) {
    const fixture = fixtureNameForReservedTripId(planId);
    if (fixture) {
      // Lazy require avoids fixtures-travel ↔ fixtures-seed cycle in unit tests.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { seedAgentUiFixture } =
        require('./fixtures-seed') as typeof import('./fixtures-seed');
      seedAgentUiFixture(fixture);
      if (useTravel.getState().plans.some((plan) => plan.id === planId)) return true;
    }
  }

  leaveReservedAgentUiTravelRouteIfNeeded(`/travel/${planId}`);
  return useTravel.getState().plans.some((plan) => plan.id === planId);
}

/** Dropped after a successful live restore (host places the file in Documents). */

function travelHomeInviteCode(seed: string): string {
  const hex = Array.from(seed)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('');
  return `${hex}${'0'.repeat(20)}`.slice(0, 20);
}

function buildTravelHomeParticipant(
  id: string,
  name: string,
  nowIso: string,
): TravelPlan['participants'][number] {
  return {
    id,
    name,
    inviteCode: travelHomeInviteCode(id),
    invitedAt: nowIso,
    acceptedAt: nowIso,
  };
}

/**
 * Iceland + Antigua + third trip for Travel Home visual QA.
 * Hero images resolve via `travelHomeFixtureHeroSource` in __DEV__.
 */
export function buildTravelHomeVisualTrips(
  nowIso = new Date().toISOString(),
): TravelPlan[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    TRAVEL_HOME_ANTIGUA_TRIP_ID,
    TRAVEL_HOME_ICELAND_TRIP_ID,
    TRAVEL_HOME_THIRD_TRIP_ID,
  } =
    require('@/features/travel/fixtures/travel-home') as typeof import('@/features/travel/fixtures/travel-home');

  const iceland: TravelPlan = {
    id: TRAVEL_HOME_ICELAND_TRIP_ID,
    title: 'Iceland',
    mode: 'flight',
    destination: 'Reykjavík, Iceland',
    startDate: '2026-09-08',
    endDate: '2026-09-14',
    notes: 'Travel Home visual fixture. Safe to overwrite.',
    itinerary: [],
    participants: [
      buildTravelHomeParticipant('p-home-alex', 'Alex Rivera', nowIso),
      buildTravelHomeParticipant('p-home-jordan', 'Jordan Lee', nowIso),
      buildTravelHomeParticipant('p-home-morgan', 'Morgan Blake', nowIso),
    ],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const antigua: TravelPlan = {
    id: TRAVEL_HOME_ANTIGUA_TRIP_ID,
    title: 'Antigua, Guatemala',
    mode: 'flight',
    destination: 'Antigua, Guatemala',
    startDate: '2026-09-22',
    endDate: '2026-09-27',
    notes: 'Travel Home visual fixture. Safe to overwrite.',
    itinerary: [],
    participants: [
      buildTravelHomeParticipant('p-home-casey', 'Casey Morgan', nowIso),
      buildTravelHomeParticipant('p-home-sam', 'Sam Quinn', nowIso),
      buildTravelHomeParticipant('p-home-riley', 'Riley Chen', nowIso),
      buildTravelHomeParticipant('p-home-avery', 'Avery Brooks', nowIso),
    ],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const third: TravelPlan = {
    id: TRAVEL_HOME_THIRD_TRIP_ID,
    title: 'Faroe Islands',
    mode: 'flight',
    destination: 'Tórshavn, Faroe Islands',
    startDate: '2026-10-04',
    endDate: '2026-10-10',
    notes: 'Travel Home visual fixture (below-fold third trip). Safe to overwrite.',
    itinerary: [],
    participants: [
      buildTravelHomeParticipant('p-home-taylor', 'Taylor Nguyen', nowIso),
    ],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  return [iceland, antigua, third];
}

export function buildAgentUiDemoTrip(
  nowIso = new Date().toISOString(),
): TravelPlan {
  return {
    id: AGENT_UI_DEMO_TRIP_ID,
    title: 'Agent UI Demo',
    mode: 'flight',
    origin: 'New York, NY',
    destination: 'Lisbon, Portugal',
    startDate: '2026-09-27',
    endDate: '2026-09-30',
    notes: 'Demo trip for agent navigation. Safe to overwrite.',
    itinerary: [
      {
        id: AGENT_UI_DEMO_FLIGHT_ID,
        kind: 'flight',
        title: 'UA 70',
        date: '2026-09-27',
        startMinutes: 18 * 60 + 30,
        durationMinutes: 420,
        flight: {
          airline: 'United',
          flightNumber: 'UA70',
          departureAirport: 'EWR',
          departureTerminal: 'C',
          departureGate: 'C71',
          arrivalAirport: 'LIS',
          arrivalTerminal: '1',
          arrivalGate: '18',
          confirmationCode: 'AGENTUI',
          passengerCount: 1,
          // Durable cloud marker — proves the View Confirmation control survives
          // normalize/sync (local file:// alone was previously stripped on pull).
          confirmationUris: [
            'ontrack-media:agent-ui/travel/demo-flight-confirmation.pdf',
          ],
        },
      },
      {
        // Seed per-leg terminals/gates so opening the demo never triggers a
        // live AeroDataBox enrichment just to paint the itinerary chips.
        id: AGENT_UI_DEMO_CONNECTING_FLIGHT_ID,
        kind: 'flight',
        title: 'UA 1907',
        date: '2026-09-30',
        startMinutes: 90,
        durationMinutes: 599,
        flight: {
          airline: 'United Airlines',
          flightNumber: 'UA1907',
          departureAirport: 'GUA',
          departureTerminal: '1',
          departureGate: '5',
          arrivalAirport: 'LGA',
          arrivalTerminal: 'B',
          arrivalGate: '22',
          confirmationCode: 'HF7K2Q',
          passengerCount: 1,
          legs: [
            {
              airline: 'United Airlines',
              flightNumber: 'UA1907',
              departureAirport: 'GUA',
              departureTerminal: '1',
              departureGate: '5',
              arrivalAirport: 'IAH',
              arrivalTerminal: 'C',
              arrivalGate: '41',
              aircraft: 'Boeing 737-800 Passenger',
              date: '2026-09-30',
              departureMinutes: 90,
              arrivalMinutes: 321,
              durationMinutes: 171,
              layoverMinutesAfter: 99,
            },
            {
              airline: 'United Airlines',
              flightNumber: 'UA1697',
              departureAirport: 'IAH',
              departureTerminal: 'C',
              departureGate: '12',
              arrivalAirport: 'LGA',
              arrivalTerminal: 'B',
              arrivalGate: '22',
              aircraft: 'Boeing 737 MAX 8',
              date: '2026-09-30',
              departureMinutes: 420,
              arrivalMinutes: 689,
              durationMinutes: 209,
            },
          ],
        },
      },
      {
        id: AGENT_UI_DEMO_STAY_ID,
        kind: 'stay',
        title: 'Centerhotel Miðgarður',
        date: '2026-09-27',
        startMinutes: 15 * 60,
        durationMinutes: 2 * 24 * 60,
        details: 'Laugavegur 120, 105 Reykjavík, Iceland',
        // No OTA booking URL — brand logo resolves dynamically from the hotel name.
        stay: {
          checkoutDate: '2026-09-29',
          checkoutMinutes: 11 * 60,
          confirmationCode: 'STAYDEMO',
        },
      },
      {
        id: AGENT_UI_DEMO_RENTAL_ID,
        kind: 'rental',
        title: 'Hertz Rental · Lisbon Airport (LIS)',
        date: '2026-09-27',
        startMinutes: 10 * 60 + 30,
        durationMinutes: 2 * 24 * 60 + 6 * 60,
        rental: {
          company: 'Hertz',
          confirmationCode: 'RENTALDEMO',
          pickupLocation: 'Lisbon Airport (LIS)',
          dropoffLocation: 'Lisbon Airport (LIS)',
          dropoffDate: '2026-09-29',
          dropoffMinutes: 16 * 60 + 30,
          vehicleClass: 'Compact',
        },
      },
    ],
    participants: [],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: nowIso,
  };
}

/** Airbnb Punta Cana stay from trip-page OCR (Lisbeth host, Aug 10–14). */
export function buildAgentUiPuntaCanaTrip(
  nowIso = new Date().toISOString(),
): TravelPlan {
  const year = new Date(nowIso).getFullYear();
  const startDate = `${year}-08-10`;
  const endDate = `${year}-08-14`;
  return {
    id: AGENT_UI_PUNTA_CANA_TRIP_ID,
    title: 'Punta Cana',
    mode: 'flight',
    destination: 'Punta Cana, Dominican Republic',
    startDate,
    endDate,
    notes:
      'Airbnb stay + JetBlue JFK↔SDQ mock (Hosted by Lisbeth). Safe to overwrite.',
    origin: 'New York, NY',
    itinerary: [
      {
        id: AGENT_UI_PUNTA_CANA_OUTBOUND_ID,
        kind: 'flight',
        title: 'B6 2709',
        date: startDate,
        startMinutes: 6 * 60 + 40,
        durationMinutes: 3 * 60 + 52,
        flight: {
          airline: 'JetBlue',
          flightNumber: 'B6 2709',
          departureAirport: 'JFK',
          departureTerminal: '5',
          departureGate: '527',
          arrivalAirport: 'SDQ',
          arrivalTerminal: 'Main',
          confirmationCode: 'WYDBAP',
          passengerCount: 2,
        },
      },
      {
        id: AGENT_UI_PUNTA_CANA_STAY_ID,
        kind: 'stay',
        title: 'Punta Cana',
        date: startDate,
        startMinutes: 16 * 60,
        // Check-in 4:00 PM → checkout 10:00 AM four calendar days later.
        durationMinutes: 3 * 24 * 60 + 18 * 60,
        details: 'Punta Cana, La Altagracia Province 23000, Dominican Republic',
        bookingUrl: 'https://www.airbnb.com/trips/v1/1',
        stay: {
          checkoutDate: endDate,
          checkoutMinutes: 10 * 60,
          notes: 'Hosted by Lisbeth',
        },
      },
      {
        id: AGENT_UI_PUNTA_CANA_RETURN_ID,
        kind: 'flight',
        title: 'B6 1850',
        date: endDate,
        startMinutes: 17 * 60 + 53,
        durationMinutes: 3 * 60 + 57,
        flight: {
          airline: 'JetBlue',
          flightNumber: 'B6 1850',
          departureAirport: 'SDQ',
          departureTerminal: 'Main',
          arrivalAirport: 'JFK',
          arrivalTerminal: '5',
          confirmationCode: 'WYDBAP',
          passengerCount: 2,
        },
      },
    ],
    participants: [],
    baseCurrency: 'USD',
    expenses: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: nowIso,
  };
}

