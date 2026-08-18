import {
  flightScheduleDraft,
  validateFlightSchedule,
} from '../flight-schedule';
import type { TravelItineraryItem } from '../types';

const flight: TravelItineraryItem = {
  id: 'flight-1',
  kind: 'flight',
  title: 'Flight EWR → KEF',
  date: '2026-09-08',
  startMinutes: 20 * 60 + 25,
  durationMinutes: 5 * 60 + 50,
  flight: { departureAirport: 'EWR', arrivalAirport: 'KEF' },
};

describe('flight schedule', () => {
  it('creates departure and timezone-aware arrival fields from an itinerary item', () => {
    expect(flightScheduleDraft(flight)).toEqual({
      departureDate: '2026-09-08',
      departureMinutes: 20 * 60 + 25,
      arrivalDate: '2026-09-09',
      arrivalMinutes: 6 * 60 + 15,
    });
  });

  it('converts edited local clocks back into the correct block duration', () => {
    expect(
      validateFlightSchedule(flightScheduleDraft(flight), flight.flight),
    ).toEqual({
      ok: true,
      value: {
        date: '2026-09-08',
        startMinutes: 20 * 60 + 25,
        durationMinutes: 5 * 60 + 50,
      },
    });
  });

  it('rejects an arrival before departure', () => {
    expect(
      validateFlightSchedule(
        {
          departureDate: '2026-09-09',
          departureMinutes: 12 * 60,
          arrivalDate: '2026-09-08',
          arrivalMinutes: 12 * 60,
        },
        flight.flight,
      ),
    ).toEqual({ ok: false, error: 'Arrival needs to be after departure.' });
  });
});
